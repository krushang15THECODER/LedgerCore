-- =====================================================================
-- LedgerCore | Stage 3 | views.sql
-- Safe to re-run: views are dropped first (dependent views first).
-- =====================================================================
DROP VIEW IF EXISTS account_running_balance;
DROP VIEW IF EXISTS account_reconciliation;
DROP VIEW IF EXISTS account_summary;
DROP VIEW IF EXISTS account_statement;

-- V1: statement lines - one row per ledger entry, with transaction details.
-- signed_amount: +amount for CREDIT, -amount for DEBIT (paise).
CREATE VIEW account_statement AS
SELECT l.account_id,
       l.entry_id,
       l.txn_id,
       t.reference_no,
       t.txn_type,
       t.status      AS txn_status,
       t.description,
       l.entry_type,
       l.amount,
       l.amount / 100.0 AS amount_inr,
       CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE -l.amount END AS signed_amount,
       l.created_at
FROM ledger_entries l
JOIN transactions t ON t.txn_id = l.txn_id;

-- V2: one row per account (dashboard / reporting)
CREATE VIEW account_summary AS
SELECT a.account_id,
       u.name AS owner,
       a.account_type,
       a.status,
       a.balance / 100.0 AS balance_inr,
       COUNT(l.entry_id) AS total_entries
FROM accounts a
JOIN users u ON u.user_id = a.user_id
LEFT JOIN ledger_entries l ON l.account_id = a.account_id
GROUP BY a.account_id, u.name, a.account_type, a.status, a.balance;

-- V3: stored balance vs balance derived from COMPLETED ledger entries.
-- difference <> 0 means the ledger does not explain the stored balance.
CREATE VIEW account_reconciliation AS
SELECT a.account_id,
       a.status,
       a.balance                               AS stored_balance,
       COALESCE(SUM(s.signed_amount), 0)       AS ledger_balance,
       a.balance - COALESCE(SUM(s.signed_amount), 0) AS difference
FROM accounts a
LEFT JOIN account_statement s
       ON s.account_id = a.account_id AND s.txn_status = 'COMPLETED'
GROUP BY a.account_id, a.status, a.balance;

-- V4: running ledger balance (window function).
-- This is net movement since the account's first ledger entry. It equals the
-- true balance only when every opening balance is itself a ledger entry
-- (i.e. when health check H4 returns 0 rows).
CREATE VIEW account_running_balance AS
SELECT account_id, entry_id, txn_id, reference_no, entry_type, amount_inr, created_at,
       SUM(signed_amount) OVER (PARTITION BY account_id ORDER BY created_at, entry_id) / 100.0
           AS running_ledger_balance_inr
FROM account_statement
WHERE txn_status = 'COMPLETED';

-- ---------------- Using the views ----------------
-- Statement for account 1, newest first
SELECT * FROM account_statement WHERE account_id = 1 ORDER BY created_at DESC, entry_id DESC;

-- Dashboard summary
SELECT * FROM account_summary ORDER BY balance_inr DESC;

-- Running balance for account 1
SELECT * FROM account_running_balance WHERE account_id = 1 ORDER BY created_at, entry_id;

-- Last 5 statement lines of account 2
SELECT * FROM account_statement WHERE account_id = 2 ORDER BY created_at DESC, entry_id DESC LIMIT 5;
