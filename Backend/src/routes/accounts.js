import { Router } from "express";
import pool from "../db/pool.js";
import { id, required, positivePaise } from "../utils/validation.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.use(authenticateUser);

router.post("/", async (req, res) => {
  const userId = Number(req.user.id); // Force ownership
  const { account_type } = req.body;
  required(account_type, "account_type");

  const callRes = await pool.query(
    `CALL sp_open_account($1, $2, NULL)`,
    [userId, account_type]
  );
  const newAccountId = callRes.rows[0].p_account_id;
  const result = await pool.query(`SELECT * FROM accounts WHERE account_id = $1`, [newAccountId]);

  res.status(201).json({ success: true, account: result.rows[0] });
});

router.get("/me", async (req, res) => {
  const result = await pool.query(
    `SELECT a.*, u.name AS owner_name, u.email AS owner_email
     FROM accounts a
     JOIN users u ON u.user_id = a.user_id
     WHERE a.user_id = $1
     ORDER BY a.account_id`,
    [Number(req.user.id)]
  );

  res.json({ success: true, accounts: result.rows });
});

router.get("/", async (req, res) => {
  // Protect all-accounts list from normal users
  return res.status(403).json({ success: false, error: "Access denied. Use /api/accounts/me instead." });
});

router.get("/:accountId", async (req, res) => {
  const accountId = id(req.params.accountId, "accountId");

  const result = await pool.query(
    `SELECT a.*, u.name AS owner_name, u.email AS owner_email
     FROM accounts a
     JOIN users u ON u.user_id = a.user_id
     WHERE a.account_id = $1 AND a.user_id = $2`,
    [accountId, Number(req.user.id)]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Account not found or unauthorized." });
  }

  res.json({ success: true, account: result.rows[0] });
});

router.get("/:accountId/balance", async (req, res) => {
  const accountId = id(req.params.accountId, "accountId");

  const result = await pool.query(
    `SELECT account_id, balance, balance / 100.0 AS balance_inr, status
     FROM accounts
     WHERE account_id = $1 AND user_id = $2`,
    [accountId, Number(req.user.id)]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Account not found or unauthorized." });
  }

  res.json({ success: true, balance: result.rows[0] });
});

router.patch("/:accountId/status", async (req, res) => {
  const accountId = id(req.params.accountId, "accountId");
  const { status } = req.body;
  required(status, "status");

  // Verify ownership
  const ownerCheck = await pool.query(
    `SELECT account_id FROM accounts WHERE account_id = $1 AND user_id = $2`,
    [accountId, Number(req.user.id)]
  );
  if (ownerCheck.rowCount === 0) {
    return res.status(404).json({ success: false, error: "Account not found or unauthorized." });
  }

  await pool.query(`CALL sp_set_account_status($1, $2)`, [accountId, status]);
  const result = await pool.query(`SELECT * FROM accounts WHERE account_id = $1`, [accountId]);

  res.json({ success: true, account: result.rows[0] });
});

export default router;
