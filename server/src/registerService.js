import { prisma } from "./db.js";
import { stripe } from "./stripe.js";

const HOLD_MS = 15 * 60 * 1000;
const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000;

const include = { event: true };

const stripeOptions = {
  timeout: 8000,
  maxNetworkRetries: 0,
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const activeStatuses = ["PENDING", "CONFIRMED"];

function addSeatsLeft(event) {
  const { registrations, ...details } = event;

  const reserved = registrations.reduce(
    (sum, registration) => sum + registration.quantity,
    0,
  );

  return {
    ...details,
    seatsLeft: Math.max(0, event.capacity - reserved),
  };
}

const availabilityInclude = {
  registrations: {
    where: {
      status: { in: activeStatuses },
    },
    select: {
      quantity: true,
    },
  },
};

export async function listAvailableEvents() {
  const events = await prisma.event.findMany({
    where: {
      startsAt: { gt: new Date() },
    },
    include: availabilityInclude,
    orderBy: { startsAt: "asc" },
  });

  return events.map(addSeatsLeft);
}

export async function findEventWithSeats(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: availabilityInclude,
  });

  return event ? addSeatsLeft(event) : null;
}

async function withRegistration(id, action) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Registration"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      const registration = await tx.registration.findUnique({
        where: { id },
        include,
      });

      if (!registration) {
        throw new HttpError(404, "Registration not found");
      }

      return action(tx, registration);
    },
    {
      maxWait: 10000,
      timeout: 60000,
    },
  );
}

function operationKey(registration, operation) {
  return [
    "registration",
    registration.id,
    registration.createdAt.toISOString(),
    operation,
  ].join("-");
}

function verifyIntent(registration, intent) {
  if (
    intent.metadata?.registrationId !== String(registration.id) ||
    intent.amount !== registration.totalCents ||
    intent.currency !== "usd" ||
    (registration.paymentIntentId && registration.paymentIntentId !== intent.id)
  ) {
    throw new HttpError(409, "PaymentIntent does not match this registration");
  }
}

async function ensureIntent(tx, registration) {
  let intent;

  if (registration.paymentIntentId) {
    intent = await stripe.paymentIntents.retrieve(
      registration.paymentIntentId,
      {},
      stripeOptions,
    );
  } else {
    intent = await stripe.paymentIntents.create(
      {
        amount: registration.totalCents,
        currency: "usd",
        allowed_payment_method_types: ["card"],
        receipt_email: registration.attendeeEmail,
        metadata: {
          registrationId: String(registration.id),
        },
      },
      {
        ...stripeOptions,
        idempotencyKey: operationKey(registration, "create"),
      },
    );
  }

  verifyIntent(registration, intent);

  if (!registration.paymentIntentId) {
    await tx.registration.update({
      where: { id: registration.id },
      data: { paymentIntentId: intent.id },
    });
  }

  return intent;
}

async function updateStatus(tx, registration, status, intent) {
  return tx.registration.update({
    where: { id: registration.id },
    data: {
      status,
      paymentIntentId: intent.id,
    },
    include,
  });
}

async function confirmPayment(tx, registration, intent) {
  verifyIntent(registration, intent);

  if (
    intent.status !== "succeeded" ||
    intent.amount_received !== registration.totalCents
  ) {
    throw new HttpError(409, "Payment has not been completed");
  }

  return updateStatus(tx, registration, "CONFIRMED", intent);
}
async function closePending(tx, registration, intent, finalStatus) {
  verifyIntent(registration, intent);

  if (intent.status === "succeeded") {
    return confirmPayment(tx, registration, intent);
  }

  if (intent.status === "processing") {
    return registration;
  }

  let current = intent;

  if (current.status !== "canceled") {
    try {
      current = await stripe.paymentIntents.cancel(
        current.id,
        {},
        {
          ...stripeOptions,
          idempotencyKey: operationKey(registration, "cancel-intent"),
        },
      );
    } catch (err) {
      current = await stripe.paymentIntents.retrieve(
        intent.id,
        {},
        stripeOptions,
      );

      if (current.status !== "succeeded" && current.status !== "canceled") {
        throw err;
      }
    }
  }

  if (current.status === "succeeded") {
    return confirmPayment(tx, registration, current);
  }

  if (current.status !== "canceled") {
    throw new HttpError(409, "Payment is still being processed");
  }

  return updateStatus(tx, registration, finalStatus, current);
}

async function releaseRejectedCreation(id, err) {
  if (err.type !== "StripeInvalidRequestError") return;

  await prisma.registration.updateMany({
    where: {
      id,
      status: "PENDING",
      paymentIntentId: null,
    },
    data: { status: "FAILED" },
  });
}

