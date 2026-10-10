-- =====================================================================
-- LedgerCore | PL/pgSQL | 01_functions.sql
-- Read-only functions. Every one takes parameters, so it works for ANY
-- account / user / date range - nothing is hardcoded.
-- Passing NULL where noted means "all rows".
-- Run order: schema.sql -> seed.sql -> views.sql -> plpgsql/01..03
-- Safe to re-run (CREATE OR REPLACE).
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_format_inr: 150000 paise -> 'INR 1,500.00'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_format_inr(p_paise BIGINT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_paise IS NULL THEN NULL
                ELSE CASE WHEN p_paise < 0 THEN '-' ELSE '' END
                     || 'INR ' || to_char(abs(p_paise) / 100.0, 'FM999,999,999,999,990.00')
           END;
$$;

-- ---------------------------------------------------------------------
-- fn_system_account_id: id of the single SYSTEM (cash) account
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_system_account_id()
RETURNS BIGINT
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_id BIGINT;
BEGIN
    SELECT account_id INTO v_id FROM accounts WHERE account_type = 'SYSTEM';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SYSTEM account is missing' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_account_balance: stored balance (paise) of one account
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_account_balance(p_account_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT balance INTO v_balance FROM accounts WHERE account_id = p_account_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account % does not exist', p_account_id USING ERRCODE = 'P0002';
    END IF;
    RETURN v_balance;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_ledger_balance: balance derived from COMPLETED ledger entries only
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_ledger_balance(p_account_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_total BIGINT;
BEGIN
    PERFORM fn_account_balance(p_account_id);   -- raises if account is missing
    SELECT COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE -l.amount END), 0)
      INTO v_total
      FROM ledger_entries l
      JOIN transactions t ON t.txn_id = l.txn_id
     WHERE l.account_id = p_account_id
       AND t.status = 'COMPLETED';
    RETURN v_total;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_reconcile: stored balance vs ledger balance.
--   fn_reconcile()      -> every account
--   fn_reconcile(5)     -> one account
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reconcile(p_account_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    account_id     BIGINT,
    account_type   VARCHAR,
    stored_balance BIGINT,
    ledger_balance BIGINT,
    difference     BIGINT,
    is_matching    BOOLEAN
)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
BEGIN
    IF p_account_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.account_id = p_account_id) THEN
        RAISE EXCEPTION 'Account % does not exist', p_account_id USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT a.account_id,
           a.account_type,
           a.balance,
           COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE -l.amount END), 0)::BIGINT,
           (a.balance - COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE -l.amount END), 0))::BIGINT,
           a.balance = COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE -l.amount END), 0)
      FROM accounts a
      LEFT JOIN (SELECT le.account_id, le.entry_type, le.amount
                   FROM ledger_entries le
                   JOIN transactions t ON t.txn_id = le.txn_id AND t.status = 'COMPLETED') l
             ON l.account_id = a.account_id
     WHERE p_account_id IS NULL OR a.account_id = p_account_id
     GROUP BY a.account_id, a.account_type, a.balance
     ORDER BY a.account_id;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_account_statement: statement for ANY account, optional date range,
-- paginated, newest first, with a running balance.
-- running_balance = (stored balance - ledger total) + cumulative movement.
-- The first part is 0 when the ledger fully explains the balance.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_account_statement(
    p_account_id BIGINT,
    p_from       TIMESTAMP DEFAULT NULL,
    p_to         TIMESTAMP DEFAULT NULL,
    p_limit      INT       DEFAULT 50,
    p_offset     INT       DEFAULT 0
)
RETURNS TABLE (
    entry_id        BIGINT,
    txn_id          BIGINT,
    reference_no    VARCHAR,
    txn_type        VARCHAR,
    txn_status      VARCHAR,
    description     VARCHAR,
    entry_type      VARCHAR,
    amount          BIGINT,
    running_balance BIGINT,
    created_at      TIMESTAMP
)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE
    v_opening BIGINT;
    v_limit   INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 1000);
    v_offset  INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    v_opening := fn_account_balance(p_account_id) - fn_ledger_balance(p_account_id);

    RETURN QUERY
    SELECT x.entry_id, x.txn_id, x.reference_no, x.txn_type, x.txn_status, x.description,
           x.entry_type, x.amount, x.running_balance, x.created_at
      FROM (
            SELECT l.entry_id, l.txn_id, t.reference_no, t.txn_type,
                   t.status AS txn_status, t.description, l.entry_type, l.amount,
                   (v_opening + SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE -l.amount END)
                                OVER (ORDER BY l.created_at, l.entry_id))::BIGINT AS running_balance,
                   l.created_at
              FROM ledger_entries l
              JOIN transactions t ON t.txn_id = l.txn_id
             WHERE l.account_id = p_account_id
               AND t.status = 'COMPLETED'
           ) x
     WHERE (p_from IS NULL OR x.created_at >= p_from)
       AND (p_to   IS NULL OR x.created_at <= p_to)
     ORDER BY x.created_at DESC, x.entry_id DESC
     LIMIT v_limit OFFSET v_offset;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_user_summary: per-user totals. NULL = all users.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_user_summary(p_user_id BIGINT DEFAULT NULL)
