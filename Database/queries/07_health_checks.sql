-- =====================================================================
-- LedgerCore | Stage 3 | 07_health_checks.sql   (run views.sql first)
-- H1, H3, H5-H8 must ALWAYS return 0 rows.
-- H2 and H4 currently return rows on the provided seed.sql - see notes.
-- =====================================================================

-- H1: COMPLETED TRANSFERS where DEBIT <> CREDIT  -> must be 0 rows
SELECT t.txn_id, t.reference_no,
       SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END) AS total_debit,
       SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END) AS total_credit
FROM transactions t
JOIN ledger_entries l ON l.txn_id = t.txn_id
WHERE t.status = 'COMPLETED' AND t.txn_type = 'TRANSFER'
GROUP BY t.txn_id, t.reference_no
HAVING SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END)
    <> SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END);

-- H2: COMPLETED transactions of ANY type where DEBIT <> CREDIT (core invariant)
-- CURRENT SEED: returns TXN-DEP-001 and TXN-DEP-002, because the seed records
-- each deposit as a single CREDIT with no matching DEBIT.
-- TARGET: 0 rows once Stage 4 deposits/withdrawals use a system counter-account.
SELECT t.txn_id, t.reference_no, t.txn_type,
       SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END) AS total_debit,
       SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END) AS total_credit
FROM transactions t
JOIN ledger_entries l ON l.txn_id = t.txn_id
WHERE t.status = 'COMPLETED'
GROUP BY t.txn_id, t.reference_no, t.txn_type
HAVING SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END)
    <> SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END);

-- H3: COMPLETED transactions with no ledger entries -> must be 0 rows
SELECT t.txn_id, t.reference_no
FROM transactions t
WHERE t.status = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.txn_id = t.txn_id);

-- H4: Reconciliation - stored balance vs ledger-derived balance
-- CURRENT SEED: returns accounts 1, 2, 4, 5
--   acct 1: stored 5,000,000 vs ledger 4,500,000 (seed never subtracted the transfer)
--   acct 2: stored 10,000,000 vs ledger 10,500,000 (seed never added the transfer)
--   acct 4, 5: have balances but no ledger entries at all
-- TARGET: 0 rows once the seed/opening-balance model is fixed.
SELECT * FROM account_reconciliation WHERE difference <> 0 ORDER BY account_id;

-- H5: Negative balances -> must be 0 rows (also blocked by CHECK in schema)
SELECT account_id, balance FROM accounts WHERE balance < 0;

-- H6: Non-positive ledger amounts -> must be 0 rows (also blocked by CHECK)
SELECT entry_id, amount FROM ledger_entries WHERE amount <= 0;

-- H7: Orphan ledger entries -> must be 0 rows.
-- Foreign keys already prevent these; this is a defence-in-depth audit query.
SELECT l.entry_id
FROM ledger_entries l
WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.txn_id = l.txn_id)
   OR NOT EXISTS (SELECT 1 FROM accounts a     WHERE a.account_id = l.account_id);

-- H8: COMPLETED transfers without exactly one DEBIT and one CREDIT -> 0 rows
-- (LEFT JOIN so a transfer with no entries at all is caught as well)
SELECT t.txn_id, t.reference_no
FROM transactions t
LEFT JOIN ledger_entries l ON l.txn_id = t.txn_id
WHERE t.txn_type = 'TRANSFER' AND t.status = 'COMPLETED'
GROUP BY t.txn_id, t.reference_no
HAVING COUNT(*) FILTER (WHERE l.entry_type = 'DEBIT')  <> 1
    OR COUNT(*) FILTER (WHERE l.entry_type = 'CREDIT') <> 1;

-- H9 (informational): idempotency keys, their transaction and expiry state
SELECT k.key, k.txn_id, t.reference_no, t.status AS txn_status, k.expires_at,
       CASE WHEN k.expires_at > CURRENT_TIMESTAMP THEN 'VALID' ELSE 'EXPIRED' END AS key_state
FROM idempotency_keys k
JOIN transactions t ON t.txn_id = k.txn_id
ORDER BY k.created_at;
