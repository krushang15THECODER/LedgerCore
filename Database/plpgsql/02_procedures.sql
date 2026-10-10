-- =====================================================================
-- LedgerCore | PL/pgSQL | 02_procedures.sql
-- Financial engine inside PostgreSQL. All logic is parameterised, so it
-- works for any account. Every operation is atomic: any RAISE EXCEPTION
-- rolls back the whole call (transaction row, ledger entries, balances).
--
-- Public API (use CALL):
--   CALL sp_deposit(account, amount_paise, description, idem_key, NULL);
--   CALL sp_withdraw(account, amount_paise, description, idem_key, NULL);
--   CALL sp_transfer(from, to, amount_paise, description, idem_key, NULL);
--   CALL sp_set_account_status(account, 'BLOCKED');
--   CALL sp_open_account(user, 'SAVINGS', NULL);
--   CALL sp_print_account_statement(account);
--   CALL sp_run_health_report();
-- The last argument of the INOUT procedures is a placeholder: pass NULL and
-- the new transaction id / account id is returned in its place.
-- Requires 01_functions.sql.  Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_post_double_entry: the ONE place where money moves.
-- Debits p_debit_account and credits p_credit_account by p_amount.
-- Deposit, withdrawal and transfer are all just different pairs of accounts.
-- Returns the txn_id (or the original txn_id when the idempotency key was
-- already used).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_post_double_entry(
    p_txn_type        VARCHAR,
    p_debit_account   BIGINT,
    p_credit_account  BIGINT,
    p_amount          BIGINT,
    p_description     VARCHAR DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    p_ref_prefix      VARCHAR DEFAULT 'TXN'
)
RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    v_txn_id BIGINT;
    v_debit  accounts%ROWTYPE;
    v_credit accounts%ROWTYPE;
    v_id     BIGINT;
    v_ref    VARCHAR;
