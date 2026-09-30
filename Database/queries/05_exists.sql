-- =====================================================================
-- LedgerCore | Stage 3 | 05_exists.sql   (EXISTS / NOT EXISTS)
-- =====================================================================

-- Q28: Accounts that have NEVER had a ledger entry
SELECT a.account_id, a.account_type, a.status
FROM accounts a
WHERE NOT EXISTS (
    SELECT 1 FROM ledger_entries l WHERE l.account_id = a.account_id
)
ORDER BY a.account_id;

-- Q29: Users with at least one ACTIVE account
SELECT u.user_id, u.name
FROM users u
WHERE EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.user_id = u.user_id AND a.status = 'ACTIVE'
);

-- Q30: Users who own NO account (expected on current seed: 0 rows)
SELECT u.user_id, u.name
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.user_id = u.user_id
);

-- Q31: Accounts with at least one CREDIT entry and no DEBIT entry
SELECT a.account_id
FROM accounts a
WHERE EXISTS (
        SELECT 1 FROM ledger_entries l
        WHERE l.account_id = a.account_id AND l.entry_type = 'CREDIT')
  AND NOT EXISTS (
        SELECT 1 FROM ledger_entries l
        WHERE l.account_id = a.account_id AND l.entry_type = 'DEBIT');

-- Q32: COMPLETED transactions that have no ledger entries (must be 0 rows).
-- FAILED / PENDING transactions legitimately have no entries, so they are excluded.
SELECT t.txn_id, t.reference_no
FROM transactions t
WHERE t.status = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.txn_id = t.txn_id);
