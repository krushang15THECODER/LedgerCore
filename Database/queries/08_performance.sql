-- =====================================================================
-- LedgerCore | Stage 3 | 08_performance.sql   (EXPLAIN ANALYZE demo)
-- DEMONSTRATION ONLY - not part of normal setup. Run the whole file at once.
-- It builds temporary data (5,000 users/accounts + 200,000 ledger entries),
-- compares query plans without and with an index on ledger_entries.account_id,
-- then ROLLBACKs. Rollback also restores every dropped index.
-- Data is spread over 5,000 accounts so one account matches ~0.02% of rows;
-- with only 5 accounts an index would (correctly) never be chosen.
-- =====================================================================
BEGIN;

INSERT INTO users (name, email, phone)
SELECT 'Perf User ' || g, 'perf' || g || '@example.com', '+91700' || lpad(g::text, 7, '0')
FROM generate_series(1, 5000) g;

INSERT INTO accounts (user_id, account_type, balance, status)
SELECT user_id, 'SAVINGS', 0, 'ACTIVE' FROM users WHERE email LIKE 'perf%@example.com';

INSERT INTO ledger_entries (txn_id, account_id, entry_type, amount)
SELECT (SELECT MIN(txn_id) FROM transactions),
       a.ids[1 + (g % array_length(a.ids, 1))],
       'CREDIT',
       1 + (g % 5000)
FROM generate_series(1, 200000) g
CROSS JOIN (SELECT array_agg(account_id) AS ids FROM accounts) a;

-- Remove every index that could serve "WHERE account_id = ?"
DROP INDEX IF EXISTS idx_ledger_entries_account_id;
DROP INDEX IF EXISTS idx_ledger_entries_account_created;
ANALYZE ledger_entries;

-- BEFORE: expect "Seq Scan on ledger_entries"
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM ledger_entries
WHERE account_id = (SELECT MAX(account_id) FROM accounts);

CREATE INDEX idx_ledger_entries_account_id ON ledger_entries (account_id);
ANALYZE ledger_entries;

-- AFTER: expect "Index Scan" or "Bitmap Index Scan" and a much lower time
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM ledger_entries
WHERE account_id = (SELECT MAX(account_id) FROM accounts);

ROLLBACK;

-- Sequences are NOT rolled back. Reset them so the next real user/account/entry
-- gets the next sequential ID instead of jumping past 5,000 / 200,000.
SELECT setval(pg_get_serial_sequence('users', 'user_id'),          (SELECT MAX(user_id)  FROM users));
SELECT setval(pg_get_serial_sequence('accounts', 'account_id'),    (SELECT MAX(account_id) FROM accounts));
SELECT setval(pg_get_serial_sequence('ledger_entries', 'entry_id'),(SELECT MAX(entry_id) FROM ledger_entries));
