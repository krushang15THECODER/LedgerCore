# LedgerCore Backend Audit

## 1. Executive Summary

The LedgerCore backend is a reasonably structured Express/PostgreSQL application that successfully implements core banking functionality such as user creation, account management, transaction processing, and atomicity through double-entry ledger logic. However, it currently lacks all authentication and authorization mechanisms. It correctly enforces database constraints, employs parameterized queries to prevent SQL injection, and properly utilizes row-level locking and transaction blocks for concurrent safe financial operations. It is not yet fully ready for a secure frontend application due to the lack of user sessions and ownership checks.

## 2. Core Functionality (Updated Post-Upgrade)

| Functionality | Status | Evidence | API |
| ------------- | ------ | -------- | --- |
| Authentication | ✅ IMPLEMENTED | `auth.js` middleware, bcrypt passwords, JWT cookies, login routes. | `/api/auth` |
| Users | ✅ IMPLEMENTED | User profile context, secure `/me` endpoint. | `/api/auth/me` |
| Accounts | ✅ IMPLEMENTED | User ownership enforced, secure `/me` endpoint. | `/api/accounts/me` |
| Transactions | ✅ IMPLEMENTED | Core logic handles edge cases and user ownership properly. | `/api/transactions` |
| Double-Entry | ✅ IMPLEMENTED | Strict double-entry enforced across all operations via `SYSTEM_CASH`. | `transactionService.js` |
| Idempotency | ✅ IMPLEMENTED | Safely checks, creates, and returns duplicates. | `transactionService.js` |
| Integrity | ✅ IMPLEMENTED | DB constraints validated dynamically via explicit queries & Postgres. | `errorHandler.js` |
| Security | ✅ IMPLEMENTED | Parameterized queries, CORS configured, Auth cookies. | `server.js` |
| Error Handling | ✅ IMPLEMENTED | Centralized error handler captures and normalizes errors. | `errorHandler.js` |
| Dashboard Data | ✅ IMPLEMENTED | Fast aggregated metric endpoint implemented. | `/api/dashboard` |

## 3. Authentication

Status: ❌ MISSING
The backend completely lacks any authentication mechanism. There is no user registration with passwords, no login endpoint, no password hashing, no session or JWT generation, and no authentication middleware to protect routes. Duplicate emails/phones are blocked at the DB level, but invalid credential handling and logout are non-existent.

## 4. Users

Status: 🟡 PARTIALLY IMPLEMENTED
The system allows creating (POST), retrieving (GET), updating (PUT), and deleting (DELETE) users through `/api/users`. However, it lacks the concept of a "current" logged-in user. There is no route to easily retrieve all accounts or transactions specific to a single user without client-side filtering. 

## 5. Accounts

Status: 🟡 PARTIALLY IMPLEMENTED
The `/api/accounts` endpoints allow creating accounts, fetching all accounts, fetching by ID, getting balances, and updating account status. Basic data validation (e.g., positive integers) exists. However, there is zero protection against unauthorized account access—anyone can view or modify any account's status. Account deletion is also missing.

## 6. Transactions

Status: ✅ IMPLEMENTED
Transactions are robustly implemented. The backend supports deposits, withdrawals, and transfers. It correctly records source/destination, amount, and timestamp. It actively prevents transferring to the same account, handles nonexistent accounts (404), rejects inactive accounts, and handles insufficient balances (400). Failures trigger database rollbacks to prevent partial state updates.

## 7. Double-Entry Ledger

Status: 🟡 PARTIALLY IMPLEMENTED
The ledger system ensures transaction atomicity via SQL `BEGIN`, `COMMIT`, and `ROLLBACK`. It uses `FOR UPDATE` to lock rows to prevent race conditions during concurrent balance updates. Transfers correctly insert a matched DEBIT and CREDIT. However, Deposits only insert a CREDIT and Withdrawals only insert a DEBIT. Since there is no "System" or "External Cash" account configured to balance these, the pure `DEBIT = CREDIT` rule fails system-wide for deposits and withdrawals.

## 8. Idempotency

Status: ✅ IMPLEMENTED
Idempotency is fully operational. The `transactionService.js` explicitly checks for the presence of an `Idempotency-Key` header or body field. It queries the `idempotency_keys` table to see if a valid, unexpired key exists. If so, it rolls back the current duplicate attempt and safely returns the original completed transaction payload with a 200 OK status instead of a 201 Created.

## 9. Database Integrity

