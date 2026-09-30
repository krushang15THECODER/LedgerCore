-- =====================================================================
-- LedgerCore | Stage 3 | 02_joins.sql  (INNER JOIN, LEFT JOIN, multi-table)
-- =====================================================================

-- Q08: Users with their accounts (INNER JOIN)
SELECT u.user_id, u.name, a.account_id, a.account_type,
       a.balance / 100.0 AS balance_inr, a.status
FROM users u
INNER JOIN accounts a ON a.user_id = u.user_id
ORDER BY u.user_id, a.account_id;

-- Q09: Users who own NO account (LEFT JOIN + IS NULL)
-- Expected on current seed: 0 rows (every user has an account).
SELECT u.user_id, u.name
FROM users u
LEFT JOIN accounts a ON a.user_id = u.user_id
WHERE a.account_id IS NULL;

-- Q10: Ledger entries of each account
SELECT a.account_id, l.entry_id, l.txn_id, l.entry_type,
       l.amount / 100.0 AS amount_inr, l.created_at
FROM accounts a
INNER JOIN ledger_entries l ON l.account_id = a.account_id
ORDER BY a.account_id, l.entry_id;

-- Q11: Full audit trail - transaction -> entry -> account -> owner (4 tables)
SELECT t.txn_id, t.reference_no, t.txn_type, t.status,
       l.entry_type, l.amount / 100.0 AS amount_inr,
       a.account_id, u.name AS owner
FROM transactions t
JOIN ledger_entries l ON l.txn_id = t.txn_id
JOIN accounts a       ON a.account_id = l.account_id
JOIN users u          ON u.user_id = a.user_id
ORDER BY t.txn_id, l.entry_id;

-- Q12: Sender and receiver of every COMPLETED transfer (same table joined twice)
-- Assumes a valid TRANSFER has exactly one DEBIT and one CREDIT.
-- That assumption is verified separately by health check H8.
SELECT t.reference_no, t.description,
       ud.name AS sender,
       uc.name AS receiver,
       d.amount / 100.0 AS amount_inr
FROM transactions t
JOIN ledger_entries d ON d.txn_id = t.txn_id AND d.entry_type = 'DEBIT'
JOIN ledger_entries c ON c.txn_id = t.txn_id AND c.entry_type = 'CREDIT'
JOIN accounts ad ON ad.account_id = d.account_id
JOIN accounts ac ON ac.account_id = c.account_id
JOIN users ud ON ud.user_id = ad.user_id
JOIN users uc ON uc.user_id = ac.user_id
WHERE t.txn_type = 'TRANSFER' AND t.status = 'COMPLETED';

-- Q13: Accounts that have never had a ledger entry (LEFT JOIN + IS NULL)
-- Compare with Q28, which answers the same question using NOT EXISTS.
SELECT a.account_id, a.account_type, a.status
FROM accounts a
LEFT JOIN ledger_entries l ON l.account_id = a.account_id
WHERE l.entry_id IS NULL
ORDER BY a.account_id;
