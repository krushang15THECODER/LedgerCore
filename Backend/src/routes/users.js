import { Router } from "express";
import pool from "../db/pool.js";
import { id, required } from "../utils/validation.js";

const router = Router();

router.post("/", async (req, res) => {
  const { name, email, phone } = req.body;
  required(name, "name");
  required(email, "email");

  const result = await pool.query(
    `INSERT INTO users (name, email, phone)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, email, phone ?? null]
  );

  res.status(201).json({ success: true, user: result.rows[0] });
});

router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM users ORDER BY user_id"
  );
  res.json({ success: true, users: result.rows });
});

router.get("/:userId", async (req, res) => {
  const userId = id(req.params.userId, "userId");

  const result = await pool.query(
    `SELECT * FROM users WHERE user_id = $1`,
    [userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "User not found." });
  }

  res.json({ success: true, user: result.rows[0] });
});

router.put("/:userId", async (req, res) => {
  const userId = id(req.params.userId, "userId");
  const { name, email, phone } = req.body;

  required(name, "name");
  required(email, "email");

  const result = await pool.query(
    `UPDATE users
     SET name = $1, email = $2, phone = $3
     WHERE user_id = $4
     RETURNING *`,
    [name, email, phone ?? null, userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "User not found." });
  }

  res.json({ success: true, user: result.rows[0] });
});

router.delete("/:userId", async (req, res) => {
  const userId = id(req.params.userId, "userId");

  const result = await pool.query(
    "DELETE FROM users WHERE user_id = $1 RETURNING *",
    [userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "User not found." });
  }

  res.json({ success: true, message: "User deleted.", user: result.rows[0] });
});

export default router;
