const { PrismaClient } = require("@prisma/client");
const events = require("./events.json");

const prisma = new PrismaClient();

async function main() {
  for (const event of events) {
    await prisma.event.create({
      data: {
        ...event,
        startsAt: new Date(event.startsAt),
      },
    });
  }

  console.log("Events seeded successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
