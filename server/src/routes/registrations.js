import { Router } from "express";
import { stripe } from "../stripe.js";
import {
  listRegistrations,
  findRegistrationBySession,
  findRegistration,
  markRegistrationRefunded,
} from "../registerService.js";

const router = Router();

router.get("/", async (_req, res) => res.json(await listRegistrations()));

// Used by the React success page to confirm the payment
router.get("/by-session/:sessionId", async (req, res) => {
  const registration = await findRegistrationBySession(req.params.sessionId);
  if (!registration)
    return res.status(404).json({ error: "Registration not found" });
  res.json(registration);
});

router.post("/:id/refund", async (req, res) => {
  try {
    const registration = await findRegistration(Number(req.params.id));
    if (!registration)
      return res.status(404).json({ error: "Registration not found" });
    if (registration.status !== "PAID")
      return res
        .status(400)
        .json({ error: "Only PAID registrations can be refunded" });

    res.json(await markRegistrationRefunded(registration.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Refund failed" });
  }
});

export default router;
