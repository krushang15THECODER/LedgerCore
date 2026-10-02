import pool from "./src/db/pool.js";
async function check() {
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
  console.log(checkQ.rows);
  process.exit(0);
}
check();
