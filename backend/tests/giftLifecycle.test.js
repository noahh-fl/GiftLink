import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, "..");
const prismaDir = path.join(backendRoot, "prisma");
const testDbPath = path.join(prismaDir, "test.db");

let app;
let prisma;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = `file:${testDbPath}`;

  try {
    await fs.unlink(testDbPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  execFileSync(
    "npx",
    ["prisma", "migrate", "reset", "--force", "--skip-seed", "--skip-generate"],
    {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
      stdio: "inherit",
    },
  );

  execFileSync(
    "npx",
    ["prisma", "generate"],
    {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
      stdio: "inherit",
    },
  );

  const serverModule = await import("../server.js");
  app = serverModule.app;
  await app.ready();
  ({ default: prisma } = await import("../prisma/prisma.js"));
});

beforeEach(async () => {
  await prisma.gift.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.space.deleteMany();
  await prisma.user.deleteMany();
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (prisma) {
    await prisma.$disconnect();
  }
  try {
    await fs.unlink(testDbPath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
});

async function createSpace(mode = "price") {
  const inviteCode = `INV-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const joinCode = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return prisma.space.create({
    data: {
      name: `${mode}-space`,
      description: null,
      inviteCode,
      joinCode,
      mode,
    },
  });
}

async function createUser(emailPrefix) {
  return prisma.user.create({
    data: {
      name: `${emailPrefix} User`,
      email: `${emailPrefix}-${randomUUID()}@example.com`,
    },
  });
}

test("wishlist lifecycle awards price-indexed points", async () => {
  const [space, user] = await Promise.all([createSpace("price"), createUser("price")]);

  const createResponse = await app.inject({
    method: "POST",
    url: "/wishlist",
    payload: {
      spaceId: space.id,
      title: "Coffee Grinder",
      priceCents: 2599,
      priority: "high",
      notes: "Prefer burr grinder",
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const createdItem = createResponse.json();
  assert.equal(createdItem.title, "Coffee Grinder");
  assert.equal(createdItem.priority, "HIGH");
  assert.ok(createdItem.gift);

  const giftId = createdItem.gift.id;

  const reserveResponse = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/reserve`,
    payload: { giverId: user.id },
  });
  assert.equal(reserveResponse.statusCode, 200);
  assert.equal(reserveResponse.json().status, "RESERVED");

  const purchaseResponse = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/purchase`,
    payload: {},
  });
  assert.equal(purchaseResponse.statusCode, 200);
  assert.equal(purchaseResponse.json().status, "PURCHASED");

  const deliverResponse = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/deliver`,
  });
  assert.equal(deliverResponse.statusCode, 200);
  assert.equal(deliverResponse.json().status, "DELIVERED");

  const receiveResponse = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/receive`,
  });
  assert.equal(receiveResponse.statusCode, 200);
  const receiveBody = receiveResponse.json();
  assert.equal(receiveBody.status, "RECEIVED");
  assert.equal(receiveBody.mode, "PRICE");
  assert.equal(receiveBody.pointsAwarded, 26);

  const listResponse = await app.inject({
    method: "GET",
    url: `/wishlist?spaceId=${space.id}`,
  });
  assert.equal(listResponse.statusCode, 200);
  const list = listResponse.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].gift.status, "RECEIVED");
});

test("sentiment-valued spaces require sentiment points on receive", async () => {
  const [space, user] = await Promise.all([createSpace("sentiment"), createUser("sentiment")]);

  const createResponse = await app.inject({
    method: "POST",
    url: "/wishlist",
    payload: {
      spaceId: space.id,
      title: "Handwritten Letter",
      priority: "medium",
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const giftId = createResponse.json().gift.id;

  const reserveResponse = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/reserve`,
    payload: { giverId: user.id },
  });
  assert.equal(reserveResponse.statusCode, 200);

  const purchaseResponse = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/purchase`,
    payload: {},
  });
  assert.equal(purchaseResponse.statusCode, 200);

  const deliverResponse = await app.inject({ method: "POST", url: `/gift/${giftId}/deliver` });
  assert.equal(deliverResponse.statusCode, 200);

  const missingSentiment = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/receive`,
    payload: {},
  });
  assert.equal(missingSentiment.statusCode, 400);

  const receiveResponse = await app.inject({
    method: "POST",
    url: `/gift/${giftId}/receive`,
    payload: { sentimentPoints: 17 },
  });
  assert.equal(receiveResponse.statusCode, 200);
  const body = receiveResponse.json();
  assert.equal(body.mode, "SENTIMENT");
  assert.equal(body.pointsAwarded, 17);
});
