-- =====================================================================
-- LedgerCore | Stage 3 | 06_reporting.sql   (CASE, COALESCE, pagination)
-- =====================================================================

-- Q33: CASE - classify accounts by balance (thresholds in paise)
SELECT account_id,
       balance / 100.0 AS balance_inr,
       CASE
           WHEN balance = 0       THEN 'ZERO'
           WHEN balance < 100000  THEN 'LOW'      -- below Rs 1,000
           WHEN balance < 1000000 THEN 'MEDIUM'   -- below Rs 10,000
           ELSE 'HIGH'
       END AS balance_category
FROM accounts
ORDER BY balance DESC;

-- Q34: COALESCE - activity of EVERY account, including accounts with no entries
SELECT a.account_id, a.status,
       COUNT(l.entry_id)                    AS entries,
       COALESCE(SUM(l.amount), 0) / 100.0   AS total_activity_inr
FROM accounts a
LEFT JOIN ledger_entries l ON l.account_id = a.account_id
GROUP BY a.account_id, a.status
ORDER BY a.account_id;

-- Q35: Pagination for the transaction-history API/frontend (page size 3 here).
-- Page 1 -> OFFSET 0, page 2 -> OFFSET 3, page 3 -> OFFSET 6 ...
-- txn_id is a tie-breaker: seed rows share one created_at, and without a
-- unique tie-breaker the page boundaries would be unstable.
SELECT txn_id, reference_no, txn_type, status, created_at
FROM transactions
ORDER BY created_at DESC, txn_id DESC
LIMIT 3 OFFSET 0;

SELECT txn_id, reference_no, txn_type, status, created_at
FROM transactions
ORDER BY created_at DESC, txn_id DESC
LIMIT 3 OFFSET 3;
