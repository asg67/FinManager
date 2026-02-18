import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import authRouter from "./routes/auth.js";
import entitiesRouter from "./routes/entities.js";
import accountsRouter from "./routes/accounts.js";
import expensesRouter from "./routes/expenses.js";
import ddsRouter from "./routes/dds.js";
import pdfRouter from "./routes/pdf.js";
import analyticsRouter from "./routes/analytics.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/entities", entitiesRouter);
app.use("/api/entities/:entityId/accounts", accountsRouter);
app.use("/api/entities/:entityId/expense-types", expensesRouter);
app.use("/api/dds", ddsRouter);
app.use("/api/pdf", pdfRouter);
app.use("/api/analytics", analyticsRouter);

// Error handler (must be last)
app.use(errorHandler);

// Only listen when running directly (not in tests)
if (process.env.NODE_ENV !== "test") {
  app.listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`);
  });
}

export default app;
