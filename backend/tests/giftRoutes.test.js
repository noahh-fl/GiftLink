import { before, beforeEach, after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(testDir, "..");
const prismaDir = path.join(backendRoot, "prisma");
const testDbPath = path.join(prismaDir, "test-gift-routes.db");

let app;
let prisma;
const originalFetch = global.fetch;

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = `file:${testDbPath}`;
  process.env.PEEKALINK_API_KEY = "test-key";

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
  if (!prisma) {
    ({ default: prisma } = await import("../prisma/prisma.js"));
  }

  global.fetch = originalFetch;

  await prisma.gift.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.space.deleteMany();
  await prisma.user.deleteMany();
});

afterEach(() => {
  global.fetch = originalFetch;
});

after(async () => {
  global.fetch = originalFetch;
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

test("POST /gifts/parse prefers amazonProduct details from Peekalink", async () => {
  const peekResponse = {
    type: "AMAZON_PRODUCT",
    amazonProduct: {
      title: "Amazon.com:   Stainless Steel Water Bottle  ",
      price: 24.49,
      currency: "usd",
      media: [
        {
          original: { url: "https://images.example/bottle-original.jpg" },
          large: { url: "https://images.example/bottle-large.jpg" },
        },
      ],
      asin: "B000TESTING",
      features: [" Keeps drinks cold ", "Vacuum insulated"],
      rating: 4.6,
      reviewCount: 1250,
    },
    image: {
      large: { url: "https://images.example/amazon-logo.jpg" },
    },
    price: {
      value: 99.99,
      currency: "CAD",
    },
  };

  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.peekalink.io/");
    assert.equal(options?.method, "POST");
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body, { link: "https://www.amazon.com/dp/B000TESTING" });
    return new Response(JSON.stringify(peekResponse), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await app.inject({
    method: "POST",
    url: "/gifts/parse",
    payload: { url: "https://www.amazon.com/dp/B000TESTING" },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body, {
    title: "Stainless Steel Water Bottle",
    rawTitle: "Amazon.com:   Stainless Steel Water Bottle  ",
    price: 24.49,
    currency: "USD",
    imageUrl: "https://images.example/bottle-original.jpg",
    asin: "B000TESTING",
    features: ["Keeps drinks cold", "Vacuum insulated"],
    rating: 4.6,
    reviewCount: 1250,
  });
});

test("POST /gifts/parse falls back to null price when unavailable", async () => {
  const peekResponse = {
    type: "AMAZON_PRODUCT",
    amazonProduct: {
      title: "Amazon.com: Minimal Title",
      media: [],
    },
    page: {
      rawTextUrl: "https://peekalink.example/raw",
    },
  };

  global.fetch = async (url) => {
    if (url === "https://api.peekalink.io/") {
      return new Response(JSON.stringify(peekResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url === "https://peekalink.example/raw") {
      return new Response("No pricing information", { status: 200 });
    }

    throw new Error(`Unexpected fetch call to ${url}`);
  };

  const response = await app.inject({
    method: "POST",
    url: "/gifts/parse",
    payload: { url: "https://www.amazon.com/dp/B0TESTING0" },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.price, null);
  assert.equal(body.currency, null);
});

test("POST /gifts/parse rejects unsupported domains", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/gifts/parse",
    payload: { url: "https://example.com/not-amazon" },
  });

  assert.equal(response.statusCode, 422);
  const body = response.json();
  assert.match(body.message, /amazon product links/i);
});

test("POST /spaces/:id/gifts stores sentiment points for value spaces", async () => {
  const space = await createSpace("sentiment");

  const response = await app.inject({
    method: "POST",
    url: `/spaces/${space.id}/gifts`,
    payload: {
      title: "Handmade Mug",
      url: "https://www.amazon.com/dp/MUG1234567",
      price: 18.75,
      imageUrl: "https://images.example/mug.jpg",
      notes: "Matches the kitchen",
      points: 45,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.ok(body?.wishlistItem);
  assert.equal(body.wishlistItem.title, "Handmade Mug");
  assert.equal(body.wishlistItem.points, 45);
  assert.equal(body.wishlistItem.gift.sentimentPoints, 45);
  assert.equal(body.wishlistItem.gift.pricePointsLocked, null);
});

test("POST /spaces/:id/gifts auto-calculates points for price spaces", async () => {
  const space = await createSpace("price");

  const response = await app.inject({
    method: "POST",
    url: `/spaces/${space.id}/gifts`,
    payload: {
      title: "Cast Iron Skillet",
      url: "https://www.amazon.com/dp/SKILLET123",
      price: 39.2,
      imageUrl: null,
      notes: null,
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.ok(body?.wishlistItem);
  assert.equal(body.wishlistItem.points, 39);
  assert.equal(body.wishlistItem.gift.pricePointsLocked, 39);
  assert.equal(body.wishlistItem.gift.sentimentPoints, null);
});

test("POST /spaces/:id/gifts requires price for price-based spaces", async () => {
  const space = await createSpace("price");

  const response = await app.inject({
    method: "POST",
    url: `/spaces/${space.id}/gifts`,
    payload: {
      title: "Bluetooth Speaker",
      url: "https://www.amazon.com/dp/SPEAKER1",
      notes: "Loud", 
    },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.match(body.message, /price is required/i);
});