BEGIN
    -- ---------- input validation ----------
    IF p_txn_type NOT IN ('TRANSFER', 'DEPOSIT', 'WITHDRAWAL') THEN
        RAISE EXCEPTION 'Invalid transaction type %', p_txn_type USING ERRCODE = '22023';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be a positive number of paise' USING ERRCODE = '22023';
    END IF;
    IF p_debit_account IS NULL OR p_credit_account IS NULL THEN
        RAISE EXCEPTION 'Both accounts are required' USING ERRCODE = '22023';
    END IF;
    IF p_debit_account = p_credit_account THEN
        RAISE EXCEPTION 'Source and destination accounts must be different' USING ERRCODE = '22023';
    END IF;

    -- ---------- idempotency: replay of an already processed request ----------
    IF p_idempotency_key IS NOT NULL THEN
        DELETE FROM idempotency_keys
         WHERE key = p_idempotency_key AND expires_at <= CURRENT_TIMESTAMP;   -- expired keys are reusable

        SELECT i.txn_id INTO v_txn_id
          FROM idempotency_keys i
         WHERE i.key = p_idempotency_key;
        IF FOUND THEN
            RETURN v_txn_id;
        END IF;
    END IF;

    BEGIN   -- sub-block so a concurrent duplicate key can be handled below
        -- ---------- lock both accounts, lowest id first (prevents deadlocks) ----------
        FOR v_id IN SELECT unnest(ARRAY[LEAST(p_debit_account, p_credit_account),
                                        GREATEST(p_debit_account, p_credit_account)])
        LOOP
            PERFORM 1 FROM accounts WHERE account_id = v_id FOR UPDATE;
        END LOOP;

        SELECT * INTO v_debit  FROM accounts WHERE account_id = p_debit_account;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account % does not exist', p_debit_account USING ERRCODE = 'P0002';
        END IF;
        SELECT * INTO v_credit FROM accounts WHERE account_id = p_credit_account;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account % does not exist', p_credit_account USING ERRCODE = 'P0002';
        END IF;

        -- ---------- business rules ----------
        IF v_debit.status <> 'ACTIVE' OR v_credit.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'Both accounts must be ACTIVE' USING ERRCODE = '22023';
        END IF;

        IF p_txn_type = 'TRANSFER'
           AND (v_debit.account_type = 'SYSTEM' OR v_credit.account_type = 'SYSTEM') THEN
            RAISE EXCEPTION 'Transfers cannot involve the SYSTEM account' USING ERRCODE = '22023';
        ELSIF p_txn_type = 'DEPOSIT' AND v_debit.account_type <> 'SYSTEM' THEN
            RAISE EXCEPTION 'A deposit must be debited from the SYSTEM account' USING ERRCODE = '22023';
        ELSIF p_txn_type = 'WITHDRAWAL' AND v_credit.account_type <> 'SYSTEM' THEN
            RAISE EXCEPTION 'A withdrawal must be credited to the SYSTEM account' USING ERRCODE = '22023';
        END IF;

        IF v_debit.balance < p_amount THEN
            IF v_debit.account_type = 'SYSTEM' THEN
                RAISE EXCEPTION 'Insufficient system cash liquidity' USING ERRCODE = '22023';
            END IF;
            RAISE EXCEPTION 'Insufficient balance' USING ERRCODE = '22023';
        END IF;

        -- ---------- create the transaction (PENDING) ----------
        v_ref := p_ref_prefix || '-' || (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
                 || '-' || upper(substr(md5(random()::TEXT), 1, 8));

        INSERT INTO transactions (reference_no, txn_type, status, description)
        VALUES (v_ref, p_txn_type, 'PENDING', p_description)
        RETURNING txn_id INTO v_txn_id;

        -- claim the idempotency key first: a concurrent duplicate waits here
        IF p_idempotency_key IS NOT NULL THEN
            INSERT INTO idempotency_keys (key, txn_id, expires_at)
            VALUES (p_idempotency_key, v_txn_id, CURRENT_TIMESTAMP + INTERVAL '1 day');
        END IF;

        -- ---------- double-entry ledger ----------
        INSERT INTO ledger_entries (txn_id, account_id, entry_type, amount)
        VALUES (v_txn_id, p_debit_account,  'DEBIT',  p_amount),
               (v_txn_id, p_credit_account, 'CREDIT', p_amount);

        -- ---------- balances ----------
        UPDATE accounts SET balance = balance - p_amount WHERE account_id = p_debit_account;
        UPDATE accounts SET balance = balance + p_amount WHERE account_id = p_credit_account;

        -- ---------- invariant, then complete ----------
        IF NOT fn_txn_is_balanced(v_txn_id) THEN
            RAISE EXCEPTION 'Ledger invariant violated: DEBIT <> CREDIT' USING ERRCODE = 'XX001';
        END IF;

        UPDATE transactions SET status = 'COMPLETED' WHERE txn_id = v_txn_id;

        RETURN v_txn_id;

    EXCEPTION WHEN unique_violation THEN
        -- Another session committed the same idempotency key first.
        -- Everything done in this sub-block is rolled back; return their result.
        IF p_idempotency_key IS NOT NULL THEN
            SELECT i.txn_id INTO v_txn_id FROM idempotency_keys i WHERE i.key = p_idempotency_key;
            IF FOUND THEN
                RETURN v_txn_id;
            END IF;
        END IF;
        RAISE;
    END;
END;
$$;

-- ---------------------------------------------------------------------
-- sp_deposit: SYSTEM account -> customer account
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_deposit(
    p_account_id      BIGINT,
    p_amount          BIGINT,
    p_description     VARCHAR DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    INOUT p_txn_id    BIGINT  DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    p_txn_id := fn_post_double_entry('DEPOSIT', fn_system_account_id(), p_account_id,
                                     p_amount, p_description, p_idempotency_key, 'TXN-DEP');
END;
$$;

-- ---------------------------------------------------------------------
-- sp_withdraw: customer account -> SYSTEM account
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_withdraw(
    p_account_id      BIGINT,
    p_amount          BIGINT,
    p_description     VARCHAR DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    INOUT p_txn_id    BIGINT  DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    p_txn_id := fn_post_double_entry('WITHDRAWAL', p_account_id, fn_system_account_id(),
                                     p_amount, p_description, p_idempotency_key, 'TXN-WDR');
END;
$$;

-- ---------------------------------------------------------------------
-- sp_transfer: customer account -> customer account
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_transfer(
    p_from_account    BIGINT,
    p_to_account      BIGINT,
    p_amount          BIGINT,
    p_description     VARCHAR DEFAULT NULL,
    p_idempotency_key VARCHAR DEFAULT NULL,
    INOUT p_txn_id    BIGINT  DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    p_txn_id := fn_post_double_entry('TRANSFER', p_from_account, p_to_account,
                                     p_amount, p_description, p_idempotency_key, 'TXN-TRF');
END;
$$;

-- ---------------------------------------------------------------------
-- sp_set_account_status: controlled status changes.
--   ACTIVE <-> BLOCKED, ACTIVE/BLOCKED -> CLOSED (balance must be 0).
--   CLOSED is final. The SYSTEM account can never change.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_set_account_status(p_account_id BIGINT, p_new_status VARCHAR)
LANGUAGE plpgsql AS $$
DECLARE
    v_acc accounts%ROWTYPE;
BEGIN
    IF p_new_status NOT IN ('ACTIVE', 'BLOCKED', 'CLOSED') THEN
        RAISE EXCEPTION 'Invalid status %', p_new_status USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_acc FROM accounts WHERE account_id = p_account_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account % does not exist', p_account_id USING ERRCODE = 'P0002';
    END IF;
    IF v_acc.account_type = 'SYSTEM' THEN
        RAISE EXCEPTION 'The SYSTEM account status cannot be changed' USING ERRCODE = '22023';
    END IF;
    IF v_acc.status = p_new_status THEN
        RAISE EXCEPTION 'Account % is already %', p_account_id, p_new_status USING ERRCODE = '22023';
    END IF;
    IF v_acc.status = 'CLOSED' THEN
        RAISE EXCEPTION 'A CLOSED account cannot be reopened' USING ERRCODE = '22023';
    END IF;
    IF p_new_status = 'CLOSED' AND v_acc.balance <> 0 THEN
        RAISE EXCEPTION 'Account % still holds % and cannot be closed',
                        p_account_id, fn_format_inr(v_acc.balance) USING ERRCODE = '22023';
    END IF;

    UPDATE accounts SET status = p_new_status WHERE account_id = p_account_id;
    RAISE NOTICE 'Account % : % -> %', p_account_id, v_acc.status, p_new_status;
END;
$$;

-- ---------------------------------------------------------------------
-- sp_open_account: create an account for an existing user
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_open_account(
    p_user_id        BIGINT,
    p_account_type   VARCHAR,
    INOUT p_account_id BIGINT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_account_type NOT IN ('SAVINGS', 'CURRENT') THEN
        RAISE EXCEPTION 'Account type must be SAVINGS or CURRENT' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
        RAISE EXCEPTION 'User % does not exist', p_user_id USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO accounts (user_id, account_type)
    VALUES (p_user_id, p_account_type)
    RETURNING account_id INTO p_account_id;
END;
$$;

-- ---------------------------------------------------------------------
-- sp_print_account_statement: explicit CURSOR walk over a statement
-- (output appears as NOTICE messages in psql / pgAdmin "Messages")
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_print_account_statement(p_account_id BIGINT)
LANGUAGE plpgsql AS $$
DECLARE
    cur_stmt CURSOR FOR
        SELECT * FROM fn_account_statement(p_account_id, NULL, NULL, 1000, 0);
    rec   RECORD;
    v_cnt INT := 0;
BEGIN
    RAISE NOTICE 'Statement for account %  (stored balance %)',
                 p_account_id, fn_format_inr(fn_account_balance(p_account_id));
    OPEN cur_stmt;
    LOOP
        FETCH cur_stmt INTO rec;
        EXIT WHEN NOT FOUND;
        v_cnt := v_cnt + 1;
        RAISE NOTICE '% | % | % | % | balance %',
                     rec.created_at::DATE, rec.reference_no, rec.entry_type,
                     fn_format_inr(rec.amount), fn_format_inr(rec.running_balance);
    END LOOP;
    CLOSE cur_stmt;
    RAISE NOTICE '% statement line(s)', v_cnt;
END;
$$;

-- ---------------------------------------------------------------------
-- sp_run_health_report: prints every integrity check; WARNING on failures
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_run_health_report()
LANGUAGE plpgsql AS $$
DECLARE
    rec     RECORD;
    v_fails INT := 0;
BEGIN
    FOR rec IN SELECT * FROM fn_run_health_checks() LOOP
        RAISE NOTICE '[%] % (violations: %)', rec.status, rec.check_name, rec.violations;
        IF rec.status = 'FAIL' THEN
            v_fails := v_fails + 1;
        END IF;
    END LOOP;

    IF v_fails = 0 THEN
        RAISE NOTICE 'ALL CHECKS PASSED';
    ELSE
        RAISE WARNING '% check(s) FAILED', v_fails;
    END IF;
END;
$$;
