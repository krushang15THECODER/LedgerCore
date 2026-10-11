import { Router } from "express";
import pool from "../db/pool.js";
import { id, positivePaise } from "../utils/validation.js";
import {
  transfer,
  deposit,
  withdrawal,
} from "../services/transactionService.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();
router.use(authenticateUser);

function getIdempotencyKey(req) {
  return req.get("Idempotency-Key") || req.body.idempotency_key || null;
}

router.post("/deposit", async (req, res) => {
  const accountId = id(req.body.account_id, "account_id");
  const amount = positivePaise(req.body.amount);

  // Ownership check
  const ownerCheck = await pool.query(`SELECT user_id FROM accounts WHERE account_id = $1`, [accountId]);
  if (ownerCheck.rowCount === 0 || Number(ownerCheck.rows[0].user_id) !== Number(req.user.id)) {
    return res.status(403).json({ success: false, error: "Unauthorized access to account." });
  }

  const result = await deposit({
    accountId,
    amount,
    description: req.body.description,
    idempotencyKey: getIdempotencyKey(req),
  });

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    duplicate: result.duplicate,
    transaction: result.transaction,
  });
});

router.post("/withdraw", async (req, res) => {
  const accountId = id(req.body.account_id, "account_id");
  const amount = positivePaise(req.body.amount);

  // Ownership check
  const ownerCheck = await pool.query(`SELECT user_id FROM accounts WHERE account_id = $1`, [accountId]);
  if (ownerCheck.rowCount === 0 || Number(ownerCheck.rows[0].user_id) !== Number(req.user.id)) {
    return res.status(403).json({ success: false, error: "Unauthorized access to account." });
  }

  const result = await withdrawal({
    accountId,
    amount,
    description: req.body.description,
    idempotencyKey: getIdempotencyKey(req),
  });

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    duplicate: result.duplicate,
    transaction: result.transaction,
  });
});

router.post("/transfer", async (req, res) => {
  const fromAccountId = id(req.body.from_account_id, "from_account_id");
  const toAccountId = id(req.body.to_account_id, "to_account_id");
  const amount = positivePaise(req.body.amount);

  // Ownership check for source account
  const ownerCheck = await pool.query(`SELECT user_id, account_type FROM accounts WHERE account_id = $1`, [fromAccountId]);
  if (ownerCheck.rowCount === 0 || Number(ownerCheck.rows[0].user_id) !== Number(req.user.id)) {
    return res.status(403).json({ success: false, error: "Unauthorized access to source account." });
  }

  // Target account check to prevent SYSTEM_CASH abuse
  const targetCheck = await pool.query(`SELECT account_type FROM accounts WHERE account_id = $1`, [toAccountId]);
  if (targetCheck.rowCount > 0 && targetCheck.rows[0].account_type === 'SYSTEM') {
    return res.status(403).json({ success: false, error: "Cannot manually transfer to a SYSTEM account." });
  }

  const result = await transfer({
    fromAccountId,
    toAccountId,
    amount,
    description: req.body.description,
    idempotencyKey: getIdempotencyKey(req),
  });

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    duplicate: result.duplicate,
    transaction: result.transaction,
  });
});

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT t.*
     FROM transactions t
     JOIN ledger_entries le ON t.txn_id = le.txn_id
     JOIN accounts a ON le.account_id = a.account_id
     WHERE a.user_id = $1
     ORDER BY t.created_at DESC, t.txn_id DESC`,
    [Number(req.user.id)]
  );

  res.json({ success: true, transactions: result.rows });
});

router.get("/:txnId", async (req, res) => {
  const txnId = id(req.params.txnId, "txnId");

  const result = await pool.query(
    `SELECT t.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'entry_id', l.entry_id,
                  'account_id', l.account_id,
                  'entry_type', l.entry_type,
                  'amount', l.amount
                )
                ORDER BY l.entry_id
              ) FILTER (WHERE l.entry_id IS NOT NULL),
              '[]'
            ) AS ledger_entries
     FROM transactions t
     LEFT JOIN ledger_entries l ON l.txn_id = t.txn_id
     WHERE t.txn_id = $1
       AND EXISTS (
         SELECT 1 FROM ledger_entries le
         JOIN accounts a ON le.account_id = a.account_id
         WHERE le.txn_id = t.txn_id AND a.user_id = $2
       )
     GROUP BY t.txn_id`,
    [txnId, Number(req.user.id)]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      success: false,
      error: "Transaction not found.",
    });
  }

  res.json({ success: true, transaction: result.rows[0] });
});

router.get("/account/:accountId/history", async (req, res) => {
  const accountId = id(req.params.accountId, "accountId");
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  // Ownership check
  const ownerCheck = await pool.query(`SELECT user_id FROM accounts WHERE account_id = $1`, [accountId]);
  if (ownerCheck.rowCount === 0 || Number(ownerCheck.rows[0].user_id) !== Number(req.user.id)) {
    return res.status(403).json({ success: false, error: "Unauthorized access to account." });
  }

  const result = await pool.query(
    `SELECT 
       entry_id,
       $1::BIGINT AS account_id,
       entry_type,
       amount,
       txn_id,
       reference_no,
       txn_type,
       txn_status AS status,
       description,
       running_balance,
       created_at
     FROM fn_account_statement($1, NULL, NULL, $2, $3)`,
    [accountId, limit, offset]
  );

  res.json({
    success: true,
    account_id: accountId,
    limit,
    offset,
    history: result.rows,
  });
});

export default router;
