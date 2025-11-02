import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, "..");
const prismaDir = path.join(backendRoot, "prisma");
const testDbPath = path.join(prismaDir, "test-bulk-archive.db");

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

async function createSpace() {
  return prisma.space.create({
    data: {
      name: "Bulk Archive Space",
      description: null,
      inviteCode: "BULK1234",
      joinCode: "JOIN12",
      mode: "price",
    },
  });
}

async function createWishlistItem(spaceId, title) {
  return prisma.wishlistItem.create({
    data: {
      spaceId,
      title,
      url: null,
      image: null,
      priceCents: null,
      category: null,
      notes: null,
      priority: "MEDIUM",
    },
  });
}

test("POST /wishlist/bulk-archive archives multiple items and reports missing", async () => {
  const space = await createSpace();
  const first = await createWishlistItem(space.id, "Camera");
  const second = await createWishlistItem(space.id, "Headphones");
  const third = await createWishlistItem(space.id, "Notebook");

  const response = await app.inject({
    method: "POST",
    url: "/wishlist/bulk-archive",
    payload: { ids: [first.id, second.id, 9999] },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.updatedCount, 2);
  assert.deepEqual(body.ids, [first.id, second.id, 9999]);
  assert.deepEqual(body.notFound, [9999]);

  const refreshed = await prisma.wishlistItem.findMany({
    where: { id: { in: [first.id, second.id, third.id] } },
    orderBy: { id: "asc" },
  });

  const archivedLookup = new Map(refreshed.map((item) => [item.id, item]));
  assert.equal(archivedLookup.get(first.id)?.archived, true);
  assert.ok(archivedLookup.get(first.id)?.archivedAt);
  assert.equal(archivedLookup.get(second.id)?.archived, true);
  assert.ok(archivedLookup.get(second.id)?.archivedAt);
  assert.equal(archivedLookup.get(third.id)?.archived, false);
  assert.equal(archivedLookup.get(third.id)?.archivedAt, null);
});

test("POST /wishlist/bulk-archive is idempotent", async () => {
  const space = await createSpace();
  const item = await createWishlistItem(space.id, "Sketchbook");

  const firstResponse = await app.inject({
    method: "POST",
    url: "/wishlist/bulk-archive",
    payload: { ids: [item.id] },
  });

  assert.equal(firstResponse.statusCode, 200);
  const firstBody = firstResponse.json();
  assert.equal(firstBody.updatedCount, 1);
  assert.deepEqual(firstBody.notFound, []);

  const secondResponse = await app.inject({
    method: "POST",
    url: "/wishlist/bulk-archive",
    payload: { ids: [item.id] },
  });

  assert.equal(secondResponse.statusCode, 200);
  const secondBody = secondResponse.json();
  assert.equal(secondBody.updatedCount, 0);
  assert.deepEqual(secondBody.notFound, []);

  const stored = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
  assert.equal(stored.archived, true);
  assert.ok(stored.archivedAt);
});

test("POST /wishlist/bulk-archive rejects invalid payload", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/wishlist/bulk-archive",
    payload: { ids: [] },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.match(body.message, /ids must be a non-empty array/i);
});
