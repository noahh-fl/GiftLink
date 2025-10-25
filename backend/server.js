import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes } from "node:crypto";
import prisma from "./prisma/prisma.js";

const app = Fastify({ logger: true });

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

const INVITE_CODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";
const INVITE_CODE_MIN_LENGTH = 6;
const INVITE_CODE_MAX_LENGTH = 10;
const INVITE_CODE_REGEX = /^[A-Z0-9-]{6,10}$/;
const MAX_INVITE_CODE_ATTEMPTS = 5;

const JOIN_CODE_REGEX = /^[A-Z0-9]{6,8}$/;
const JOIN_CODE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const JOIN_CODE_LENGTH = 6;
const MAX_JOIN_CODE_ATTEMPTS = 5;

const JOIN_RATE_LIMIT = 10;
const JOIN_RATE_WINDOW_MS = 5 * 60 * 1000;
const joinAttemptTracker = new Map();

const DEFAULT_SPACE_MODE = "price";

const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL_SERVER_ERROR",
};

function generateInviteCode() {
  const lengthSpread = INVITE_CODE_MAX_LENGTH - INVITE_CODE_MIN_LENGTH + 1;
  const randomLength = INVITE_CODE_MIN_LENGTH + (randomBytes(1)[0] % lengthSpread);
  const chunk = randomBytes(randomLength);

  let inviteCode = "";
  for (let idx = 0; idx < chunk.length; idx += 1) {
    const charIndex = chunk[idx] % INVITE_CODE_CHARSET.length;
    inviteCode += INVITE_CODE_CHARSET[charIndex];
  }
  return inviteCode;
}

function isValidJoinCode(code) {
  if (typeof code !== "string") {
    return false;
  }
  return JOIN_CODE_REGEX.test(code);
}

async function generateJoinCode() {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
    const chunk = randomBytes(JOIN_CODE_LENGTH);
    let joinCode = "";
    for (let idx = 0; idx < chunk.length; idx += 1) {
      const charIndex = chunk[idx] % JOIN_CODE_CHARSET.length;
      joinCode += JOIN_CODE_CHARSET[charIndex];
    }

    const existing = await prisma.space.findUnique({
      where: { joinCode },
      select: { id: true },
    });

    if (!existing) {
      return joinCode;
    }
  }

  const error = new Error("Failed to generate unique join code.");
  error.code = "JOIN_CODE_GENERATION_FAILED";
  throw error;
}

async function createSpaceWithInvite(data = {}) {
  const prepared = {
    ...data,
    mode:
      typeof data.mode === "string" && data.mode.trim()
        ? data.mode.trim().toLowerCase()
        : DEFAULT_SPACE_MODE,
    description:
      data.description === null || data.description === undefined
        ? null
        : data.description,
  };

  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt += 1) {
    try {
      const joinCode = await generateJoinCode();
      return await prisma.space.create({
        data: {
          ...prepared,
          inviteCode: generateInviteCode(),
          joinCode,
        },
      });
    } catch (error) {
      if (error?.code === "JOIN_CODE_GENERATION_FAILED") {
        throw error;
      }
      if (isInviteCodeUniqueError(error) || isJoinCodeUniqueError(error)) {
        continue;
      }
      throw error;
    }
  }

  const error = new Error("Unable to allocate unique invite/join code.");
  error.code = "SPACE_CODE_CONFLICT";
  throw error;
}

function isInviteCodeUniqueError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((value) => typeof value === "string" && value.includes("inviteCode"));
  }
  return typeof target === "string" && target.includes("inviteCode");
}

function isJoinCodeUniqueError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((value) => typeof value === "string" && value.includes("joinCode"));
  }
  return typeof target === "string" && target.includes("joinCode");
}

function sendJsonError(res, statusCode, message, code) {
  return res.status(statusCode).send({ message, code });
}

