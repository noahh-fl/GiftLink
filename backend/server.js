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
