-- =====================================================================
-- LedgerCore | PL/pgSQL | 04_tests.sql
-- Self-checking tests. Everything runs inside one transaction that is
-- ROLLED BACK at the end, so your data is untouched.
-- Assumes the provided seed.sql: accounts 1,2,5 ACTIVE, 3 BLOCKED,
-- 4 CLOSED, 6 SYSTEM.  Each test prints PASS or aborts with an error.
-- Run:  psql -d ledgercore -v ON_ERROR_STOP=1 -f Database/plpgsql/04_tests.sql
-- =====================================================================
BEGIN;

-- T1 deposit: balance +amount, SYSTEM -amount, exactly 2 entries, balanced
DO $$
DECLARE
    v_txn BIGINT; v_b1 BIGINT; v_s1 BIGINT; v_b2 BIGINT; v_s2 BIGINT;
BEGIN
    v_b1 := fn_account_balance(1);  v_s1 := fn_account_balance(fn_system_account_id());
    CALL sp_deposit(1, 25000, 'test deposit', NULL, v_txn);
    v_b2 := fn_account_balance(1);  v_s2 := fn_account_balance(fn_system_account_id());
    ASSERT v_b2 = v_b1 + 25000, 'account balance should rise by 25000';
    ASSERT v_s2 = v_s1 - 25000, 'SYSTEM balance should fall by 25000';
    ASSERT (SELECT COUNT(*) FROM ledger_entries WHERE txn_id = v_txn) = 2, 'deposit needs 2 entries';
    ASSERT fn_txn_is_balanced(v_txn), 'deposit must be balanced';
    ASSERT (SELECT status FROM transactions WHERE txn_id = v_txn) = 'COMPLETED', 'deposit must be COMPLETED';
    RAISE NOTICE 'PASS T1 deposit';
END; $$;

-- T2 withdrawal
DO $$
DECLARE v_txn BIGINT; v_b1 BIGINT;
BEGIN
    v_b1 := fn_account_balance(1);
    CALL sp_withdraw(1, 10000, 'test withdrawal', NULL, v_txn);
    ASSERT fn_account_balance(1) = v_b1 - 10000, 'balance should fall by 10000';
    ASSERT fn_txn_is_balanced(v_txn), 'withdrawal must be balanced';
    RAISE NOTICE 'PASS T2 withdrawal';
END; $$;

-- T3 transfer between two customer accounts
DO $$
DECLARE v_txn BIGINT; v_a BIGINT; v_b BIGINT;
BEGIN
    v_a := fn_account_balance(1); v_b := fn_account_balance(2);
    CALL sp_transfer(1, 2, 40000, 'test transfer', NULL, v_txn);
    ASSERT fn_account_balance(1) = v_a - 40000, 'sender balance';
    ASSERT fn_account_balance(2) = v_b + 40000, 'receiver balance';
    ASSERT fn_txn_is_balanced(v_txn), 'transfer must be balanced';
    RAISE NOTICE 'PASS T3 transfer';
END; $$;

-- T4 insufficient balance is rejected and leaves no trace
DO $$
DECLARE v_txn BIGINT; v_before BIGINT; v_failed BOOLEAN := FALSE;
BEGIN
    v_before := (SELECT COUNT(*) FROM ledger_entries);
    BEGIN
        CALL sp_withdraw(1, 999999999999, NULL, NULL, v_txn);
    EXCEPTION WHEN OTHERS THEN
        v_failed := TRUE;
        ASSERT SQLERRM LIKE 'Insufficient balance%', 'unexpected error: ' || SQLERRM;
    END;
    ASSERT v_failed, 'overdraft must fail';
    ASSERT (SELECT COUNT(*) FROM ledger_entries) = v_before, 'no ledger rows may be left behind';
    RAISE NOTICE 'PASS T4 insufficient balance + rollback';
END; $$;

-- T5 invalid operations: same account, zero/negative amount, blocked, closed,
--    missing account, transfer touching SYSTEM
DO $$
DECLARE
    v_txn BIGINT; v_case TEXT; v_failed BOOLEAN;
    v_sys BIGINT := fn_system_account_id();
BEGIN
    FOREACH v_case IN ARRAY ARRAY['same','zero','negative','blocked_to','closed_from','missing','system_to']
    LOOP
        v_failed := FALSE;
        BEGIN
            CASE v_case
                WHEN 'same'        THEN CALL sp_transfer(1, 1, 100, NULL, NULL, v_txn);
                WHEN 'zero'        THEN CALL sp_transfer(1, 2, 0, NULL, NULL, v_txn);
                WHEN 'negative'    THEN CALL sp_transfer(1, 2, -5, NULL, NULL, v_txn);
                WHEN 'blocked_to'  THEN CALL sp_transfer(1, 3, 100, NULL, NULL, v_txn);
                WHEN 'closed_from' THEN CALL sp_withdraw(4, 100, NULL, NULL, v_txn);
                WHEN 'missing'     THEN CALL sp_transfer(1, 999999, 100, NULL, NULL, v_txn);
                WHEN 'system_to'   THEN CALL sp_transfer(1, v_sys, 100, NULL, NULL, v_txn);
            END CASE;
        EXCEPTION WHEN OTHERS THEN
            v_failed := TRUE;
        END;
        ASSERT v_failed, 'case "' || v_case || '" should have been rejected';
    END LOOP;
    RAISE NOTICE 'PASS T5 invalid operations rejected (7 cases)';
