import "dotenv/config";
import express from "express";
import cors from "cors";

import eventsRouter from "./routes/events.js";
import registrationsRouter from "./routes/registrations.js";
import webhookRouter from "./routes/webhook.js";
import { HttpError } from "./registerService.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
);

// Preserve the raw webhook body for signature verification.
app.use("/api/webhook", webhookRouter);

app.use(express.json());

app.use("/api/events", eventsRouter);
app.use("/api/registrations", registrationsRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON request body",
    });
  }

  console.error(err);

  return res.status(500).json({
    error: "An unexpected server error occurred",
  });
});

export default app;
