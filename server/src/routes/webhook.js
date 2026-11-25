import { Router, raw } from "express";
import { stripe } from "../stripe.js";
import {
  markRegistrationPaid,
  markRegistrationExpired,
} from "../registerService.js";

const router = Router();
router.post("/", raw({ type: "application/json" }), async (req, res) => {
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error(err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event?.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await markRegistrationPaid(Number(session.metadata.orderId), {
          email: session.customer_details?.email ?? null,
          paymentIntentId: session.payment_intent ?? null,
        });
        break;
      }

      case "checkout.session.expired": {
        await markRegistrationExpired(
          Number(event.data.object.metadata.orderId),
        );
        break;
      }

      default:
        console.log(`Unhandled event type ${event?.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).send("Webhook handler failed");
  }
});

export default router;
