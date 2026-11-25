import { Router } from "express";
import {
  HttpError,
  listRegistrations,
  findRegistration,
  cancelRegistration,
} from "../registerService.js";

const router = Router();

function parseId(value) {
  const id = Number(value);

  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, "Invalid registration ID");
  }

  return id;
}

router.get("/", async (req, res) => {
  const { email } = req.query;

  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    throw new HttpError(400, "A valid email is required");
  }

  const registrations = await listRegistrations(email.trim());

  res.json(registrations);
});

router.get("/:id", async (req, res) => {
  const registrationId = parseId(req.params.id);
  const registration = await findRegistration(registrationId);

  if (!registration) {
    throw new HttpError(404, "Registration not found");
  }

  res.json(registration);
});

router.post("/:id/cancel", async (req, res) => {
  const registrationId = parseId(req.params.id);

  const registration = await cancelRegistration(registrationId);

  res.json(registration);
});

export default router;
