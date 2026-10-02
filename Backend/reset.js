import fs from "fs";
import path from "path";
import pool from "./src/db/pool.js";

async function resetDB() {
  try {
    const schemaSql = fs.readFileSync(path.resolve("../Database/schema.sql"), "utf-8");
    const seedSql = fs.readFileSync(path.resolve("../Database/seed.sql"), "utf-8");
    
    console.log("Running schema...");
    await pool.query(schemaSql);
    
    console.log("Running seed...");
    await pool.query(seedSql);
    
    console.log("Database reset successful.");
  } catch (err) {
    console.error("Failed to reset DB:", err);
  } finally {
    process.exit(0);
  }
}

resetDB();
