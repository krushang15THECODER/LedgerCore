-- =====================================================================
-- LedgerCore | PL/pgSQL | 05_usage_examples.sql
-- How the PL/pgSQL layer replaces the old hardcoded queries
-- (account_id = 1 ...). Nothing here is tied to specific data.
-- Read-only except where marked; safe to run any time.
-- =====================================================================

-- U1: statement of ANY account (replaces: WHERE account_id = 1)
SELECT * FROM fn_account_statement(1);
SELECT * FROM fn_account_statement(2, p_limit => 5);
-- same, but restricted to a date range
SELECT * FROM fn_account_statement(1, p_from => DATE '2026-01-01', p_to => LOCALTIMESTAMP);

-- U2: statements of EVERY account in one query (the function runs once per account)
SELECT a.account_id, s.reference_no, s.entry_type, fn_format_inr(s.amount) AS amount,
       fn_format_inr(s.running_balance) AS balance
FROM accounts a
CROSS JOIN LATERAL fn_account_statement(a.account_id) s
ORDER BY a.account_id, s.created_at DESC, s.entry_id DESC;

-- U3: per-user totals for all users, or one user
SELECT * FROM fn_user_summary();
SELECT * FROM fn_user_summary(1);

-- U4: reconciliation for all accounts, then only the ones that do NOT match
SELECT * FROM fn_reconcile();
SELECT * FROM fn_reconcile() WHERE NOT is_matching;

-- U5: transaction history with optional filters and pagination
SELECT * FROM fn_transaction_history();                                   -- latest 20
SELECT * FROM fn_transaction_history(p_status => 'COMPLETED');
SELECT * FROM fn_transaction_history(p_type => 'TRANSFER', p_limit => 10, p_offset => 10);

-- U6: volume per transaction type (optionally for a period)
SELECT txn_type, txn_count, fn_format_inr(volume) AS volume FROM fn_volume_by_type();

-- U7: integrity checks across ALL data
SELECT * FROM fn_run_health_checks();
SELECT * FROM fn_unbalanced_transactions();
CALL sp_run_health_report();            -- same checks, printed as messages

-- U8: cursor-based statement printout (see the Messages tab in pgAdmin)
CALL sp_print_account_statement(2);

-- U9: moving money - WRITE operations. Wrap in BEGIN/ROLLBACK to try them
-- without changing data:
BEGIN;
CALL sp_deposit(1, 100000, 'salary', NULL, NULL);            -- INR 1,000.00
CALL sp_withdraw(1, 25000, 'atm', NULL, NULL);               -- INR 250.00
CALL sp_transfer(1, 2, 50000, 'rent', 'my-unique-key-1', NULL);
CALL sp_transfer(1, 2, 50000, 'rent', 'my-unique-key-1', NULL);   -- replay: no second transfer
SELECT * FROM fn_account_statement(1, p_limit => 5);
ROLLBACK;
