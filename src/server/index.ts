import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});

export default app;