export async function createRegistrationPayment({
  eventId,
  attendeeName,
  attendeeEmail,
  quantity,
}) {
  if (
    !Number.isSafeInteger(eventId) ||
    eventId < 1 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 4
  ) {
    throw new HttpError(400, "Invalid event or quantity");
  }

  if (
    typeof attendeeName !== "string" ||
    !attendeeName.trim() ||
    typeof attendeeEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendeeEmail.trim())
  ) {
    throw new HttpError(400, "A valid name and email are required");
  }

  const registration = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "Event"
      WHERE "id" = ${eventId}
      FOR UPDATE
    `;

    const event = await tx.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new HttpError(404, "Event not found");
    }

    if (event.startsAt.getTime() <= Date.now()) {
      throw new HttpError(400, "This event has already started");
    }

    const reserved = await tx.registration.aggregate({
      where: {
        eventId,
        status: { in: activeStatuses },
      },
      _sum: { quantity: true },
    });

    const seatsLeft = event.capacity - (reserved._sum.quantity ?? 0);

    if (seatsLeft <= 0) {
      throw new HttpError(409, "This event is sold out");
    }

    if (quantity > seatsLeft) {
      throw new HttpError(409, "Not enough seats remain");
    }

    const totalCents = event.priceCents * quantity;

    if (!Number.isSafeInteger(totalCents) || totalCents < 50) {
      throw new HttpError(
        400,
        "This registration requires a total of at least $0.50",
      );
    }

    return tx.registration.create({
      data: {
        eventId,
        attendeeName: attendeeName.trim(),
        attendeeEmail: attendeeEmail.trim(),
        quantity,
        totalCents,
        status: "PENDING",
      },
    });
  });

  try {
    return await withRegistration(registration.id, async (tx, current) => {
      if (current.status !== "PENDING") {
        throw new HttpError(409, "Registration is no longer pending");
      }

      const intent = await ensureIntent(tx, current);

      return {
        clientSecret: intent.client_secret,
        registrationId: current.id,
      };
    });
  } catch (err) {
    await releaseRejectedCreation(registration.id, err);
    throw err;
  }
}

function registrationIdFromIntent(intent) {
  const value = intent.metadata?.registrationId;
  const id = Number(value);

  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(id) ||
    id < 1
  ) {
    throw new HttpError(400, "Invalid registration metadata");
  }

  return id;
}

async function reconcileWebhook(payload, eventKind) {
  const id = registrationIdFromIntent(payload);

  return withRegistration(id, async (tx, registration) => {
    if (registration.status !== "PENDING") {
      return registration;
    }

    const intent = await ensureIntent(tx, registration);

    if (intent.id !== payload.id) {
      throw new HttpError(409, "PaymentIntent ID mismatch");
    }

    if (intent.status === "succeeded") {
      return confirmPayment(tx, registration, intent);
    }

    if (eventKind === "failed") {
      if (
        intent.status !== "requires_payment_method" &&
        intent.status !== "canceled"
      ) {
        return registration;
      }
      return closePending(tx, registration, intent, "FAILED");
    }

    if (intent.status === "canceled") {
      return updateStatus(tx, registration, "CANCELLED", intent);
    }

    return registration;
  });
}

export const markRegistrationConfirmed = (intent) =>
  reconcileWebhook(intent, "succeeded");

export const markRegistrationFailed = (intent) =>
  reconcileWebhook(intent, "failed");

export const markRegistrationCancelled = (intent) =>
  reconcileWebhook(intent, "cancelled");

export const listRegistrations = (email) =>
  prisma.registration.findMany({
    where: {
      attendeeEmail: {
        equals: email.trim(),
        mode: "insensitive",
      },
    },
    include,
    orderBy: { createdAt: "desc" },
  });

export const findRegistration = (id) =>
  prisma.registration.findUnique({
    where: { id },
    include,
  });

export async function cancelRegistration(id) {
  return withRegistration(id, async (tx, registration) => {
    if (registration.status !== "CONFIRMED") {
      throw new HttpError(409, "Only confirmed registrations can be cancelled");
    }

    if (!registration.paymentIntentId) {
      throw new HttpError(409, "Registration has no payment");
    }
    const refunds = await stripe.refunds.list(
      {
        payment_intent: registration.paymentIntentId,
        limit: 100,
      },
      stripeOptions,
    );

    let refund = refunds.data.find(
      (item) =>
        item.metadata?.registrationId === String(id) &&
        item.amount === registration.totalCents,
    );

    const fullRefund =
      registration.event.startsAt.getTime() - Date.now() > REFUND_WINDOW_MS;

    if (!refund && fullRefund) {
      refund = await stripe.refunds.create(
        {
          payment_intent: registration.paymentIntentId,
          amount: registration.totalCents,
          metadata: {
            registrationId: String(id),
          },
        },
        {
          ...stripeOptions,
          idempotencyKey: operationKey(registration, "refund"),
        },
      );
    }

    if (refund && refund.status !== "succeeded") {
      throw new HttpError(
        409,
        `Refund status is ${refund.status}. Check again before retrying payment or cancellation.`,
      );
    }

    return tx.registration.update({
      where: { id },
      data: {
        status: refund ? "REFUNDED" : "CANCELLED",
      },
      include,
    });
  });
}

export async function expirePendingRegistrations() {
  const cutoff = new Date(Date.now() - HOLD_MS);

  const stale = await prisma.registration.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: cutoff },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const { id } of stale) {
    try {
      await withRegistration(id, async (tx, registration) => {
        if (
          registration.status !== "PENDING" ||
          registration.createdAt.getTime() > cutoff.getTime()
        ) {
          return;
        }

        const intent = await ensureIntent(tx, registration);

        await closePending(tx, registration, intent, "CANCELLED");
      });
    } catch (err) {
      await releaseRejectedCreation(id, err);

      console.error(`Could not expire registration ${id}:`, err.message);
    }
  }
}
