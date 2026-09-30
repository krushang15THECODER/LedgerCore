-- --------------------------------------------------------
-- LedgerCore Seed Data
-- --------------------------------------------------------

-- Clean up any existing data (if tables exist, though schema.sql drops them)
TRUNCATE TABLE idempotency_keys, ledger_entries, transactions, accounts, users RESTART IDENTITY CASCADE;

-- 1. Insert Users
INSERT INTO users (name, email, phone) VALUES
('Alice Smith', 'alice@example.com', '+919876543210'),
('Bob Johnson', 'bob@example.com', '+919876543211'),
('Charlie Brown', 'charlie@example.com', '+919876543212'),
('Diana Prince', 'diana@example.com', '+919876543213');

-- 2. Insert Accounts (Balance in paise: ₹1 = 100 paise)
INSERT INTO accounts (user_id, account_type, balance, status) VALUES
(1, 'SAVINGS', 5000000, 'ACTIVE'), -- Account 1: Alice, ₹50,000
(2, 'CURRENT', 10000000, 'ACTIVE'), -- Account 2: Bob, ₹1,00,000
(3, 'SAVINGS', 0, 'BLOCKED'),       -- Account 3: Charlie, ₹0 (Blocked)
(4, 'SAVINGS', 200000, 'CLOSED'),   -- Account 4: Diana, ₹2,000 (Closed)
(1, 'CURRENT', 1500000, 'ACTIVE');  -- Account 5: Alice, ₹15,000

-- 3. Insert Transactions & Ledger Entries

-- Transaction 1: Alice initial deposit of ₹50,000 (We use CREDIT entry to reflect the deposit)
INSERT INTO transactions (reference_no, txn_type, status, description) VALUES
('TXN-DEP-001', 'DEPOSIT', 'COMPLETED', 'Initial Deposit for Alice');

INSERT INTO ledger_entries (txn_id, account_id, entry_type, amount) VALUES
(1, 1, 'CREDIT', 5000000);

-- Transaction 2: Bob initial deposit of ₹1,00,000
INSERT INTO transactions (reference_no, txn_type, status, description) VALUES
('TXN-DEP-002', 'DEPOSIT', 'COMPLETED', 'Initial Deposit for Bob');

INSERT INTO ledger_entries (txn_id, account_id, entry_type, amount) VALUES
(2, 2, 'CREDIT', 10000000);

-- Transaction 3: Transfer ₹5,000 from Alice (1) to Bob (2) -> fully balanced double-entry
INSERT INTO transactions (reference_no, txn_type, status, description) VALUES
('TXN-TRF-001', 'TRANSFER', 'COMPLETED', 'Rent payment from Alice to Bob');

INSERT INTO ledger_entries (txn_id, account_id, entry_type, amount) VALUES
(3, 1, 'DEBIT', 500000),
(3, 2, 'CREDIT', 500000);

-- Transaction 4: Failed Transfer ₹10,000 from Alice (1) to Charlie (3) (Charlie is blocked)
INSERT INTO transactions (reference_no, txn_type, status, description) VALUES
('TXN-TRF-002', 'TRANSFER', 'FAILED', 'Failed transfer to blocked account');

-- Transaction 5: Transfer ₹1,000 from Bob (2) to Alice Current (5) - Pending
INSERT INTO transactions (reference_no, txn_type, status, description) VALUES
('TXN-TRF-003', 'TRANSFER', 'PENDING', 'Pending transfer Bob to Alice');

-- 4. Insert Idempotency Keys
INSERT INTO idempotency_keys (key, txn_id, expires_at) VALUES
('idem-trf-001', 3, CURRENT_TIMESTAMP + INTERVAL '1 day'),
('idem-trf-002', 4, CURRENT_TIMESTAMP + INTERVAL '1 day');


-- --------------------------------------------------------
-- SQL VERIFICATION QUERIES
-- --------------------------------------------------------
/*
-- 1. List all users
SELECT * FROM users;

-- 2. List all accounts with their users
SELECT a.account_id, u.name, a.account_type, a.balance, a.status 
FROM accounts a
JOIN users u ON a.user_id = u.user_id;

-- 3. List all transactions
SELECT * FROM transactions;

-- 4. List ledger entries
SELECT * FROM ledger_entries;

-- 5. Find accounts with no ledger activity using NOT EXISTS
SELECT * FROM accounts a
WHERE NOT EXISTS (
    SELECT 1 FROM ledger_entries le WHERE le.account_id = a.account_id
);

-- 6. Find completed transactions whose debit total does not equal credit total
SELECT t.txn_id, t.reference_no,
       COALESCE(SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END), 0) AS total_debit,
       COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END), 0) AS total_credit
FROM transactions t
LEFT JOIN ledger_entries le ON t.txn_id = le.txn_id
WHERE t.status = 'COMPLETED' AND t.txn_type = 'TRANSFER'
GROUP BY t.txn_id, t.reference_no
HAVING 
    COALESCE(SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END), 0) != 
    COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END), 0);

-- 7. Calculate total debit and credit for a transaction
SELECT txn_id, 
       SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) AS total_debit,
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) AS total_credit
FROM ledger_entries
GROUP BY txn_id;

-- 8. Find users with multiple accounts
SELECT user_id, COUNT(*) as account_count
FROM accounts
GROUP BY user_id
HAVING COUNT(*) > 1;

-- 9. Find accounts above the average balance
SELECT * FROM accounts
WHERE balance > (SELECT AVG(balance) FROM accounts);

-- 10. Generate an account transaction history using JOINs
SELECT le.created_at, t.reference_no, t.txn_type, le.entry_type, le.amount, t.description
FROM ledger_entries le
JOIN transactions t ON le.txn_id = t.txn_id
WHERE le.account_id = 1
ORDER BY le.created_at DESC;
*/
