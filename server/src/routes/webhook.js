import { Router, raw } from "express";
import { stripe } from "../stripe.js";
import {
  markRegistrationConfirmed,
  markRegistrationFailed,
  markRegistrationCancelled,
} from "../registerService.js";

const router = Router();

router.post("/", raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");

    return res.status(500).json({
      error: "Webhook is not configured",
    });
  }

  if (typeof signature !== "string") {
    return res.status(400).json({
      error: "Missing Stripe signature",
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook verification failed:", err.message);

    return res.status(400).json({
      error: "Invalid webhook signature",
    });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        const paymentIntent = event.data.object;

        if (!paymentIntent.metadata?.registrationId) {
          break;
        }

        if (event.type === "payment_intent.succeeded") {
          await markRegistrationConfirmed(paymentIntent);
        } else if (event.type === "payment_intent.payment_failed") {
          await markRegistrationFailed(paymentIntent);
        } else {
          await markRegistrationCancelled(paymentIntent);
        }

        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error(`Webhook processing failed for ${event.id}:`, err);

    return res.status(500).json({
      error: "Webhook processing failed",
    });
  }
});

export default router;