function hasExceededJoinRateLimit(ipAddress) {
  const now = Date.now();
  const key = typeof ipAddress === "string" && ipAddress ? ipAddress : "unknown";
  const record = joinAttemptTracker.get(key);

  if (!record || now - record.windowStart >= JOIN_RATE_WINDOW_MS) {
    joinAttemptTracker.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (record.count >= JOIN_RATE_LIMIT) {
    return true;
  }

  record.count += 1;
  return false;
}

function isOwnerRequest(req) {
  const ownerHeader = req.headers["x-owner"];
  if (Array.isArray(ownerHeader)) {
    return ownerHeader.some(
      (value) => typeof value === "string" && value.toLowerCase() === "true",
    );
  }
  if (typeof ownerHeader === "string") {
    return ownerHeader.toLowerCase() === "true";
  }
  if (typeof ownerHeader === "boolean") {
    return ownerHeader === true;
  }
  return false;
}

function normalizeSpacePayload(payload, { requireName = false } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Body must be a JSON object." };
  }

  const normalized = {};

  if ("name" in payload) {
    if (typeof payload.name !== "string") {
      return { error: "Name must be a string between 2 and 60 characters." };
    }
    const trimmedName = payload.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      return { error: "Name must be between 2 and 60 characters." };
    }
    normalized.name = trimmedName;
  } else if (requireName) {
    return { error: "Name is required." };
  }

  if ("description" in payload) {
    if (payload.description === null) {
      normalized.description = null;
    } else if (typeof payload.description === "string") {
      const trimmedDescription = payload.description.trim();
      if (trimmedDescription.length > 280) {
        return { error: "Description must be 280 characters or fewer." };
      }
      normalized.description = trimmedDescription.length ? trimmedDescription : null;
    } else {
      return { error: "Description must be a string if provided." };
    }
  }

  return { value: normalized };
}

function parseSpaceId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: "Space id must be a positive integer." };
  }
  return { value: parsed };
}

function serializeSpace(space) {
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    inviteCode: space.inviteCode,
    joinCode: space.joinCode,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
  };
}

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
    const space = await createSpaceWithInvite({
      name: trimmedName,
      description: trimmedDescription,
      mode: normalizedMode,
    });
    return res.status(201).send(space);
  } catch (error) {
    if (error?.code === "SPACE_CODE_CONFLICT") {
      return res.status(409).send({ message: "Failed to create space due to code conflict." });
    }
    if (error?.code === "JOIN_CODE_GENERATION_FAILED") {
      req.log.error({ err: error }, "Failed to allocate join code");
      return res.status(500).send({ message: "Failed to create space." });
    }
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

app.post("/spaces", async (req, res) => {
  const { value, error } = normalizeSpacePayload(req.body, { requireName: true });
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  const description = Object.prototype.hasOwnProperty.call(value, "description") ? value.description : null;

  try {
    const space = await createSpaceWithInvite({
      name: value.name,
      description,
      mode: DEFAULT_SPACE_MODE,
    });
    return res.status(201).send({ space: serializeSpace(space) });
  } catch (creationError) {
    if (creationError?.code === "SPACE_CODE_CONFLICT") {
      return sendJsonError(
        res,
        409,
        "Code collision, please retry.",
        ERROR_CODES.CONFLICT,
      );
    }
    if (creationError?.code === "JOIN_CODE_GENERATION_FAILED") {
      req.log.error({ err: creationError }, "Failed to allocate join code");
      return sendJsonError(res, 500, "Failed to create space.", ERROR_CODES.INTERNAL);
    }
    req.log.error({ err: creationError }, "Failed to create space");
    return sendJsonError(res, 500, "Failed to create space.", ERROR_CODES.INTERNAL);
  }
});

app.get("/spaces/:id", async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).send({ space: serializeSpace(space) });
  } catch (loadError) {
    req.log.error({ err: loadError }, "Failed to load space");
    return sendJsonError(res, 500, "Failed to load space.", ERROR_CODES.INTERNAL);
  }
});

app.patch("/spaces/:id", async (req, res) => {
  const { value: spaceId, error: idError } = parseSpaceId(req.params.id);
  if (idError) {
    return sendJsonError(res, 400, idError, ERROR_CODES.BAD_REQUEST);
  }

  const { value, error } = normalizeSpacePayload(req.body ?? {});
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  if (!value || Object.keys(value).length === 0) {
    return sendJsonError(
      res,
      400,
      "Provide at least one field to update.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  try {
    const space = await prisma.space.update({
      where: { id: spaceId },
      data: value,
    });
    return res.status(200).send({ space: serializeSpace(space) });
  } catch (updateError) {
    if (updateError?.code === "P2025") {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }
    req.log.error({ err: updateError }, "Failed to update space");
    return sendJsonError(res, 500, "Failed to update space.", ERROR_CODES.INTERNAL);
  }
});

app.delete("/spaces/:id", async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  try {
    await prisma.space.delete({
      where: { id: spaceId },
    });
    return res.status(204).send();
  } catch (deleteError) {
    if (deleteError?.code === "P2025") {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }
    req.log.error({ err: deleteError }, "Failed to delete space");
    return sendJsonError(res, 500, "Failed to delete space.", ERROR_CODES.INTERNAL);
  }
});