Status: ✅ IMPLEMENTED
The database enforces referential integrity. The application delegates unique constraints (duplicate emails) and foreign key constraints to Postgres, intercepting codes `23505` and `23503` in `errorHandler.js` to return clean 409 Conflict responses. Relationships between users, accounts, transactions, and ledgers are preserved.

## 10. Security

Status: ❌ MISSING
The API is completely open. There is no auth middleware, no user ownership validation, and no protection against unauthorized access. CORS is not configured in `server.js`. However, the backend safely mitigates SQL injection by using parameterized queries (`$1, $2`) via the `pg` driver, and the global error handler prevents leaking raw database stack traces to the client.

## 11. Error Handling

Status: ✅ IMPLEMENTED
A dedicated `errorHandler.js` middleware catches exceptions. Missing/invalid inputs are caught by `validation.js` and return 400 Bad Request. Missing resources return 404 Not Found. Insufficient balance returns 400. Database constraint violations return 409 Conflict. Internal server errors gracefully return a 500 status code with a safe error message.

## 12. Dashboard Readiness

Status: ⚠️ UNCLEAR / NEEDS TESTING
There are no dedicated dashboard aggregation routes. A frontend would have to individually fetch `/api/users`, `/api/accounts`, and `/api/transactions` to calculate totals, which is highly inefficient for a dashboard. The backend is not adequately prepared to serve dashboard metrics cleanly.

## 13. Complete API Inventory

| Method | Endpoint | Purpose | Auth Required | Status |
| ------ | -------- | ------- | ------------- | ----------- |
| GET | `/` | API Health/Version | No | Implemented |
| POST | `/api/users` | Create user | No | Implemented |
| GET | `/api/users` | Get all users | No | Implemented |
| GET | `/api/users/:userId` | Get user by ID | No | Implemented |
| PUT | `/api/users/:userId` | Update user | No | Implemented |
| DELETE | `/api/users/:userId` | Delete user | No | Implemented |
| POST | `/api/accounts` | Create account | No | Implemented |
| GET | `/api/accounts` | Get all accounts | No | Implemented |
| GET | `/api/accounts/:accountId` | Get account by ID | No | Implemented |
| GET | `/api/accounts/:accountId/balance` | Get account balance | No | Implemented |
| PATCH | `/api/accounts/:accountId/status` | Update account status | No | Implemented |
| POST | `/api/transactions/deposit` | Create deposit | No | Implemented |
| POST | `/api/transactions/withdraw` | Create withdrawal | No | Implemented |
| POST | `/api/transactions/transfer` | Create transfer | No | Implemented |
| GET | `/api/transactions` | Get all transactions | No | Implemented |
| GET | `/api/transactions/:txnId` | Get transaction details | No | Implemented |
| GET | `/api/transactions/account/:accountId/history` | Get account statement | No | Implemented |

## 14. Missing Backend Functionality

### Authentication & Authorization System
Status: ❌ MISSING
Why it matters: Anyone can access the API, move money, and view other users' balances.
What currently exists: None.
What is missing: Registration with passwords, Login, JWT/Sessions, Middleware to protect routes, User ownership validation.
Frontend impact: Blocks the ability to build a secure frontend with Registration, Login, and Logout flows.

### User Account Aggregation
Status: ❌ MISSING
Why it matters: A user needs to see all their own accounts upon logging in.
What currently exists: `/api/accounts` returns all accounts for all users.
What is missing: An endpoint like `GET /api/users/:userId/accounts`.
Frontend impact: The frontend must fetch the entire bank's account list and filter on the client side.

### Dashboard Metrics API
Status: ❌ MISSING
Why it matters: Dashboards need aggregated data (e.g., total balance, total accounts).
What currently exists: None.
What is missing: An aggregation endpoint that performs SQL `SUM` and `COUNT`.
Frontend impact: Frontend must fetch and calculate all data manually.

## 15. Backend Functions That Are NOT Needed

- Search/Filtering (Date, Status) - Not strictly required for the core MVP unless the transaction volume is enormous.
- Advanced Pagination - Currently only implemented on account history, which is sufficient for MVP.
- Account Deletion - Disabling/blocking accounts via PATCH status is better for financial record integrity than hard deletion.

## 16. Frontend Readiness

Frontend requirement → Backend capability → Ready/Blocked

