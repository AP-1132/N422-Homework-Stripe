import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
  const events = await prisma.product.findMany({
    include: { events: true },
    orderBy: { id: "asc" },
  });
  res.json(events);
});

export default router;
