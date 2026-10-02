import pool from "./src/db/pool.js";
async function run() {
  const res = await pool.query(`SELECT * FROM ledger_entries WHERE txn_id = 6`);
  console.log(res.rows);
  process.exit(0);
}
run();
