import { Router } from "express";
import { stripe } from "../stripe.js";
import {
  validateCart,
  createPendingRegistration,
  attachSession,
  HttpError,
} from "../registerService.js";

const router = Router();

// POST /api/checkout  body: { items: [{ productId, quantity }] }
router.post("/", async (req, res) => {
  try {
    // Not Stripe, already built for you: check the cart against our DB and save a PENDING order.
    const { lines, totalCents } = await validateCart(req.body.items);
    const registration = await createPendingRegistration(lines, totalCents);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: "usd",
          unit_amount: l.product.priceCents,
          product_data: {
            name: l.product.name,
            description: l.product.description,
          },
        },
      })),
      metadata: { registrationId: String(registration.id) },
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cart`,
    });

    await attachSession(registration.id, session.id);
    res.json({ url: session.url }); // the React app redirects the browser here
  } catch (err) {
    if (err instanceof HttpError)
      return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Could not start checkout" });
  }
});

export default router;
