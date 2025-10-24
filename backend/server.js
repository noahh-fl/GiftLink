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

// list users
app.get("/users", async () => {
  const users = await prisma.user.findMany();
  return users;
});

// start server
app.listen({ port: 3000 }, (err, address) => {
  if (err) throw err;
  console.log(`Server running at ${address}`);
});
