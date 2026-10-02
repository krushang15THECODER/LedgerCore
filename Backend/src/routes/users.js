import { Router } from "express";
import pool from "../db/pool.js";
import { id, required } from "../utils/validation.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();
router.use(authenticateUser);

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
  return res.status(403).json({ success: false, error: "Access denied." });
});

router.get("/:userId", async (req, res) => {
  const userId = id(req.params.userId, "userId");

  if (userId !== Number(req.user.id)) {
    return res.status(403).json({ success: false, error: "Access denied." });
  }

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
  
  if (userId !== Number(req.user.id)) {
    return res.status(403).json({ success: false, error: "Access denied." });
  }

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

  if (userId !== Number(req.user.id)) {
    return res.status(403).json({ success: false, error: "Access denied." });
  }

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
