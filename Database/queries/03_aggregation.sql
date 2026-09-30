-- =====================================================================
-- LedgerCore | Stage 3 | 03_aggregation.sql
-- COUNT, SUM, AVG, MIN, MAX, GROUP BY, HAVING
-- =====================================================================

-- Q14: Number of accounts per status
SELECT status, COUNT(*) AS total_accounts
FROM accounts
GROUP BY status
ORDER BY status;

-- Q15: Balance statistics across all accounts
SELECT COUNT(*)                        AS accounts,
       SUM(balance) / 100.0            AS total_inr,
       ROUND(AVG(balance) / 100.0, 2)  AS average_inr,
       MIN(balance) / 100.0            AS lowest_inr,
       MAX(balance) / 100.0            AS highest_inr
FROM accounts;

-- Q16: Volume and count of COMPLETED transactions per type.
-- Per transaction, volume = the larger of its debit total and credit total.
-- For a balanced transaction both are equal, so this never double-counts,
-- works for any number of entries, and also copes with the current
-- single-sided DEPOSIT rows in seed.sql.
SELECT t.txn_type,
       COUNT(*)                  AS txn_count,
       SUM(x.volume) / 100.0     AS volume_inr
FROM transactions t
JOIN (
    SELECT txn_id,
           GREATEST(
               SUM(CASE WHEN entry_type = 'DEBIT'  THEN amount ELSE 0 END),
               SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END)
           ) AS volume
    FROM ledger_entries
    GROUP BY txn_id
) x ON x.txn_id = t.txn_id
WHERE t.status = 'COMPLETED'
GROUP BY t.txn_type
ORDER BY t.txn_type;

-- Q17: Total debit, credit and net movement per account (from the ledger)
SELECT account_id,
       SUM(CASE WHEN entry_type = 'DEBIT'  THEN amount ELSE 0 END) / 100.0 AS total_debit_inr,
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) / 100.0 AS total_credit_inr,
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) / 100.0 AS net_movement_inr,
       COUNT(*) AS entries
FROM ledger_entries
GROUP BY account_id
ORDER BY account_id;

-- Q18: HAVING - accounts with more than one ledger entry
SELECT account_id, COUNT(*) AS entry_count
FROM ledger_entries
GROUP BY account_id
HAVING COUNT(*) > 1
ORDER BY entry_count DESC, account_id;

-- Q19: Total balance per user, only users holding more than Rs 10,000
-- (1,000,000 paise = Rs 10,000)
SELECT u.user_id, u.name,
       COUNT(a.account_id)      AS accounts,
       SUM(a.balance) / 100.0   AS total_balance_inr
FROM users u
JOIN accounts a ON a.user_id = u.user_id
GROUP BY u.user_id, u.name
HAVING SUM(a.balance) > 1000000
ORDER BY total_balance_inr DESC;

-- Q20: COMPLETED transactions per day
SELECT created_at::date AS txn_date, COUNT(*) AS completed_transactions
FROM transactions
WHERE status = 'COMPLETED'
GROUP BY created_at::date
ORDER BY txn_date;

-- Q21: Transaction status analysis with percentage share
SELECT status,
       COUNT(*) AS transaction_count,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percent_of_total
FROM transactions
GROUP BY status
ORDER BY transaction_count DESC;
