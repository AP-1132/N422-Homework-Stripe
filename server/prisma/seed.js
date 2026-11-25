import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be configured");
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// All dates are calculated relative to when the seed runs.
const now = Date.now();

const events = [
  {
    title: "Indy Indie Game Showcase",
    description:
      "An evening of locally developed indie games, live demonstrations, and conversations with their creators.",
    location: "Indianapolis, IN",
    startsAt: new Date(now + 7 * DAY_MS),
    priceCents: 1500,
    capacity: 3,
  },
  {
    title: "Frontend Developer Meetup",
    description:
      "A casual meetup for web developers to share projects, exchange ideas, and discuss frontend tools.",
    location: "Indianapolis, IN",
    startsAt: new Date(now + 24 * HOUR_MS),
    priceCents: 500,
    capacity: 25,
  },
  {
    title: "Fall Creative Expo",
    description:
      "A community exhibition celebrating local artists, designers, and makers.",
    location: "Indianapolis, IN",
    startsAt: new Date(now - 7 * DAY_MS),
    priceCents: 1200,
    capacity: 60,
  },
  {
    title: "Winter Web Design Workshop",
    description:
      "A hands-on workshop covering responsive layouts, accessibility, and practical interface design.",
    location: "Carmel, IN",
    startsAt: new Date(now + 14 * DAY_MS),
    priceCents: 3500,
    capacity: 20,
  },
  {
    title: "Local Music Night",
    description:
      "An evening of live performances featuring emerging regional bands and solo artists.",
    location: "Indianapolis, IN",
    startsAt: new Date(now + 21 * DAY_MS),
    priceCents: 2200,
    capacity: 100,
  },
  {
    title: "Tech Networking Social",
    description:
      "A networking event for students, developers, designers, and technology professionals.",
    location: "Fishers, IN",
    startsAt: new Date(now + 28 * DAY_MS),
    priceCents: 1000,
    capacity: 45,
  },
  {
    title: "Digital Illustration Masterclass",
    description:
      "An instructor-led session exploring illustration techniques, composition, and digital creative workflows.",
    location: "Bloomington, IN",
    startsAt: new Date(now + 35 * DAY_MS),
    priceCents: 4500,
    capacity: 12,
  },
];

async function main() {
  // Create the complete seed in one transaction.
  const result = await prisma.event.createMany({
    data: events,
  });

  console.log(`Successfully seeded ${result.count} events.`);
  console.log("Included:");
  console.log("- An event with capacity 3");
  console.log("- An event starting in 24 hours");
  console.log("- An event that started 7 days ago");
}

try {
  await main();
} catch (error) {
  console.error("Event seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
