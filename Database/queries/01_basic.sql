-- =====================================================================
-- LedgerCore | Stage 3 | 01_basic.sql  (SELECT, WHERE, ORDER BY, DISTINCT, DML)
-- Money is stored in paise: divide by 100.0 to display rupees.
-- Write queries are wrapped in BEGIN ... ROLLBACK so seed data is untouched.
-- Seed IDs: users 1-4, accounts 1-5, transactions 1-5.
-- =====================================================================

-- Q01: List all users
SELECT user_id, name, email, phone, created_at
FROM users
ORDER BY user_id;

-- Q02: ACTIVE accounts, richest first (balance in rupees)
SELECT account_id, user_id, account_type, balance / 100.0 AS balance_inr, status
FROM accounts
WHERE status = 'ACTIVE'
ORDER BY balance DESC;

-- Q03: Look up one account by ID
SELECT account_id, user_id, account_type, balance, status, created_at
FROM accounts
WHERE account_id = 1;

-- Q04: Find users by email domain (pattern match with ILIKE)
SELECT user_id, name, email
FROM users
WHERE email ILIKE '%@example.com'
ORDER BY name;

-- Q05: DISTINCT - which transaction types exist?
SELECT DISTINCT txn_type
FROM transactions
ORDER BY txn_type;

-- Q06: UPDATE inside a transaction, then ROLLBACK.
-- Also shows the updated_at trigger from schema.sql firing.
BEGIN;
UPDATE accounts SET status = 'BLOCKED' WHERE account_id = 5;
SELECT account_id, status, created_at, updated_at FROM accounts WHERE account_id = 5;
ROLLBACK;
SELECT account_id, status FROM accounts WHERE account_id = 5;   -- back to ACTIVE

-- Q07: INSERT + DELETE inside a transaction, then ROLLBACK (atomicity demo).
-- Note: PostgreSQL sequences are NOT rolled back, so the next real user gets
-- user_id 6 instead of 5. Harmless, but good viva knowledge.
BEGIN;
INSERT INTO users (name, email, phone, password_hash)
VALUES ('Demo User', 'demo.user@example.com', '+919000000000', 'not-a-real-hash');
SELECT user_id, name FROM users WHERE email = 'demo.user@example.com';
DELETE FROM users WHERE email = 'demo.user@example.com';
SELECT COUNT(*) AS demo_rows_left FROM users WHERE email = 'demo.user@example.com';  -- 0
ROLLBACK;
