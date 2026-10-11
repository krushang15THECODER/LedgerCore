import { Router } from "express";
import pool, { testConnection } from "../db/pool.js";

const router = Router();

router.get("/", async (req, res) => {
  const db = await testConnection();

  res.json({
    success: true,
    service: "LedgerCore API",
    database: "connected",
    time: db.now,
  });
});

router.get("/reconciliation", async (req, res) => {
  const result = await pool.query(
    `SELECT *
     FROM account_reconciliation
     WHERE difference <> 0
     ORDER BY account_id`
  );

  res.json({
    success: true,
    healthy: result.rowCount === 0,
    mismatches: result.rows,
  });
});

router.get("/unbalanced-transfers", async (req, res) => {
  const result = await pool.query(
    `SELECT t.txn_id, t.reference_no,
            COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT' THEN l.amount ELSE 0 END), 0) AS total_debit,
            COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0) AS total_credit
     FROM transactions t
     LEFT JOIN ledger_entries l ON l.txn_id = t.txn_id
     WHERE t.status = 'COMPLETED'
       AND t.txn_type = 'TRANSFER'
     GROUP BY t.txn_id, t.reference_no
     HAVING COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT' THEN l.amount ELSE 0 END), 0)
         <> COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0)
     ORDER BY t.txn_id`
  );

  res.json({
    success: true,
    healthy: result.rowCount === 0,
    unbalanced_transactions: result.rows,
  });
});

router.get("/integrity", async (req, res) => {
  const result = await pool.query(`SELECT * FROM fn_run_health_checks()`);
  const failures = result.rows.filter(r => r.status === 'FAIL');

  res.json({
    success: true,
    healthy: failures.length === 0,
    checks: result.rows,
  });
});

export default router;
