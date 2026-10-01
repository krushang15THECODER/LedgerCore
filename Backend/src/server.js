import express from "express";
import dotenv from "dotenv";
import path from "path";

import usersRouter from "./routes/users.js";
import accountsRouter from "./routes/accounts.js";
import transactionsRouter from "./routes/transactions.js";
import healthRouter from "./routes/health.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "LedgerCore API",
    version: "1.0.0",
  });
});

app.use("/api/health", healthRouter);
app.use("/api/users", usersRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/transactions", transactionsRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`LedgerCore API running on http://localhost:${PORT}`);
});
