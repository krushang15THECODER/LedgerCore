import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db/pool.js";
import { required } from "../utils/validation.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  const { name, email, phone, password } = req.body;
  required(name, "name");
  required(email, "email");
  required(password, "password");

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const result = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, name, email, phone, created_at, updated_at`,
    [name, email, phone ?? null, passwordHash]
  );

  res.status(201).json({ success: true, user: result.rows[0] });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  required(email, "email");
  required(password, "password");

  const result = await pool.query(
    `SELECT user_id, name, email, password_hash FROM users WHERE email = $1`,
    [email]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ success: false, error: "Invalid credentials." });
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    return res.status(401).json({ success: false, error: "Invalid credentials." });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is missing");

  const token = jwt.sign({ id: user.user_id }, secret, { expiresIn: "1d" });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    user: {
      id: user.user_id,
      name: user.name,
      email: user.email,
    },
  });
});

router.get("/me", authenticateUser, async (req, res) => {
  const result = await pool.query(
    `SELECT user_id AS id, name, email FROM users WHERE user_id = $1`,
    [req.user.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ success: false, error: "User not found." });
  }

  res.json({ success: true, user: result.rows[0] });
});

router.post("/logout", (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ success: true, message: "Logged out successfully." });
});

export default router;
