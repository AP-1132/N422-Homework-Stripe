import { prisma } from "./db.js";

const include = { events: { include: { registrations: true } } };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export { HttpError };

export async function validateCart(events) {
  if (!Array.isArray(events) || events.length === 0)
    throw new HttpError(400, "Cart is empty or invalid");

  const campusEvents = await prisma.event.findMany({
    where: { id: { in: events.map((e) => e.id) } },
  });

  const lines = events.map((event) => {
    const campusEvent = campusEvents.find((e) => e.id === event.id);
    const quantity = Number(event.quantity);
    if (!event || !Number.isInteger(quantity) || quantity < 1)
      throw new HttpError(400, "Invalid event or quantity");
    if (event.capacity < quantity)
      throw new HttpError(
        400,
        `Not enough available seats for event ${event.name}`,
      );
  });

  const totalCents = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  return { lines, totalCents };
}

export function createPendingRegistration(totalCents) {
  return prisma.registration.create({
    data: {
      totalCents,
      status: "PENDING",
    },
  });
}

export function attachSession(orderId, stripeSessionId) {
  return prisma.registration.update({
    where: { id: orderId },
    data: { stripeSessionId },
  });
}

export async function markRegistrationPaid(
  orderId,
  { email, paymentIntentId },
) {
  const order = await prisma.registration.findUnique({
    where: { id: orderId },
    include: { events: true },
  });
  if (!order || order.status === "PAID") return;

  await prisma.$transaction([
    prisma.registration.update({
      where: { id: orderId },
      data: { status: "PAID", attendeeEmail: email, paymentIntentId },
    }),
    ...order.events.map((e) =>
      prisma.event.update({
        where: { id: e.id },
        data: { capacity: { decrement: e.registration.quantity } },
      }),
    ),
  ]);
  console.log(`Registration ${orderId} marked as PAID for ${email}`);
}

export function markRegistrationExpired(orderId) {
  return prisma.registration.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "EXPIRED" },
  });
}

export const listRegistrations = () =>
  prisma.registration.findMany({
    include,
    orderBy: { createdAt: "desc" },
  });

export const findRegistrationBySession = (sessionId) =>
  prisma.registration.findUnique({
    where: { stripeSessionId: sessionId },
    include,
  });

export const findRegistration = (id) =>
  prisma.registration.findUnique({ where: { id } });
export const markRegistrationRefunded = (id) =>
  prisma.registration.update({
    where: { id },
    data: { status: "REFUNDED" },
    include,
  });