RETURNS TABLE (
    user_id            BIGINT,
    name               VARCHAR,
    total_accounts     BIGINT,
    active_accounts    BIGINT,
    total_balance      BIGINT,
    total_transactions BIGINT
)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
BEGIN
    IF p_user_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = p_user_id) THEN
        RAISE EXCEPTION 'User % does not exist', p_user_id USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT u.user_id,
           u.name,
           (SELECT COUNT(*) FROM accounts a WHERE a.user_id = u.user_id),
           (SELECT COUNT(*) FROM accounts a WHERE a.user_id = u.user_id AND a.status = 'ACTIVE'),
           (SELECT COALESCE(SUM(a.balance), 0) FROM accounts a WHERE a.user_id = u.user_id)::BIGINT,
           (SELECT COUNT(DISTINCT l.txn_id)
              FROM ledger_entries l
              JOIN accounts a ON a.account_id = l.account_id
             WHERE a.user_id = u.user_id)
      FROM users u
     WHERE p_user_id IS NULL OR u.user_id = p_user_id
     ORDER BY u.user_id;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_transaction_history: all transactions, filterable and paginated.
-- Every filter is optional (NULL = no filter).
-- amount = larger of the transaction's debit and credit totals.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_transaction_history(
    p_status VARCHAR   DEFAULT NULL,
    p_type   VARCHAR   DEFAULT NULL,
    p_from   TIMESTAMP DEFAULT NULL,
    p_to     TIMESTAMP DEFAULT NULL,
    p_limit  INT       DEFAULT 20,
    p_offset INT       DEFAULT 0
)
RETURNS TABLE (
    txn_id       BIGINT,
    reference_no VARCHAR,
    txn_type     VARCHAR,
    status       VARCHAR,
    description  VARCHAR,
    amount       BIGINT,
    created_at   TIMESTAMP
)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
DECLARE
    v_limit  INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 1000);
    v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    RETURN QUERY
    SELECT t.txn_id, t.reference_no, t.txn_type, t.status, t.description,
           COALESCE(GREATEST(SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END),
                             SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END)), 0)::BIGINT,
           t.created_at
      FROM transactions t
      LEFT JOIN ledger_entries l ON l.txn_id = t.txn_id
     WHERE (p_status IS NULL OR t.status   = p_status)
       AND (p_type   IS NULL OR t.txn_type = p_type)
       AND (p_from   IS NULL OR t.created_at >= p_from)
       AND (p_to     IS NULL OR t.created_at <= p_to)
     GROUP BY t.txn_id
     ORDER BY t.created_at DESC, t.txn_id DESC
     LIMIT v_limit OFFSET v_offset;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_volume_by_type: COMPLETED volume per transaction type, optional dates
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_volume_by_type(
    p_from TIMESTAMP DEFAULT NULL,
    p_to   TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (txn_type VARCHAR, txn_count BIGINT, volume BIGINT)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT t.txn_type,
           COUNT(*)::BIGINT,
           SUM(x.vol)::BIGINT
      FROM transactions t
      JOIN (SELECT l.txn_id,
                   GREATEST(SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END),
                            SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END)) AS vol
              FROM ledger_entries l
             GROUP BY l.txn_id) x ON x.txn_id = t.txn_id
     WHERE t.status = 'COMPLETED'
       AND (p_from IS NULL OR t.created_at >= p_from)
       AND (p_to   IS NULL OR t.created_at <= p_to)
     GROUP BY t.txn_type
     ORDER BY t.txn_type;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_txn_is_balanced: TRUE only if the transaction has entries and
