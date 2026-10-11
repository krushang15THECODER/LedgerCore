import pool from "../db/pool.js";

// ============================================================
// TRANSFER (Delegated to PL/pgSQL sp_transfer)
// ============================================================

export async function transfer({
  fromAccountId,
  toAccountId,
  amount,
  description,
  idempotencyKey,
}) {
  const client = await pool.connect();

  try {
    let duplicate = false;
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT txn_id FROM idempotency_keys WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [idempotencyKey]
      );
      if (existing.rowCount > 0) duplicate = true;
    }

    const res = await client.query(
      `CALL sp_transfer($1, $2, $3, $4, $5, $6)`,
      [fromAccountId, toAccountId, amount, description ?? null, idempotencyKey ?? null, null]
    );

    const txnId = res.rows[0].p_txn_id;
    const completed = await client.query(`SELECT * FROM transactions WHERE txn_id = $1`, [txnId]);

    return {
      duplicate,
      transaction: completed.rows[0],
    };
  } finally {
    client.release();
  }
}

// ============================================================
// DEPOSIT (Delegated to PL/pgSQL sp_deposit)
// ============================================================

export async function deposit({
  accountId,
  amount,
  description,
  idempotencyKey,
}) {
  const client = await pool.connect();

  try {
    let duplicate = false;
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT txn_id FROM idempotency_keys WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [idempotencyKey]
      );
      if (existing.rowCount > 0) duplicate = true;
    }

    const res = await client.query(
      `CALL sp_deposit($1, $2, $3, $4, $5)`,
      [accountId, amount, description ?? null, idempotencyKey ?? null, null]
    );

    const txnId = res.rows[0].p_txn_id;
    const completed = await client.query(`SELECT * FROM transactions WHERE txn_id = $1`, [txnId]);

    return {
      duplicate,
      transaction: completed.rows[0],
    };
  } finally {
    client.release();
  }
}

// ============================================================
// WITHDRAWAL (Delegated to PL/pgSQL sp_withdraw)
// ============================================================

export async function withdrawal({
  accountId,
  amount,
  description,
  idempotencyKey,
}) {
  const client = await pool.connect();

  try {
    let duplicate = false;
    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT txn_id FROM idempotency_keys WHERE key = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [idempotencyKey]
      );
      if (existing.rowCount > 0) duplicate = true;
    }

    const res = await client.query(
      `CALL sp_withdraw($1, $2, $3, $4, $5)`,
      [accountId, amount, description ?? null, idempotencyKey ?? null, null]
    );

    const txnId = res.rows[0].p_txn_id;
    const completed = await client.query(`SELECT * FROM transactions WHERE txn_id = $1`, [txnId]);

    return {
      duplicate,
      transaction: completed.rows[0],
    };
  } finally {
    client.release();
  }
}