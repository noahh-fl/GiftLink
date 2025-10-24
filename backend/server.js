import Fastify from "fastify";
import cors from "@fastify/cors";
import prisma from "./prisma/prisma.js";

const app = Fastify();

// enable form parsing
app.register(import("@fastify/formbody"));

// enable CORS for frontend
await app.register(cors, {
  origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
});

// test route
app.get("/", async () => {
  return { message: "GiftLink backend is running!" };
});

// create user
app.post("/user", async (req, res) => {
  const { name, email } = req.body;
  const user = await prisma.user.create({
    data: { name, email },
  });
  return user;
});

const SPACE_MODES = new Set(["price", "sentiment"]);

app.post("/space", async (req, res) => {
  const { name, description, mode } = req.body ?? {};
  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedDescription =
    typeof description === "string" && description.trim().length > 0
      ? description.trim()
      : null;
  const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : "";

  if (!trimmedName) {
    return res.status(400).send({ message: "Name is required." });
  }

  if (!SPACE_MODES.has(normalizedMode)) {
    return res
      .status(400)
      .send({ message: "Mode must be either 'price' or 'sentiment'." });
  }

  try {
    const space = await prisma.space.create({
      data: {
        name: trimmedName,
        description: trimmedDescription,
        mode: normalizedMode,
      },
    });
    return res.status(201).send(space);
  } catch (error) {
    req.log.error({ err: error }, "Failed to create space");
    return res.status(500).send({ message: "Failed to create space." });
  }
});

app.get("/space", async () => {
  const spaces = await prisma.space.findMany({
    orderBy: { createdAt: "desc" },
  });
  return spaces;
});

function parseIdParam(value, name, res) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    res.status(400).send({ message: `${name} must be a positive integer.` });
    return null;
  }
  return parsed;
}

function normalizeGiftPayload(payload = {}, res) {
  if (!payload || typeof payload !== "object") {
    res.status(400).send({ message: "Body must be a JSON object." });
    return null;
  }

  const rawName = "name" in payload ? payload.name : "";
  const rawUrl = "url" in payload ? payload.url : "";

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const url = typeof rawUrl === "string" ? rawUrl.trim() : "";

  if (!name) {
    res.status(400).send({ message: "Gift name is required." });
    return null;
  }

  if (!url) {
    res.status(400).send({ message: "Gift URL is required." });
    return null;
  }

  const image =
    "image" in payload && typeof payload.image === "string" && payload.image.trim()
      ? payload.image.trim()
      : null;

  const category =
    "category" in payload && typeof payload.category === "string" && payload.category.trim()
      ? payload.category.trim()
      : null;

  let price = null;
  if ("price" in payload) {
    const rawPrice = payload.price;
    if (typeof rawPrice === "number") {
      price = Number.isFinite(rawPrice) ? rawPrice : null;
    } else if (typeof rawPrice === "string") {
      const trimmed = rawPrice.trim();
      if (trimmed) {
        const parsed = Number.parseFloat(trimmed);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
          price = parsed;
        } else {
          res.status(400).send({ message: "Price must be a valid number." });
          return null;
        }
      }
    } else if (rawPrice !== null && rawPrice !== undefined) {
      res.status(400).send({ message: "Price must be a number." });
      return null;
    }

    if (price !== null && price < 0) {
      res.status(400).send({ message: "Price cannot be negative." });
      return null;
    }
  }

  return {
    name,
    url,
    image,
    category,
    price,
  };
}

function calculatePointsForGift(mode, price) {
  if (mode === "sentiment") {
    return 10;
  }

  const resolvedPrice = typeof price === "number" && Number.isFinite(price) ? price : 0;
  const rounded = Math.ceil(resolvedPrice);
  return Number.isFinite(rounded) && rounded > 0 ? rounded : 0;
}

// list users
app.get("/users", async () => {
  const users = await prisma.user.findMany();
  return users;
});

app.post("/space/:id/gift", async (req, res) => {
  const spaceId = parseIdParam(req.params.id, "Space id", res);
  if (!spaceId) return;

  const giftPayload = normalizeGiftPayload(req.body, res);
  if (!giftPayload) return;

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true },
    });

    if (!space) {
      return res.status(404).send({ message: "Space not found." });
    }

    const gift = await prisma.gift.create({
      data: {
        ...giftPayload,
        spaceId: spaceId,
      },
    });

    return res.status(201).send(gift);
  } catch (error) {
    req.log.error({ err: error }, "Failed to create gift");
    return res.status(500).send({ message: "Failed to create gift." });
  }
});

app.get("/space/:id/gifts", async (req, res) => {
  const spaceId = parseIdParam(req.params.id, "Space id", res);
  if (!spaceId) return;

  try {
    const gifts = await prisma.gift.findMany({
      where: { spaceId },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).send(gifts);
  } catch (error) {
    req.log.error({ err: error }, "Failed to list gifts");
    return res.status(500).send({ message: "Failed to load gifts." });
  }
});

app.patch("/gift/:id/confirm", async (req, res) => {
  const giftId = parseIdParam(req.params.id, "Gift id", res);
  if (!giftId) return;

  try {
    const gift = await prisma.gift.findUnique({
      where: { id: giftId },
      include: {
        space: true,
      },
    });

    if (!gift) {
      return res.status(404).send({ message: "Gift not found." });
    }

    if (gift.confirmed) {
      return res.status(200).send(gift);
    }

    const pointsToAward = calculatePointsForGift(gift.space.mode, gift.price);

    const [updatedGift] = await prisma.$transaction([
      prisma.gift.update({
        where: { id: giftId },
        data: { confirmed: true },
      }),
      prisma.space.update({
        where: { id: gift.spaceId },
        data: { points: { increment: pointsToAward } },
      }),
    ]);

    return res.status(200).send(updatedGift);
  } catch (error) {
    req.log.error({ err: error }, "Failed to confirm gift");
    return res.status(500).send({ message: "Failed to confirm gift." });
  }
});

app.get("/space/:id/points", async (req, res) => {
  const spaceId = parseIdParam(req.params.id, "Space id", res);
  if (!spaceId) return;

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { points: true },
    });

    if (!space) {
      return res.status(404).send({ message: "Space not found." });
    }

    return res.status(200).send({ points: space.points });
  } catch (error) {
    req.log.error({ err: error }, "Failed to get space points");
    return res.status(500).send({ message: "Failed to fetch points." });
  }
});

// start server
app.listen({ port: 3000 }, (err, address) => {
  if (err) throw err;
  console.log(`Server running at ${address}`);
});
