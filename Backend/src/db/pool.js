import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.DB_PORT || 5432),
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    };

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

export async function testConnection() {
  const result = await pool.query("SELECT NOW() AS now");
  return result.rows[0];
}

export default pool;
