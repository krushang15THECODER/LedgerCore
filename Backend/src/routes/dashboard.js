import { Router } from "express";
import pool from "../db/pool.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticateUser, async (req, res) => {
  const userId = req.user.id;

  // Aggregate account and balance data
  const accountsQuery = await pool.query(
    `SELECT COUNT(*) AS total_accounts, COALESCE(SUM(balance), 0) AS total_balance
     FROM accounts
     WHERE user_id = $1`,
    [userId]
  );

  const totalAccounts = Number(accountsQuery.rows[0].total_accounts);
  const totalBalance = Number(accountsQuery.rows[0].total_balance);

  // Aggregate transaction counts (this user's accounts involved in ledger entries)
  const txnCountQuery = await pool.query(
    `SELECT COUNT(DISTINCT t.txn_id) AS total_transactions
     FROM transactions t
     JOIN ledger_entries le ON t.txn_id = le.txn_id
     JOIN accounts a ON le.account_id = a.account_id
     WHERE a.user_id = $1`,
    [userId]
  );
  
  const totalTransactions = Number(txnCountQuery.rows[0].total_transactions);

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