-- total DEBIT = total CREDIT.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_txn_is_balanced(p_txn_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_debit  BIGINT;
    v_credit BIGINT;
    v_count  BIGINT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM transactions WHERE txn_id = p_txn_id) THEN
        RAISE EXCEPTION 'Transaction % does not exist', p_txn_id USING ERRCODE = 'P0002';
    END IF;

    SELECT COUNT(*),
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEBIT'),  0),
           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CREDIT'), 0)
      INTO v_count, v_debit, v_credit
      FROM ledger_entries
     WHERE txn_id = p_txn_id;

    RETURN v_count > 0 AND v_debit = v_credit;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_unbalanced_transactions: every COMPLETED transaction (any type) whose
-- debit total differs from its credit total, or that has no entries at all.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_unbalanced_transactions()
RETURNS TABLE (
    txn_id       BIGINT,
    reference_no VARCHAR,
    txn_type     VARCHAR,
    total_debit  BIGINT,
    total_credit BIGINT
)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT t.txn_id, t.reference_no, t.txn_type,
           COALESCE(SUM(l.amount) FILTER (WHERE l.entry_type = 'DEBIT'),  0)::BIGINT,
           COALESCE(SUM(l.amount) FILTER (WHERE l.entry_type = 'CREDIT'), 0)::BIGINT
      FROM transactions t
      LEFT JOIN ledger_entries l ON l.txn_id = t.txn_id
     WHERE t.status = 'COMPLETED'
     GROUP BY t.txn_id
    HAVING COUNT(l.entry_id) = 0
        OR COALESCE(SUM(l.amount) FILTER (WHERE l.entry_type = 'DEBIT'),  0)
        <> COALESCE(SUM(l.amount) FILTER (WHERE l.entry_type = 'CREDIT'), 0)
     ORDER BY t.txn_id;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_run_health_checks: one row per integrity rule, across ALL data.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_run_health_checks()
RETURNS TABLE (check_name TEXT, violations BIGINT, status TEXT)
LANGUAGE plpgsql STABLE AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT c.check_name,
           c.violations,
           CASE WHEN c.violations = 0 THEN 'PASS' ELSE 'FAIL' END
      FROM (
        SELECT 1 AS ord, 'Completed transactions where DEBIT <> CREDIT (or no entries)'::TEXT AS check_name,
               (SELECT COUNT(*) FROM fn_unbalanced_transactions())::BIGINT AS violations
        UNION ALL
        SELECT 2, 'Customer accounts whose stored balance <> ledger balance',
               (SELECT COUNT(*) FROM fn_reconcile() r WHERE NOT r.is_matching AND r.account_type <> 'SYSTEM')
        UNION ALL
        SELECT 3, 'SYSTEM accounts (must be exactly 1)',
               (SELECT ABS(COUNT(*) - 1) FROM accounts WHERE account_type = 'SYSTEM')
        UNION ALL
        SELECT 4, 'Negative balances',
               (SELECT COUNT(*) FROM accounts WHERE balance < 0)
        UNION ALL
        SELECT 5, 'Non-positive ledger amounts',
               (SELECT COUNT(*) FROM ledger_entries WHERE amount <= 0)
        UNION ALL
        SELECT 6, 'Orphan ledger entries',
               (SELECT COUNT(*) FROM ledger_entries l
                 WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.txn_id = l.txn_id)
                    OR NOT EXISTS (SELECT 1 FROM accounts a WHERE a.account_id = l.account_id))
        UNION ALL
        SELECT 7, 'Completed transfers without exactly one DEBIT and one CREDIT',
               (SELECT COUNT(*) FROM (
                   SELECT t.txn_id
                     FROM transactions t
                     LEFT JOIN ledger_entries l ON l.txn_id = t.txn_id
                    WHERE t.txn_type = 'TRANSFER' AND t.status = 'COMPLETED'
                    GROUP BY t.txn_id
                   HAVING COUNT(*) FILTER (WHERE l.entry_type = 'DEBIT')  <> 1
                       OR COUNT(*) FILTER (WHERE l.entry_type = 'CREDIT') <> 1) q)
        UNION ALL
        SELECT 8, 'Global DEBIT total <> CREDIT total (completed transactions)',
               (SELECT CASE WHEN COALESCE(SUM(l.amount) FILTER (WHERE l.entry_type = 'DEBIT'),  0)
                              =  COALESCE(SUM(l.amount) FILTER (WHERE l.entry_type = 'CREDIT'), 0)
                            THEN 0 ELSE 1 END
                  FROM ledger_entries l
                  JOIN transactions t ON t.txn_id = l.txn_id AND t.status = 'COMPLETED')::BIGINT
      ) c
     ORDER BY c.ord;
END;
$$;
