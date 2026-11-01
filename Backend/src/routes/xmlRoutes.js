// src/routes/xmlRoutes.js
// Express router to serve XML formatted results for queries 1, 3, 4
import express from 'express';
import pool from '../db/pool.js';
import { buildXml } from '../utils/toXml.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateUser);

// Helper to measure execution time (ms)
async function executeQuery(query, params = []) {
  const start = Date.now();
  const res = await pool.query(query, params);
  const duration = Date.now() - start;
  return { rows: res.rows, duration };
}

function sendXml(res, rootTag, rows, duration) {
  const xml = buildXml(rootTag, rows);
  res.set('Content-Type', 'application/xml');
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<response>\n` +
    `  <executionTime>${duration}ms</executionTime>\n` +
    `  <query>${rootTag}</query>\n` +
    `  <rowCount>${rows.length}</rowCount>\n` +
    `  <data>${xml}</data>\n` +
    `</response>`
  );
}

// Query 1: Display all data from users table
router.get('/users', async (req, res) => {
  try {
    const { rows, duration } = await executeQuery('SELECT user_id, name, email, phone, created_at, updated_at FROM users ORDER BY user_id');
    sendXml(res, 'users', rows, duration);
  } catch (err) {
    console.error('XML /users error:', err.message);
    res.status(500).set('Content-Type', 'application/xml')
       .send(`<?xml version="1.0" encoding="UTF-8"?>\n<error>${err.message}</error>`);
  }
});

// Query 3: Aggregate function — SUM of ledger entry amounts
router.get('/transactions/total-amount', async (req, res) => {
  try {
    const { rows, duration } = await executeQuery(
      `SELECT COUNT(*) AS total_entries, SUM(amount) AS total_amount, AVG(amount) AS avg_amount, MIN(amount) AS min_amount, MAX(amount) AS max_amount FROM ledger_entries`
    );
    sendXml(res, 'aggregates', rows, duration);
  } catch (err) {
    console.error('XML /transactions/total-amount error:', err.message);
    res.status(500).set('Content-Type', 'application/xml')
       .send(`<?xml version="1.0" encoding="UTF-8"?>\n<error>${err.message}</error>`);
  }
});

// Query 4: Conditional select — accounts with balance >= min
router.get('/accounts/balance', async (req, res) => {
  const minBalance = parseInt(req.query.min) || 0;
  try {
    const { rows, duration } = await executeQuery(
      `SELECT a.account_id, u.name AS owner_name, a.account_type, a.balance, a.status, a.created_at, a.updated_at
       FROM accounts a
       LEFT JOIN users u ON u.user_id = a.user_id
       WHERE a.balance >= $1
       ORDER BY a.balance DESC`,
      [minBalance]
    );
    sendXml(res, 'accounts', rows, duration);
  } catch (err) {
    console.error('XML /accounts/balance error:', err.message);
    res.status(500).set('Content-Type', 'application/xml')
       .send(`<?xml version="1.0" encoding="UTF-8"?>\n<error>${err.message}</error>`);
  }
});

export default router;
