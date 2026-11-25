import "dotenv/config";
import express from "express";
import cors from "cors";
import eventsRouter from "./routes/events.js";
import checkoutRouter from "./routes/checkout.js";
import registrationsRouter from "./routes/registrations.js";
import webhookRouter from "./routes/webhook.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));

app.use("/api/webhook", webhookRouter);

app.use(express.json());
app.use("/api/events", eventsRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/registrations", registrationsRouter);

const port = process.env.PORT || 4000;
app.listen(port, () =>
  console.log(`API listening on http://localhost:${port}`),
);

export default app;