END; $$;

-- T6 idempotency: same key twice => same txn, applied once
DO $$
DECLARE v1 BIGINT; v2 BIGINT; v_bal BIGINT;
BEGIN
    CALL sp_deposit(5, 7000, 'idem', 'idem-test-key-1', v1);
    v_bal := fn_account_balance(5);
    CALL sp_deposit(5, 7000, 'idem', 'idem-test-key-1', v2);
    ASSERT v1 = v2, 'replay must return the original txn id';
    ASSERT fn_account_balance(5) = v_bal, 'replay must not move money again';
    ASSERT (SELECT COUNT(*) FROM idempotency_keys WHERE key = 'idem-test-key-1') = 1, 'one key row';
    RAISE NOTICE 'PASS T6 idempotency';
END; $$;

-- T7 immutable ledger
DO $$
DECLARE v_failed BOOLEAN := FALSE;
BEGIN
    BEGIN UPDATE ledger_entries SET amount = amount + 1 WHERE entry_id = 1;
    EXCEPTION WHEN integrity_constraint_violation THEN v_failed := TRUE; END;
    ASSERT v_failed, 'UPDATE on ledger must be blocked';

    v_failed := FALSE;
    BEGIN DELETE FROM ledger_entries WHERE entry_id = 1;
    EXCEPTION WHEN integrity_constraint_violation THEN v_failed := TRUE; END;
    ASSERT v_failed, 'DELETE on ledger must be blocked';
    RAISE NOTICE 'PASS T7 immutable ledger';
END; $$;

-- T8 completion guard: cannot complete an empty/unbalanced transaction,
--    and a completed transaction is final
DO $$
DECLARE v_id BIGINT; v_failed BOOLEAN := FALSE;
BEGIN
    INSERT INTO transactions (reference_no, txn_type, status)
    VALUES ('TEST-EMPTY-1', 'TRANSFER', 'PENDING') RETURNING txn_id INTO v_id;
    BEGIN UPDATE transactions SET status = 'COMPLETED' WHERE txn_id = v_id;
    EXCEPTION WHEN integrity_constraint_violation THEN v_failed := TRUE; END;
    ASSERT v_failed, 'empty transaction must not complete';

    v_failed := FALSE;
    BEGIN UPDATE transactions SET status = 'FAILED' WHERE txn_id = 3;   -- seed txn 3 is COMPLETED
    EXCEPTION WHEN integrity_constraint_violation THEN v_failed := TRUE; END;
    ASSERT v_failed, 'completed transaction must be final';
    RAISE NOTICE 'PASS T8 completion guard';
END; $$;

-- T9 status workflow + audit trail
DO $$
DECLARE v_acc BIGINT; v_failed BOOLEAN := FALSE;
BEGIN
    CALL sp_set_account_status(5, 'BLOCKED');
    CALL sp_set_account_status(5, 'ACTIVE');
    ASSERT (SELECT COUNT(*) FROM account_status_audit WHERE account_id = 5) = 2, 'two audit rows expected';

    BEGIN CALL sp_set_account_status(5, 'CLOSED');           -- balance is not zero
    EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
    ASSERT v_failed, 'cannot close an account that holds money';

    v_failed := FALSE;
    BEGIN CALL sp_set_account_status(4, 'ACTIVE');           -- CLOSED is final
    EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
    ASSERT v_failed, 'CLOSED account cannot reopen';

    v_failed := FALSE;
    BEGIN CALL sp_set_account_status(fn_system_account_id(), 'BLOCKED');
    EXCEPTION WHEN OTHERS THEN v_failed := TRUE; END;
    ASSERT v_failed, 'SYSTEM account status is fixed';

    CALL sp_open_account(1, 'SAVINGS', v_acc);
    ASSERT v_acc IS NOT NULL AND fn_account_balance(v_acc) = 0, 'new account starts at 0';
    RAISE NOTICE 'PASS T9 status workflow, audit, open account';
END; $$;

-- T10 the operations above must not have created any new inconsistency
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT * FROM fn_run_health_checks() LOOP
        IF r.check_name LIKE 'Customer accounts whose stored balance%' THEN
            CONTINUE;   -- known seed inconsistency (accounts 1,2,4,5), see notes
        END IF;
        ASSERT r.status = 'PASS', 'health check failed: ' || r.check_name;
    END LOOP;
    ASSERT (SELECT difference FROM fn_reconcile(5)) = 1500000, 'account 5 gap unchanged by balanced operations';
    RAISE NOTICE 'PASS T10 health checks (only the known seed gap remains)';
END; $$;

-- Show the cursor-based statement and the report once
CALL sp_print_account_statement(1);
CALL sp_run_health_report();

ROLLBACK;
