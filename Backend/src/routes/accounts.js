import { Router } from "express";
import pool from "../db/pool.js";
import { id, required, positivePaise } from "../utils/validation.js";

const router = Router();

router.post("/", async (req, res) => {
  const { user_id, account_type } = req.body;
  const userId = id(user_id, "user_id");
  required(account_type, "account_type");

  const result = await pool.query(
    `INSERT INTO accounts (user_id, account_type)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, account_type]
  );

  res.status(201).json({ success: true, account: result.rows[0] });
});

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT a.*, u.name AS owner_name, u.email AS owner_email
     FROM accounts a
     JOIN users u ON u.user_id = a.user_id
     ORDER BY a.account_id`
  );

  res.json({ success: true, accounts: result.rows });
});

router.get("/:accountId", async (req, res) => {
  const accountId = id(req.params.accountId, "accountId");

  const result = await pool.query(
    `SELECT a.*, u.name AS owner_name, u.email AS owner_email
     FROM accounts a
     JOIN users u ON u.user_id = a.user_id
     WHERE a.account_id = $1`,
    [accountId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Account not found." });
  }

  res.json({ success: true, account: result.rows[0] });
});

router.get("/:accountId/balance", async (req, res) => {
  const accountId = id(req.params.accountId, "accountId");

  const result = await pool.query(
    `SELECT account_id, balance, balance / 100.0 AS balance_inr, status
     FROM accounts
     WHERE account_id = $1`,
    [accountId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Account not found." });
  }

  res.json({ success: true, balance: result.rows[0] });
});

router.patch("/:accountId/status", async (req, res) => {
  const accountId = id(req.params.accountId, "accountId");
  const { status } = req.body;
  required(status, "status");

  const result = await pool.query(
    `UPDATE accounts
     SET status = $1
     WHERE account_id = $2
     RETURNING *`,
    [status, accountId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Account not found." });
  }

  res.json({ success: true, account: result.rows[0] });
});

export default router;
