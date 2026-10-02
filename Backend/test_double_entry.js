const baseUrl = "http://localhost:5000/api";
import pool from "./src/db/pool.js";

async function runTests() {
  console.log("Running Double Entry Tests...");
  let u1, u2;
  let token1, token2;
  
  // 1. Get SYSTEM_CASH ID
  const sysQ = await pool.query(`SELECT account_id FROM accounts WHERE account_type = 'SYSTEM'`);
  if (sysQ.rowCount !== 1) throw new Error("SYSTEM_CASH account is missing or not unique.");
  const systemId = sysQ.rows[0].account_id;

  // 2. Register Users
  let res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "User A", email: `a${Date.now()}@example.com`, phone: `${Date.now()}`, password: "password123" })
  });
  u1 = (await res.json()).user;
  
  res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "User B", email: `b${Date.now()}@example.com`, phone: `${Date.now()+1}`, password: "password123" })
  });
  u2 = (await res.json()).user;

  // 3. Login Users
  res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: u1.email, password: "password123" })
  });
  token1 = res.headers.get('set-cookie').split(';')[0].split('=')[1];
  
  res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: u2.email, password: "password123" })
  });
  token2 = res.headers.get('set-cookie').split(';')[0].split('=')[1];

  // 4. Create Accounts
  res = await fetch(`${baseUrl}/accounts`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}` },
    body: JSON.stringify({ account_type: "SAVINGS" })
  });
  const acc1 = await res.json();
  
  res = await fetch(`${baseUrl}/accounts`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token2}` },
    body: JSON.stringify({ account_type: "CURRENT" })
  });
  const acc2 = await res.json();

  // Test 1: Deposit creates exactly 2 ledger entries and balances check out.
  res = await fetch(`${baseUrl}/transactions/deposit`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}` },
    body: JSON.stringify({ account_id: acc1.account.account_id, amount: 10000 })
  });
  const dep = await res.json();
  
  // Verify DB side for Deposit
  let le = await pool.query(`SELECT * FROM ledger_entries WHERE txn_id = $1 ORDER BY amount`, [dep.transaction.txn_id]);
  if (le.rowCount !== 2) throw new Error("Deposit did not create 2 ledger entries.");
  const debitEntry = le.rows.find(r => r.entry_type === 'DEBIT');
  const creditEntry = le.rows.find(r => r.entry_type === 'CREDIT');
  if (debitEntry.account_id !== systemId || creditEntry.account_id !== acc1.account.account_id.toString()) {
      throw new Error("Deposit ledger entries have wrong accounts.");
  }
  
  // Test 2: Withdrawal creates exactly 2 ledger entries.
  res = await fetch(`${baseUrl}/transactions/withdraw`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}` },
    body: JSON.stringify({ account_id: acc1.account.account_id, amount: 4000 })
  });
  const wdr = await res.json();
  
  le = await pool.query(`SELECT * FROM ledger_entries WHERE txn_id = $1`, [wdr.transaction.txn_id]);
  if (le.rowCount !== 2) throw new Error("Withdrawal did not create 2 ledger entries.");
  const wdrDebit = le.rows.find(r => r.entry_type === 'DEBIT');
  const wdrCredit = le.rows.find(r => r.entry_type === 'CREDIT');
  if (wdrDebit.account_id !== acc1.account.account_id.toString() || wdrCredit.account_id !== systemId) {
      throw new Error("Withdrawal ledger entries have wrong accounts.");
  }
  
  // Test 3: Transfer creates exactly 2 ledger entries.
  res = await fetch(`${baseUrl}/transactions/transfer`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}` },
    body: JSON.stringify({ from_account_id: acc1.account.account_id, to_account_id: acc2.account.account_id, amount: 5000 })
  });
  const trf = await res.json();
  le = await pool.query(`SELECT * FROM ledger_entries WHERE txn_id = $1`, [trf.transaction.txn_id]);
  if (le.rowCount !== 2) throw new Error("Transfer did not create 2 ledger entries.");

  // Test 4: Every completed transaction has equal debit/credit totals
  const checkQ = await pool.query(`
    SELECT t.txn_id,
           SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END) AS total_debit,
           SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END) AS total_credit
    FROM transactions t
    JOIN ledger_entries le ON t.txn_id = le.txn_id
    WHERE t.status = 'COMPLETED'
    GROUP BY t.txn_id
    HAVING SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END) != SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END)
  `);
  if (checkQ.rowCount > 0) throw new Error("Unbalanced transactions exist in the database!");

  // Test 5: Insufficient balance creates no partial ledger entries.
  const beforeCount = await pool.query(`SELECT count(*) FROM ledger_entries`);
  res = await fetch(`${baseUrl}/transactions/withdraw`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}` },
    body: JSON.stringify({ account_id: acc1.account.account_id, amount: 9999999 })
  });
  if (res.status !== 400) throw new Error("Insufficient balance should fail.");
  const afterCount = await pool.query(`SELECT count(*) FROM ledger_entries`);
  if (beforeCount.rows[0].count !== afterCount.rows[0].count) throw new Error("Partial ledger entries created on failure!");

  // Test 6: Idempotent retries.
  const idemKey = `IDEM-TEST-${Date.now()}`;
  res = await fetch(`${baseUrl}/transactions/deposit`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}`, "Idempotency-Key": idemKey },
    body: JSON.stringify({ account_id: acc1.account.account_id, amount: 1000 })
  });
  const idemDep1 = await res.json();
  
  res = await fetch(`${baseUrl}/transactions/deposit`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}`, "Idempotency-Key": idemKey },
    body: JSON.stringify({ account_id: acc1.account.account_id, amount: 1000 })
  });
  const idemDep2 = await res.json();
  if (!idemDep2.duplicate || idemDep1.transaction.txn_id !== idemDep2.transaction.txn_id) {
    throw new Error("Idempotency failed!");
  }

  // Test 7: SYSTEM_CASH never appears in /api/accounts/me
  res = await fetch(`${baseUrl}/accounts/me`, { headers: { "Cookie": `jwt=${token1}` } });
  const myAccs = await res.json();
  if (myAccs.accounts.some(a => a.account_type === 'SYSTEM')) throw new Error("SYSTEM account leaked in /me");

  // Test 8: Users cannot transfer to SYSTEM account
  res = await fetch(`${baseUrl}/transactions/transfer`, {
    method: "POST", headers: { "Content-Type": "application/json", "Cookie": `jwt=${token1}` },
    body: JSON.stringify({ from_account_id: acc1.account.account_id, to_account_id: systemId, amount: 10 })
  });
  if (res.status !== 403) throw new Error("Allowed manual transfer to SYSTEM account!");

  console.log("All double-entry tests passed successfully.");
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
