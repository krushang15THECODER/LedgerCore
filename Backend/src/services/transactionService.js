import crypto from "crypto";
import pool from "../db/pool.js";

function makeReference(prefix) {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

async function getAccountForUpdate(client, accountId) {
  const result = await client.query(
    `SELECT account_id, user_id, balance, status
     FROM accounts
     WHERE account_id = $1
     FOR UPDATE`,
    [accountId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const account = result.rows[0];

  // PostgreSQL BIGINT values are returned by pg as strings.
  // Convert numeric fields so JavaScript comparisons work correctly.
  return {
    ...account,
    account_id: Number(account.account_id),
    user_id: Number(account.user_id),
    balance: Number(account.balance),
  };
}

async function getSystemCashAccount(client) {
  const result = await client.query(`SELECT account_id FROM accounts WHERE account_type = 'SYSTEM'`);
  if (result.rowCount === 0) throw new Error("SYSTEM_CASH account is missing.");
  return Number(result.rows[0].account_id);
}

function businessError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function verifyLedgerInvariant(client, txnId) {
  const check = await client.query(
    `SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END), 0) AS total_debit,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END), 0) AS total_credit
     FROM ledger_entries
     WHERE txn_id = $1`,
    [txnId]
  );
  if (check.rows[0].total_debit !== check.rows[0].total_credit) {
    throw businessError("Ledger invariant violation: DEBIT != CREDIT", 500);
  }
}

// ============================================================
// TRANSFER
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
    await client.query("BEGIN");

    // --------------------------------------------------------
    // IDEMPOTENCY CHECK
    // --------------------------------------------------------

    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT t.*
         FROM idempotency_keys i
         JOIN transactions t ON t.txn_id = i.txn_id
         WHERE i.key = $1
           AND i.expires_at > CURRENT_TIMESTAMP`,
        [idempotencyKey]
      );

      if (existing.rowCount > 0) {
        await client.query("ROLLBACK");

        return {
          duplicate: true,
          transaction: existing.rows[0],
        };
      }
    }

    // --------------------------------------------------------
    // VALIDATE SOURCE AND DESTINATION
    // --------------------------------------------------------

    if (fromAccountId === toAccountId) {
      throw businessError(
        "Source and destination accounts must be different."
      );
    }

    // --------------------------------------------------------
    // LOCK ACCOUNTS IN DETERMINISTIC ORDER
    // This reduces deadlock risk when two transfers touch
    // the same pair of accounts in opposite directions.
    // --------------------------------------------------------

    const firstId = Math.min(fromAccountId, toAccountId);
    const secondId = Math.max(fromAccountId, toAccountId);

    const first = await getAccountForUpdate(client, firstId);
    const second = await getAccountForUpdate(client, secondId);

    // --------------------------------------------------------
    // ACCOUNT EXISTENCE
    // --------------------------------------------------------

    if (!first || !second) {
      throw businessError(
        "One or both accounts do not exist.",
        404
      );
    }

    // --------------------------------------------------------
    // IDENTIFY SOURCE AND DESTINATION
    // --------------------------------------------------------

    const from =
      fromAccountId === first.account_id
        ? first
        : second;

    const to =
      toAccountId === first.account_id
        ? first
        : second;

    // --------------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------------

    if (from.status !== "ACTIVE" || to.status !== "ACTIVE") {
      throw businessError("Both accounts must be ACTIVE.");
    }

    // --------------------------------------------------------
    // INSUFFICIENT BALANCE CHECK
    // --------------------------------------------------------

    if (from.balance < amount) {
      throw businessError("Insufficient balance.", 400);
    }

    // --------------------------------------------------------
    // CREATE TRANSACTION
    // --------------------------------------------------------

    const referenceNo = makeReference("TXN-TRF");

    const txn = await client.query(
      `INSERT INTO transactions
         (reference_no, txn_type, status, description)
       VALUES ($1, 'TRANSFER', 'PENDING', $2)
       RETURNING *`,
      [referenceNo, description ?? null]
    );

    const txnId = txn.rows[0].txn_id;

    // --------------------------------------------------------
    // CREATE DOUBLE-ENTRY LEDGER
    // --------------------------------------------------------

    await client.query(
      `INSERT INTO ledger_entries
         (txn_id, account_id, entry_type, amount)
       VALUES
         ($1, $2, 'DEBIT', $3),
         ($1, $4, 'CREDIT', $3)`,
      [
        txnId,
        fromAccountId,
        amount,
        toAccountId,
      ]
    );

    // --------------------------------------------------------
    // DEBIT SOURCE ACCOUNT
    // --------------------------------------------------------

    await client.query(
      `UPDATE accounts
       SET balance = balance - $1
       WHERE account_id = $2`,
      [amount, fromAccountId]
    );

    // --------------------------------------------------------
    // CREDIT DESTINATION ACCOUNT
    // --------------------------------------------------------

    await client.query(
      `UPDATE accounts
       SET balance = balance + $1
       WHERE account_id = $2`,
      [amount, toAccountId]
    );

    // --------------------------------------------------------
    // COMPLETE TRANSACTION
    // --------------------------------------------------------

    const completed = await client.query(
      `UPDATE transactions
       SET status = 'COMPLETED'
       WHERE txn_id = $1
       RETURNING *`,
      [txnId]
    );

    // --------------------------------------------------------
    // SAVE IDEMPOTENCY KEY
    // --------------------------------------------------------

    if (idempotencyKey) {
      await client.query(
        `INSERT INTO idempotency_keys
           (key, txn_id, expires_at)
         VALUES
           ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 day')`,
        [idempotencyKey, txnId]
      );
    }

    // --------------------------------------------------------
    // VERIFY LEDGER INVARIANT
    // --------------------------------------------------------

    await verifyLedgerInvariant(client, txnId);

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query("COMMIT");

    return {
      duplicate: false,
      transaction: completed.rows[0],
    };
  } catch (error) {
    // Any failure rolls back the entire transaction:
    // transaction + ledger entries + balance changes.
    await client.query("ROLLBACK").catch(() => {});

    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// DEPOSIT
// ============================================================

export async function deposit({
  accountId,
  amount,
  description,
  idempotencyKey,
}) {
  return simpleMoneyTransaction({
    accountId,
    amount,
    description,
    idempotencyKey,
    type: "DEPOSIT",
    entryType: "CREDIT",
    systemEntryType: "DEBIT",
    balanceExpression: "balance + $1",
    systemBalanceExpression: "balance - $1",
    referencePrefix: "TXN-DEP",
  });
}

// ============================================================
// WITHDRAWAL
// ============================================================

export async function withdrawal({
  accountId,
  amount,
  description,
  idempotencyKey,
}) {
  return simpleMoneyTransaction({
    accountId,
    amount,
    description,
    idempotencyKey,
    type: "WITHDRAWAL",
    entryType: "DEBIT",
    systemEntryType: "CREDIT",
    balanceExpression: "balance - $1",
    systemBalanceExpression: "balance + $1",
    referencePrefix: "TXN-WDR",
  });
}

// ============================================================
// DEPOSIT / WITHDRAWAL SHARED SERVICE
// ============================================================

async function simpleMoneyTransaction({
  accountId,
  amount,
  description,
  idempotencyKey,
  type,
  entryType,
  systemEntryType,
  balanceExpression,
  systemBalanceExpression,
  referencePrefix,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------------
    // IDEMPOTENCY CHECK
    // --------------------------------------------------------

    if (idempotencyKey) {
      const existing = await client.query(
        `SELECT t.*
         FROM idempotency_keys i
         JOIN transactions t ON t.txn_id = i.txn_id
         WHERE i.key = $1
           AND i.expires_at > CURRENT_TIMESTAMP`,
        [idempotencyKey]
      );

      if (existing.rowCount > 0) {
        await client.query("ROLLBACK");

        return {
          duplicate: true,
          transaction: existing.rows[0],
        };
      }
    }

    // --------------------------------------------------------
    // LOCK ACCOUNTS DETERMINISTICALLY
    // --------------------------------------------------------

    const systemAccountId = await getSystemCashAccount(client);
    
    if (accountId === systemAccountId) {
      throw businessError("Cannot perform deposit/withdrawal directly on the SYSTEM_CASH account.");
    }

    const firstId = Math.min(accountId, systemAccountId);
    const secondId = Math.max(accountId, systemAccountId);

    const first = await getAccountForUpdate(client, firstId);
    const second = await getAccountForUpdate(client, secondId);

    const account = accountId === first.account_id ? first : second;
    const system = systemAccountId === first.account_id ? first : second;

    if (!account) {
      throw businessError("Account not found.", 404);
    }
    if (!system) {
      throw businessError("SYSTEM_CASH account not found.", 500);
    }

    // --------------------------------------------------------
    // ACCOUNT STATUS
    // --------------------------------------------------------

    if (account.status !== "ACTIVE") {
      throw businessError("Account must be ACTIVE.");
    }

    // --------------------------------------------------------
    // BALANCE CHECKS
    // --------------------------------------------------------

    if (type === "WITHDRAWAL" && account.balance < amount) {
      throw businessError("Insufficient balance.", 400);
    }
    
    if (type === "DEBIT" && system.balance < amount) { 
      // wait, type is DEPOSIT not DEBIT. DEPOSIT decreases SYSTEM_CASH balance.
    }
    
    if (type === "DEPOSIT" && system.balance < amount) {
      throw businessError("Insufficient system cash liquidity.", 400);
    }

    // --------------------------------------------------------
    // CREATE TRANSACTION
    // --------------------------------------------------------

    const referenceNo = makeReference(referencePrefix);

    const txn = await client.query(
      `INSERT INTO transactions
         (reference_no, txn_type, status, description)
       VALUES ($1, $2, 'PENDING', $3)
       RETURNING *`,
      [
        referenceNo,
        type,
        description ?? null,
      ]
    );

    const txnId = txn.rows[0].txn_id;

    // --------------------------------------------------------
    // CREATE LEDGER ENTRIES
    // --------------------------------------------------------

    await client.query(
      `INSERT INTO ledger_entries
         (txn_id, account_id, entry_type, amount)
       VALUES
         ($1, $2, $3, $4),
         ($1, $5, $6, $4)`,
      [
        txnId,
        accountId,
        entryType,
        amount,
        systemAccountId,
        systemEntryType
      ]
    );

    // --------------------------------------------------------
    // UPDATE BALANCES
    // --------------------------------------------------------

    await client.query(
      `UPDATE accounts
       SET balance = ${balanceExpression}
       WHERE account_id = $2`,
      [amount, accountId]
    );

    await client.query(
      `UPDATE accounts
       SET balance = ${systemBalanceExpression}
       WHERE account_id = $2`,
      [amount, systemAccountId]
    );

    // --------------------------------------------------------
    // COMPLETE TRANSACTION
    // --------------------------------------------------------

    const completed = await client.query(
      `UPDATE transactions
       SET status = 'COMPLETED'
       WHERE txn_id = $1
       RETURNING *`,
      [txnId]
    );

    // --------------------------------------------------------
    // SAVE IDEMPOTENCY KEY
    // --------------------------------------------------------

    if (idempotencyKey) {
      await client.query(
        `INSERT INTO idempotency_keys
           (key, txn_id, expires_at)
       VALUES
           ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 day')`,
        [idempotencyKey, txnId]
      );
    }

    // --------------------------------------------------------
    // VERIFY LEDGER INVARIANT
    // --------------------------------------------------------

    await verifyLedgerInvariant(client, txnId);

    // --------------------------------------------------------
    // COMMIT
    // --------------------------------------------------------

    await client.query("COMMIT");

    return {
      duplicate: false,
      transaction: completed.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    throw error;
  } finally {
    client.release();
  }
}