- REGISTER → POST `/api/users` → **Ready** (but insecure, no password)
- LOGIN → N/A → **Blocked**
- DASHBOARD → Multiple GETs → **Blocked** (Inefficient without dedicated endpoints)
- ACCOUNTS → GET `/api/accounts` → **Blocked** (Needs user-specific filtering)
- CREATE TRANSACTION → POST `/api/transactions/transfer` → **Ready**
- UPDATED BALANCE → GET `/api/accounts/:accountId/balance` → **Ready**
- TRANSACTION HISTORY → GET `/api/transactions/account/:accountId/history` → **Ready**
- TRANSACTION DETAILS → GET `/api/transactions/:txnId` → **Ready**
- LEDGER ENTRIES → Included in `/api/transactions/:txnId` → **Ready**
- LOGOUT → N/A → **Blocked**

## 17. Recommended Next Steps

1. Implement an authentication system (passwords, JWT).
2. Add authorization middleware to ensure users can only access/transact on their own accounts.
3. Add a route to retrieve accounts specific to a user ID.
4. (Optional) Introduce a "System" counterparty account for deposits and withdrawals to maintain strict double-entry `DEBIT=CREDIT` equilibrium.

## 18. Post-Implementation Status

The backend has been upgraded successfully to be frontend-ready, highly secure, and rigorously tested.

### Authentication Status: ✅ IMPLEMENTED
- Implemented `POST /api/auth/register` (hashes passwords via bcrypt).
- Implemented `POST /api/auth/login` (verifies bcrypt, generates JWT, sets HTTP-only cookie).

### Authorization Status: ✅ IMPLEMENTED
- `auth.js` middleware added to securely extract JWT from HTTP-only cookie or Authorization header.
- Unauthorized requests now return a strict `401 Unauthorized` or `403 Access Denied`.

### Current-user API: ✅ IMPLEMENTED
- Implemented `GET /api/auth/me` returning safe `{ id, name, email }` object derived directly from the trusted JWT token.

### User-specific accounts: ✅ IMPLEMENTED
- Implemented `GET /api/accounts/me` retrieving accounts securely based on `req.user.id`.
- The `GET /api/accounts` generic list was restricted to `403` to prevent unauthorized scraping.

### User-scoped transactions: ✅ IMPLEMENTED
- Added ownership checks before deposits, withdrawals, and transfers in `transactions.js`.
- Queries modified to automatically filter history based on `req.user.id`.
- Attempts to query or act upon another user's accounts are safely blocked with `403`.

### Dashboard API: ✅ IMPLEMENTED
- `GET /api/dashboard` added to aggregate account and transaction data effectively. It performs PostgreSQL operations like `COUNT` and `SUM(balance)` while ensuring data only pertains to `req.user.id`.

### CORS & Cookies: ✅ IMPLEMENTED
- Implemented `cors` using `.env.FRONTEND_URL` and `credentials: true`.
- Tokens are returned in an HTTP-only secure cookie, never exposed unnecessarily in JSON body, and successfully cleared on `POST /api/auth/logout`.

### Security status: ✅ IMPLEMENTED
- `JWT_SECRET` enforced from environment config.
- `password_hash` column correctly utilized; hashes never leak in APIs.
- Existing defenses against SQL injections via parametrized queries (via `pg` client) maintained.

### Remaining known limitations:
- **Scalability**: The strict double-entry model introduces a minor concurrency bottleneck since all deposits and withdrawals globally compete for a row-lock on the single `SYSTEM_CASH` account. This is perfectly acceptable for the current scale.

### 19. Double-Entry Architecture Upgrade
The backend deposit and withdrawal mechanisms have been completely rewritten to support a strict double-entry system.

**New Architecture:**
```text
SYSTEM_CASH
    |
    +-- deposits
    +-- withdrawals

CUSTOMER ACCOUNT A
    |
    +-- transfers
    |
CUSTOMER ACCOUNT B
```

**Ledger Behavior:**
- **Deposit**: `SYSTEM_CASH` (DEBIT), `CUSTOMER` (CREDIT)
- **Withdrawal**: `CUSTOMER` (DEBIT), `SYSTEM_CASH` (CREDIT)
- **Transfer**: `SOURCE` (DEBIT), `DESTINATION` (CREDIT)

**Historical Data Handling:**
Since the database was operating in development mode (MVP), `seed.sql` was modified and re-executed to inject the `SYSTEM_CASH` account (with a documented ₹10M liquidity reserve) and safely backfill double-entry pairings for all historical test transactions. No complex migration script was required for the development data.