app.get("/spaces", async (req, res) => {
  const rawInviteCode = req.query?.inviteCode;
  let inviteCode = "";

  if (typeof rawInviteCode === "string") {
    inviteCode = rawInviteCode.trim().toUpperCase();
  } else if (Array.isArray(rawInviteCode) && rawInviteCode.length > 0) {
    inviteCode = String(rawInviteCode[0]).trim().toUpperCase();
  }

  if (!inviteCode) {
    return sendJsonError(
      res,
      400,
      "inviteCode query parameter is required.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  if (!INVITE_CODE_REGEX.test(inviteCode)) {
    return sendJsonError(
      res,
      400,
      "inviteCode must be 6-10 characters using A-Z, 0-9, or '-'.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  try {
    const space = await prisma.space.findUnique({
      where: { inviteCode },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).send({ space: serializeSpace(space) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load space by invite code");
    return sendJsonError(res, 500, "Failed to load space.", ERROR_CODES.INTERNAL);
  }
});

app.post("/spaces/join", async (req, res) => {
  const codeInput = req.body?.code;
  if (typeof codeInput !== "string") {
    return sendJsonError(res, 400, "Code is required.", ERROR_CODES.BAD_REQUEST);
  }

  const normalizedCode = codeInput.trim().toUpperCase();
  if (!isValidJoinCode(normalizedCode)) {
    return sendJsonError(
      res,
      400,
      "Code must be 6-8 characters using A-Z or 0-9.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  const clientIp = req.ip ?? req.headers["x-forwarded-for"] ?? "unknown";
  if (hasExceededJoinRateLimit(clientIp)) {
    return sendJsonError(
      res,
      429,
      "Too many attempts. Try again later.",
      ERROR_CODES.RATE_LIMITED,
    );
  }

  try {
    const space = await prisma.space.findUnique({
      where: { joinCode: normalizedCode },
      select: { id: true, name: true, mode: true, createdAt: true },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).send({
      id: space.id,
      name: space.name,
      mode: space.mode,
      createdAt: space.createdAt,
    });
  } catch (joinError) {
    req.log.error({ err: joinError }, "Failed to join space");
    return sendJsonError(res, 500, "Failed to join space.", ERROR_CODES.INTERNAL);
  }
});

app.get("/spaces/:id/code", async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  if (!isOwnerRequest(req)) {
    return sendJsonError(res, 403, "Forbidden.", ERROR_CODES.FORBIDDEN);
  }

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { joinCode: true },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    return res.status(200).send({ code: space.joinCode });
  } catch (loadError) {
    req.log.error({ err: loadError }, "Failed to fetch join code");
    return sendJsonError(res, 500, "Failed to fetch join code.", ERROR_CODES.INTERNAL);
  }
});

app.post("/spaces/:id/code/rotate", async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  if (!isOwnerRequest(req)) {
    return sendJsonError(res, 403, "Forbidden.", ERROR_CODES.FORBIDDEN);
  }

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { joinCode: true },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt += 1) {
      const candidate = await generateJoinCode();
      if (candidate === space.joinCode) {
        continue;
      }

      try {
        const updated = await prisma.space.update({
          where: { id: spaceId },
          data: { joinCode: candidate },
          select: { joinCode: true },
        });
        return res.status(200).send({ code: updated.joinCode });
      } catch (updateError) {
        if (isJoinCodeUniqueError(updateError)) {
          continue;
        }
        if (updateError?.code === "P2025") {
          return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
        }
        throw updateError;
      }
    }

    return sendJsonError(res, 500, "Failed to rotate join code.", ERROR_CODES.INTERNAL);
  } catch (rotationError) {
    if (rotationError?.code === "JOIN_CODE_GENERATION_FAILED") {
      req.log.error({ err: rotationError }, "Failed to allocate join code during rotation");
      return sendJsonError(res, 500, "Failed to rotate join code.", ERROR_CODES.INTERNAL);
    }
    req.log.error({ err: rotationError }, "Failed to rotate join code");
    return sendJsonError(res, 500, "Failed to rotate join code.", ERROR_CODES.INTERNAL);
  }
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

// Test Plan:
// Join (success)
// curl -X POST http://127.0.0.1:3000/spaces/join
// -H "Content-Type: application/json"
// -d '{"code":"ABC123"}'
// Join (not found)
// curl -X POST http://127.0.0.1:3000/spaces/join
// -H "Content-Type: application/json"
// -d '{"code":"NOPE42"}'
// Get code (owner)
// curl -H "x-owner: true" http://127.0.0.1:3000/spaces/1/code
// Rotate code (owner)
// curl -X POST -H "x-owner: true" http://127.0.0.1:3000/spaces/1/code/rotate
