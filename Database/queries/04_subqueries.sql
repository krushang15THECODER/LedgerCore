-- =====================================================================
-- LedgerCore | Stage 3 | 04_subqueries.sql
-- Scalar, IN, correlated and derived-table subqueries
-- =====================================================================

-- Q22: Accounts with balance above the average (scalar subquery)
SELECT account_id, user_id, balance / 100.0 AS balance_inr
FROM accounts
WHERE balance > (SELECT AVG(balance) FROM accounts)
ORDER BY balance DESC;

-- Q23: Account(s) with the highest balance (returns ties too)
SELECT account_id, balance / 100.0 AS balance_inr
FROM accounts
WHERE balance = (SELECT MAX(balance) FROM accounts);

-- Q24: Users who own an account that has at least one DEBIT entry (nested IN)
SELECT name, email
FROM users
WHERE user_id IN (
    SELECT a.user_id
    FROM accounts a
    WHERE a.account_id IN (
        SELECT account_id FROM ledger_entries WHERE entry_type = 'DEBIT'
    )
);

-- Q25: Correlated - accounts at or above the average of THEIR OWN user's accounts
SELECT a.account_id, a.user_id, a.balance / 100.0 AS balance_inr
FROM accounts a
WHERE a.balance >= (
    SELECT AVG(a2.balance) FROM accounts a2 WHERE a2.user_id = a.user_id
)
ORDER BY a.user_id, a.account_id;

-- Q26: Derived table - accounts busier than the average account
-- (average = total entries / total accounts, so idle accounts count as 0)
SELECT x.account_id, x.entry_count
FROM (
    SELECT a.account_id, COUNT(l.entry_id) AS entry_count
    FROM accounts a
    LEFT JOIN ledger_entries l ON l.account_id = a.account_id
    GROUP BY a.account_id
) x
WHERE x.entry_count > (SELECT COUNT(*) FROM ledger_entries)::numeric
                    / (SELECT COUNT(*) FROM accounts)
ORDER BY x.entry_count DESC;

-- Q27: Largest single ledger entry
SELECT entry_id, txn_id, account_id, entry_type, amount / 100.0 AS amount_inr
FROM ledger_entries
WHERE amount = (SELECT MAX(amount) FROM ledger_entries);
