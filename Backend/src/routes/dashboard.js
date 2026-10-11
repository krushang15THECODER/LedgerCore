import { Router } from "express";
import pool from "../db/pool.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateUser, async (req, res) => {
  const userId = req.user.id;

  // Fetch aggregated user summary using PL/pgSQL function
  const summaryQuery = await pool.query(
    `SELECT * FROM fn_user_summary($1)`,
    [userId]
  );
  
  const summary = summaryQuery.rows[0] || {
    total_accounts: 0,
    total_balance: 0,
    total_transactions: 0,
  };

  const totalAccounts = Number(summary.total_accounts);
  const totalBalance = Number(summary.total_balance);
  const totalTransactions = Number(summary.total_transactions);

  // Fetch recent transactions involving this user's accounts
  const recentTxnsQuery = await pool.query(
    `SELECT DISTINCT t.txn_id, t.reference_no, t.txn_type, t.status, t.description, t.created_at
     FROM transactions t
     JOIN ledger_entries le ON t.txn_id = le.txn_id
     JOIN accounts a ON le.account_id = a.account_id
     WHERE a.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT 5`,
    [userId]
  );

  res.json({
    success: true,
    dashboard: {
      total_accounts: totalAccounts,
      total_balance: totalBalance,
      total_transactions: totalTransactions,
      recent_transactions: recentTxnsQuery.rows
    }
  });
});

export default router;
