import { before, beforeEach, after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, "..");
const prismaDir = path.join(backendRoot, "prisma");
const testDbPath = path.join(prismaDir, "test-reward-economy.db");

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

  const serverModule = await import("../server.js");
  app = serverModule.app;
  await app.ready();
  ({ default: prisma } = await import("../prisma/prisma.js"));
});

beforeEach(async () => {
  await prisma.activity.deleteMany();
  await prisma.rewardRedemption.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.space.deleteMany();
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
  return prisma.space.create({
    data: {
      name: `${mode}-space`,
      description: null,
      inviteCode: `${mode}-invite`,
      joinCode: `${mode}-join`,
      mode,
    },
  });
}

const CREDIT = "CREDIT";
const DEBIT = "DEBIT";

test("GET /spaces/:id/balance reflects credits minus debits", async () => {
  const space = await createSpace();

  await prisma.ledgerEntry.create({
    data: {
      spaceId: space.id,
      userKey: "tester-alpha",
      type: CREDIT,
      points: 80,
      reason: "seed",
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      spaceId: space.id,
      userKey: "tester-alpha",
      type: DEBIT,
      points: 30,
      reason: "spend",
    },
  });

  const response = await app.inject({
    method: "GET",
    url: `/spaces/${space.id}/balance`,
    headers: { "x-user-id": "tester-alpha" },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.userId, "tester-alpha");
  assert.equal(body.points, 50);
});

test("POST /spaces/:id/rewards/:rewardId/redeem debits points and records redemption", async () => {
  const space = await createSpace();

  const reward = await prisma.reward.create({
    data: {
      spaceId: space.id,
      ownerKey: "partner", 
      title: "Massage night",
      points: 40,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      spaceId: space.id,
      userKey: "tester-alpha",
      type: CREDIT,
      points: 60,
      reason: "gift:receive",
    },
  });

  const response = await app.inject({
    method: "POST",
    url: `/spaces/${space.id}/rewards/${reward.id}/redeem`,
    headers: { "x-user-id": "tester-alpha" },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.balance.userId, "tester-alpha");
  assert.equal(body.balance.points, 20);
  assert.equal(body.purchase.rewardId, reward.id);
  assert.equal(body.purchase.status, "PENDING");

  const debits = await prisma.ledgerEntry.findMany({
    where: { spaceId: space.id, userKey: "tester-alpha", type: DEBIT },
  });
  assert.equal(debits.length, 1);
  assert.equal(debits[0].points, reward.points);

  const activity = await prisma.activity.findMany({ where: { spaceId: space.id } });
  assert.equal(activity.length, 1);
  assert.equal(activity[0].type, "reward_redeem");
});

test("POST /spaces/:id/rewards/:rewardId/redeem rejects insufficient balances", async () => {
  const space = await createSpace();

  const reward = await prisma.reward.create({
    data: {
      spaceId: space.id,
      ownerKey: "partner",
      title: "Dinner date",
      points: 30,
    },
  });

  const response = await app.inject({
    method: "POST",
    url: `/spaces/${space.id}/rewards/${reward.id}/redeem`,
    headers: { "x-user-id": "tester-alpha" },
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.message, "Not enough points to redeem this reward.");
});
