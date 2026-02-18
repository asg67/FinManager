import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import authRouter from "./routes/auth.js";
import entitiesRouter from "./routes/entities.js";
import accountsRouter from "./routes/accounts.js";
import expensesRouter from "./routes/expenses.js";
import ddsRouter from "./routes/dds.js";
import pdfRouter from "./routes/pdf.js";
import analyticsRouter from "./routes/analytics.js";
import employeesRouter from "./routes/employees.js";
import notificationsRouter from "./routes/notifications.js";
import exportRouter from "./routes/export.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
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
app.use("/api/employees", employeesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/export", exportRouter);

// Error handler (must be last — placed after static/SPA below)

// In production, serve the built client
if (config.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));

  // SPA fallback — any non-API route serves index.html
  app.get("*", (_req, res, next) => {
    if (_req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(errorHandler);

// Only listen when running directly (not in tests)
if (process.env.NODE_ENV !== "test") {
  app.listen(config.PORT, () => {
    console.log(`Server running on http://localhost:${config.PORT}`);
  });
}

export default app;
