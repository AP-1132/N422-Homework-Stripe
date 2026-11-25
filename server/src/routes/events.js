import { Router } from "express";
import {
  HttpError,
  listAvailableEvents,
  findEventWithSeats,
  createRegistrationPayment,
} from "../registerService.js";

const router = Router();

function parseId(value) {
  const id = Number(value);

  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, "Invalid event ID");
  }

  return id;
}

router.get("/", async (_req, res) => {
  const events = await listAvailableEvents();

  res.json(events);
});
router.get("/:id", async (req, res) => {
  const eventId = parseId(req.params.id);
  const event = await findEventWithSeats(eventId);

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  res.json(event);
});

router.post("/:id/payment-intent", async (req, res) => {
  const eventId = parseId(req.params.id);

  const { attendeeName, attendeeEmail, quantity } = req.body ?? {};

  if (typeof attendeeName !== "string" || !attendeeName.trim()) {
    throw new HttpError(400, "Attendee name is required");
  }

  if (
    typeof attendeeEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail.trim())
  ) {
    throw new HttpError(400, "A valid attendee email is required");
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
    throw new HttpError(400, "Quantity must be a whole number from 1 to 4");
  }

  const result = await createRegistrationPayment({
    eventId,
    attendeeName: attendeeName.trim(),
    attendeeEmail: attendeeEmail.trim(),
    quantity,
  });

  res.status(201).json({
    clientSecret: result.clientSecret,
    registrationId: result.registrationId,
  });
});

export default router;
