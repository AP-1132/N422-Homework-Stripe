import "dotenv/config";
import app from "./app.js";
import { prisma } from "./db.js";
import { expirePendingRegistrations } from "./registerService.js";
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
