import { Router } from "express";
import { stripe } from "../stripe.js";
import {
  validateCart,
  createPendingRegistrations,
  attachSession,
  HttpError,
} from "../registerService.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { items, attendeeName, attendeeEmail } = req.body ?? {};

    if (typeof attendeeName !== "string" || !attendeeName.trim()) {
      throw new HttpError(400, "Attendee name is required");
    }

    if (
      typeof attendeeEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail.trim())
    ) {
      throw new HttpError(400, "A valid attendee email is required");
    }

    const { lines } = await validateCart(items);

    const registrations = await createPendingRegistrations(
      lines,
      attendeeName.trim(),
      attendeeEmail.trim(),
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allowed_payment_method_types: ["card"],
      customer_email: attendeeEmail.trim(),

      line_items: lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: "usd",
          unit_amount: line.event.priceCents,
          product_data: {
            name: line.event.title,
            description: line.event.description,
          },
        },
      })),

      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cart`,
    });

    await attachSession(registrations, session.id);

    res.json({ url: session.url });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }

    console.error(err);
    res.status(500).json({ error: "Could not start checkout" });
  }
});

export default router;
