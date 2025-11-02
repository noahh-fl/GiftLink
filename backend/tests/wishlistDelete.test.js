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
const testDbPath = path.join(prismaDir, "test-wishlist-delete.db");

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

function createInviteCode() {
  return `INV-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function createJoinCode() {
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

async function createSpace() {
  return prisma.space.create({
    data: {
      name: "Wishlist Space",
      description: null,
      inviteCode: createInviteCode(),
      joinCode: createJoinCode(),
      mode: "price",
    },
  });
}

async function createWishlistItem(spaceId, title = "Camera") {
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

test("DELETE /wishlist/:id removes associated gifts", async () => {
  const space = await createSpace();
  const item = await createWishlistItem(space.id, "Instant Camera");

  await prisma.gift.create({
    data: {
      wishlistItemId: item.id,
    },
  });

  const response = await app.inject({
    method: "DELETE",
    url: `/wishlist/${item.id}`,
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.body, "");

  const remainingGifts = await prisma.gift.count({ where: { wishlistItemId: item.id } });
  assert.equal(remainingGifts, 0);

  const storedItem = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
  assert.equal(storedItem, null);
});

test("DELETE /wishlist/:id removes item without gifts", async () => {
  const space = await createSpace();
  const item = await createWishlistItem(space.id, "Travel Mug");

  const response = await app.inject({
    method: "DELETE",
    url: `/wishlist/${item.id}`,
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.body, "");

  const storedItem = await prisma.wishlistItem.findUnique({ where: { id: item.id } });
  assert.equal(storedItem, null);

  const remainingGifts = await prisma.gift.count({ where: { wishlistItemId: item.id } });
  assert.equal(remainingGifts, 0);
});

test("DELETE /wishlist/:id returns 404 when item is missing", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: "/wishlist/999999",
  });

  assert.equal(response.statusCode, 404);
  const body = response.json();
  assert.equal(body.message, "Wishlist item not found.");
  assert.equal(body.code, "NOT_FOUND");
});
