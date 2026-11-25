import "dotenv/config";
import express from "express";
import cors from "cors";

import { prisma } from "./db.js";
import eventsRouter from "./routes/events.js";
import registrationsRouter from "./routes/registrations.js";
import webhookRouter from "./routes/webhook.js";

import { HttpError, expirePendingRegistrations } from "./registerService.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
  }),
);

// This must remain before express.json().
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

let cleanupRunning = false;
let cleanupTask = Promise.resolve();

function runCleanup() {
  if (cleanupRunning) {
    return cleanupTask;
  }

  cleanupRunning = true;

  cleanupTask = expirePendingRegistrations()
    .catch((err) => {
      console.error("Pending-registration cleanup failed:", err);
    })
    .finally(() => {
      cleanupRunning = false;
    });

  return cleanupTask;
}

// Check on startup and every 30 seconds.
// Expiration therefore normally occurs within 30 seconds
// after the 15-minute hold ends.
const cleanupTimer = setInterval(runCleanup, 30_000);
cleanupTimer.unref();

runCleanup();

const port = process.env.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;

  shuttingDown = true;
  clearInterval(cleanupTimer);

  server.close(async () => {
    try {
      await cleanupTask;
      await prisma.$disconnect();
    } catch (err) {
      console.error("Shutdown failed:", err);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
