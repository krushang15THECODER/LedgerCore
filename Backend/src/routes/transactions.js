import { Router } from "express";
import pool from "../db/pool.js";
import { id, positivePaise } from "../utils/validation.js";
import {
  transfer,
  deposit,
  withdrawal,
} from "../services/transactionService.js";

const router = Router();

function getIdempotencyKey(req) {
  return req.get("Idempotency-Key") || req.body.idempotency_key || null;
}

router.post("/deposit", async (req, res) => {
  const accountId = id(req.body.account_id, "account_id");
  const amount = positivePaise(req.body.amount);
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
    `SELECT *
     FROM transactions
     ORDER BY created_at DESC, txn_id DESC`
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
     GROUP BY t.txn_id`,
    [txnId]
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

  const result = await pool.query(
    `SELECT *
     FROM account_statement
     WHERE account_id = $1
     ORDER BY created_at DESC, entry_id DESC
     LIMIT $2 OFFSET $3`,
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
