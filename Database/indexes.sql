-- =====================================================================
-- LedgerCore | Stage 3 | indexes.sql
-- schema.sql ALREADY creates these indexes - do not create them again:
--   idx_accounts_user_id, idx_ledger_entries_account_id,
--   idx_ledger_entries_txn_id, idx_transactions_created_at,
--   idx_transactions_reference_no
-- PRIMARY KEY and UNIQUE columns (users.email, users.phone,
-- transactions.reference_no, idempotency_keys.key/txn_id) are auto-indexed.
-- Note: idx_transactions_reference_no duplicates the index that
-- reference_no UNIQUE already created. Optional cleanup:
--   DROP INDEX IF EXISTS idx_transactions_reference_no;
-- =====================================================================

-- New: composite index for account statements / history
-- (WHERE account_id = ? ORDER BY created_at)
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_created
    ON ledger_entries (account_id, created_at);

-- List every index in the database (screenshot this for the report)
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
