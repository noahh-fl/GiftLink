import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes } from "node:crypto";
import prisma from "./prisma/prisma.js";
import { fetchUrlMetadata, mergeMetadataWithManualFields } from "./lib/urlMetadata.js";
import { resolvePointsForGift, roundPriceToPoints } from "./lib/giftPoints.js";

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

app.post("/metadata/peekalink", async (req, res) => {
  const { link } = req.body ?? {};

  const preparedLink = typeof link === "string" ? link.trim() : "";

  if (!preparedLink) {
    return res.status(400).send({ title: null, image: null, price: null });
  }

  const apiKey = process.env.PEEKALINK_API_KEY;

  if (!apiKey) {
    req.log.error("PEEKALINK_API_KEY is not configured.");
    return res.status(500).send({ title: null, image: null, price: null });
  }

  try {
    const response = await fetch("https://api.peekalink.io/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ link: preparedLink }),
    });

    if (!response.ok) {
      req.log.error({ statusCode: response.status }, "Peekalink request failed.");
      return res.status(502).send({ title: null, image: null, price: null });
    }

    const payload = await response.json();

    const metadata = {
      title: typeof payload?.title === "string" ? payload.title : null,
      image:
        typeof payload?.image?.url === "string" && payload.image.url.trim()
          ? payload.image.url
          : null,
      price:
        typeof payload?.price?.value === "number"
          ? payload.price.value
          : typeof payload?.price?.value === "string"
            ? payload.price.value
            : null,
    };

    req.log.info({ link: preparedLink, metadata }, "Peekalink metadata retrieved");

    return metadata;
  } catch (error) {
    req.log.error({ err: error }, "Failed to fetch metadata from Peekalink");
    return res.status(502).send({ title: null, image: null, price: null });
  }
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
  INVALID_TRANSITION: "INVALID_TRANSITION",
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

function resolveUserKey(req) {
  const rawHeader =
    req.headers?.["x-user-id"] ?? req.headers?.["x-user"] ?? req.headers?.["x-user-key"] ?? null;

  if (typeof rawHeader === "string") {
    const trimmed = rawHeader.trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, 120);
    }
  }

  return "anonymous-tester";
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

app.get("/spaces/:id/rewards", async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  const ownerFilterRaw = req.query?.owner;
  const ownerFilter = typeof ownerFilterRaw === "string" ? ownerFilterRaw.trim() : "";

  const filters = { spaceId };
  if (ownerFilter) {
    filters.ownerKey = ownerFilter;
  }

  try {
    const rewards = await prisma.reward.findMany({
      where: filters,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).send({ rewards: rewards.map(serializeReward) });
  } catch (loadError) {
    req.log.error({ err: loadError }, "Failed to load rewards");
    return sendJsonError(res, 500, "Failed to load rewards.", ERROR_CODES.INTERNAL);
  }
});

app.post("/spaces/:id/rewards", async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const ownerKey = resolveUserKey(req);
  const title = sanitizeNullableString(req.body.title);
  if (!title) {
    return sendJsonError(res, 400, "Title is required.", ERROR_CODES.BAD_REQUEST);
  }

  const rawPoints = req.body.points;
  const pointsValue = typeof rawPoints === "number" ? rawPoints : Number.parseInt(rawPoints, 10);
  if (!Number.isFinite(pointsValue) || pointsValue <= 0) {
    return sendJsonError(res, 400, "Points must be a positive integer.", ERROR_CODES.BAD_REQUEST);
  }

  const description = sanitizeNullableString(req.body.description);

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    const created = await prisma.reward.create({
      data: {
        spaceId,
        ownerKey,
        title,
        points: Math.trunc(pointsValue),
        description,
      },
    });

    return res.status(201).send({ reward: serializeReward(created) });
  } catch (creationError) {
    req.log.error({ err: creationError }, "Failed to create reward");
    return sendJsonError(res, 500, "Failed to create reward.", ERROR_CODES.INTERNAL);
  }
});

app.put("/spaces/:id/rewards/:rewardId", async (req, res) => {
  const { value: spaceId, error: spaceError } = parseSpaceId(req.params.id);
  if (spaceError) {
    return sendJsonError(res, 400, spaceError, ERROR_CODES.BAD_REQUEST);
  }

  const { value: rewardId, error: rewardError } = parseSpaceId(req.params.rewardId);
  if (rewardError) {
    return sendJsonError(res, 400, rewardError, ERROR_CODES.BAD_REQUEST);
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const ownerKey = resolveUserKey(req);
  const title = sanitizeNullableString(req.body.title);
  if (!title) {
    return sendJsonError(res, 400, "Title is required.", ERROR_CODES.BAD_REQUEST);
  }

  const rawPoints = req.body.points;
  const pointsValue = typeof rawPoints === "number" ? rawPoints : Number.parseInt(rawPoints, 10);
  if (!Number.isFinite(pointsValue) || pointsValue <= 0) {
    return sendJsonError(res, 400, "Points must be a positive integer.", ERROR_CODES.BAD_REQUEST);
  }

  const description = sanitizeNullableString(req.body.description);

  try {
    const existing = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!existing || existing.spaceId !== spaceId) {
      return sendJsonError(res, 404, "Reward not found.", ERROR_CODES.NOT_FOUND);
    }

    if (existing.ownerKey !== ownerKey) {
      return sendJsonError(res, 403, "Only the owner can update this reward.", ERROR_CODES.FORBIDDEN);
    }

    const updated = await prisma.reward.update({
      where: { id: rewardId },
      data: {
        title,
        points: Math.trunc(pointsValue),
        description,
      },
    });

    return res.status(200).send({ reward: serializeReward(updated) });
  } catch (updateError) {
    req.log.error({ err: updateError }, "Failed to update reward");
    return sendJsonError(res, 500, "Failed to update reward.", ERROR_CODES.INTERNAL);
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

const PRIORITY_VALUES = new Set(["LOW", "MEDIUM", "HIGH"]);

const GIFT_STATUS = {
  PENDING: "PENDING",
  RESERVED: "RESERVED",
  PURCHASED: "PURCHASED",
  DELIVERED: "DELIVERED",
  RECEIVED: "RECEIVED",
};

function sanitizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePriority(value, { defaultValue = "MEDIUM", allowNull = false } = {}) {
  if (value === undefined || value === null) {
    return { value: allowNull ? null : defaultValue };
  }
  if (typeof value !== "string") {
    return {
      error: `Priority must be one of: ${Array.from(PRIORITY_VALUES).join(", ")}.`,
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: allowNull ? null : defaultValue };
  }

  const normalized = trimmed.toUpperCase();
  if (!PRIORITY_VALUES.has(normalized)) {
    return {
      error: `Priority must be one of: ${Array.from(PRIORITY_VALUES).join(", ")}.`,
    };
  }

  return { value: normalized };
}

function normalizeUrl(value, { allowNull = true, fieldName = "URL", strict = true } = {}) {
  if (value === undefined || value === null) {
    return { value: allowNull ? null : null };
  }

  if (typeof value !== "string") {
    return strict
      ? { error: `${fieldName} must be a string.` }
      : { value: allowNull ? null : null };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { value: allowNull ? null : null };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return strict
        ? { error: `${fieldName} must use http or https.` }
        : { value: allowNull ? null : null };
    }
    return { value: parsed.toString() };
  } catch (error) {
    return strict
      ? { error: `${fieldName} must be a valid URL.` }
      : { value: allowNull ? null : null };
  }
}

function normalizePriceCents(value) {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { error: "priceCents must be a finite number." };
    }
    if (!Number.isInteger(value)) {
      return { error: "priceCents must be an integer number of cents." };
    }
    if (value < 0) {
      return { error: "priceCents cannot be negative." };
    }
    return { value };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { value: null };
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return { error: "priceCents must be an integer number of cents." };
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (parsed < 0) {
      return { error: "priceCents cannot be negative." };
    }
    return { value: parsed };
  }

  return { error: "priceCents must be an integer number of cents." };
}

function parseBooleanInput(value) {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value === "boolean") {
    return { value };
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return { value: null };
    }
    if (normalized === "true" || normalized === "1") {
      return { value: true };
    }
    if (normalized === "false" || normalized === "0") {
      return { value: false };
    }
  }

  return { error: "Value must be a boolean." };
}

function serializeDate(value) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapGift(gift) {
  if (!gift) {
    return null;
  }

  return {
    id: gift.id,
    wishlistItemId: gift.wishlistItemId,
    giverId: gift.giverId,
    status: gift.status,
    sentimentPoints: gift.sentimentPoints,
    pricePointsLocked: gift.pricePointsLocked,
    reservedAt: serializeDate(gift.reservedAt),
    purchasedAt: serializeDate(gift.purchasedAt),
    deliveredAt: serializeDate(gift.deliveredAt),
    receivedAt: serializeDate(gift.receivedAt),
    createdAt: serializeDate(gift.createdAt),
    updatedAt: serializeDate(gift.updatedAt),
  };
}

function mapWishlistItem(item) {
  return {
    id: item.id,
    spaceId: item.spaceId,
    title: item.title,
    url: item.url,
    image: item.image,
    priceCents: item.priceCents,
    category: item.category,
    notes: item.notes,
    priority: item.priority,
    archived: item.archived,
    createdAt: serializeDate(item.createdAt),
    updatedAt: serializeDate(item.updatedAt),
    gift: mapGift(item.gift ?? null),
  };
}

function serializeReward(reward) {
  return {
    id: reward.id,
    spaceId: reward.spaceId,
    ownerKey: reward.ownerKey,
    title: reward.title,
    points: reward.points,
    description: reward.description,
    createdAt: serializeDate(reward.createdAt),
    updatedAt: serializeDate(reward.updatedAt),
  };
}

function parseSentimentPoints(value) {
  if (value === undefined || value === null) {
    return { value: null };
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return { error: "sentimentPoints must be a number." };
  }
  const rounded = Math.trunc(value);
  if (rounded < 0) {
    return { error: "sentimentPoints cannot be negative." };
  }
  return { value: rounded };
}

async function loadGiftWithContext(giftId) {
  return prisma.gift.findUnique({
    where: { id: giftId },
    include: {
      wishlistItem: {
        include: {
          space: true,
        },
      },
    },
  });
}

function buildLifecycleResponse(gift) {
  return {
    giftId: gift.id,
    status: gift.status,
    updatedAt: serializeDate(gift.updatedAt),
  };
}

app.post("/wishlist", async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const rawSpaceId = req.body.spaceId;
  const spaceId = Number.parseInt(rawSpaceId, 10);
  if (!Number.isFinite(spaceId) || spaceId <= 0) {
    return sendJsonError(res, 400, "spaceId must be a positive integer.", ERROR_CODES.BAD_REQUEST);
  }

  const urlResult = normalizeUrl(req.body.url, { allowNull: true, fieldName: "URL" });
  if (urlResult.error) {
    return sendJsonError(res, 400, urlResult.error, ERROR_CODES.BAD_REQUEST);
  }

  const manualTitle = sanitizeNullableString(req.body.title);
  const imageResult = normalizeUrl(req.body.image, {
    allowNull: true,
    fieldName: "Image URL",
  });
  if (imageResult.error) {
    return sendJsonError(res, 400, imageResult.error, ERROR_CODES.BAD_REQUEST);
  }

  const priceResult = normalizePriceCents(req.body.priceCents);
  if (priceResult.error) {
    return sendJsonError(res, 400, priceResult.error, ERROR_CODES.BAD_REQUEST);
  }

  const priorityResult = normalizePriority(req.body.priority);
  if (priorityResult.error) {
    return sendJsonError(res, 400, priorityResult.error, ERROR_CODES.BAD_REQUEST);
  }

  const category = sanitizeNullableString(req.body.category);
  const notes = sanitizeNullableString(req.body.notes);

  let metadata = { title: null, image: null, priceCents: null };
  if (urlResult.value) {
    metadata = await fetchUrlMetadata(urlResult.value);
  }

  const merged = mergeMetadataWithManualFields(metadata, {
    title: manualTitle,
    image: imageResult.value,
    priceCents: priceResult.value,
  });

  const title = sanitizeNullableString(merged.title);
  if (!title) {
    return sendJsonError(res, 400, "Title is required.", ERROR_CODES.BAD_REQUEST);
  }

  const resolvedImage =
    merged.image === imageResult.value
      ? imageResult.value
      : normalizeUrl(merged.image, { allowNull: true, fieldName: "Image URL", strict: false }).value;
  const resolvedPrice = typeof merged.priceCents === "number" ? merged.priceCents : null;

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    const created = await prisma.wishlistItem.create({
      data: {
        spaceId,
        title,
        url: urlResult.value,
        image: resolvedImage,
        priceCents: resolvedPrice,
        category,
        notes,
        priority: priorityResult.value,
        gift: {
          create: {},
        },
      },
      include: { gift: true },
    });

    return res.status(201).send(mapWishlistItem(created));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create wishlist item");
    return sendJsonError(res, 500, "Failed to create wishlist item.", ERROR_CODES.INTERNAL);
  }
});

app.get("/wishlist", async (req, res) => {
  const query = req.query ?? {};
  const rawSpaceId = query.spaceId;
  const spaceId = Number.parseInt(rawSpaceId, 10);
  if (!Number.isFinite(spaceId) || spaceId <= 0) {
    return sendJsonError(res, 400, "spaceId is required and must be a positive integer.", ERROR_CODES.BAD_REQUEST);
  }

  const filters = { spaceId };

  const archivedResult = parseBooleanInput(query.archived);
  if (archivedResult.error) {
    return sendJsonError(res, 400, "archived must be a boolean.", ERROR_CODES.BAD_REQUEST);
  }
  filters.archived = archivedResult.value ?? false;

  const priorityResult = normalizePriority(query.priority, { allowNull: true });
  if (priorityResult.error) {
    return sendJsonError(res, 400, priorityResult.error, ERROR_CODES.BAD_REQUEST);
  }
  if (priorityResult.value) {
    filters.priority = priorityResult.value;
  }

  const category = sanitizeNullableString(query.category);
  if (category) {
    filters.category = category;
  }

  const minResult = normalizePriceCents(query.priceMin);
  if (minResult.error) {
    return sendJsonError(res, 400, "priceMin must be an integer number of cents.", ERROR_CODES.BAD_REQUEST);
  }
  const maxResult = normalizePriceCents(query.priceMax);
  if (maxResult.error) {
    return sendJsonError(res, 400, "priceMax must be an integer number of cents.", ERROR_CODES.BAD_REQUEST);
  }

  if (minResult.value !== null && maxResult.value !== null && minResult.value > maxResult.value) {
    return sendJsonError(res, 400, "priceMin cannot be greater than priceMax.", ERROR_CODES.BAD_REQUEST);
  }

  const priceFilter = {};
  if (minResult.value !== null) {
    priceFilter.gte = minResult.value;
  }
  if (maxResult.value !== null) {
    priceFilter.lte = maxResult.value;
  }
  if (Object.keys(priceFilter).length > 0) {
    filters.priceCents = priceFilter;
  }

  try {
    const items = await prisma.wishlistItem.findMany({
      where: filters,
      include: { gift: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).send(items.map(mapWishlistItem));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load wishlist items");
    return sendJsonError(res, 500, "Failed to load wishlist items.", ERROR_CODES.INTERNAL);
  }
});

app.patch("/wishlist/:id", async (req, res) => {
  const itemId = parseIdParam(req.params.id, "Wishlist id", res);
  if (!itemId) {
    return;
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const updates = {};

  if (Object.prototype.hasOwnProperty.call(req.body, "notes")) {
    updates.notes = sanitizeNullableString(req.body.notes);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "priority")) {
    const priorityResult = normalizePriority(req.body.priority);
    if (priorityResult.error) {
      return sendJsonError(res, 400, priorityResult.error, ERROR_CODES.BAD_REQUEST);
    }
    updates.priority = priorityResult.value;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "archived")) {
    const archivedResult = parseBooleanInput(req.body.archived);
    if (archivedResult.error || archivedResult.value === null) {
      return sendJsonError(res, 400, "archived must be a boolean.", ERROR_CODES.BAD_REQUEST);
    }
    updates.archived = archivedResult.value;
  }

  if (Object.keys(updates).length === 0) {
    return sendJsonError(res, 400, "At least one updatable field is required.", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const updated = await prisma.wishlistItem.update({
      where: { id: itemId },
      data: updates,
      include: { gift: true },
    });
    return res.status(200).send(mapWishlistItem(updated));
  } catch (error) {
    if (error?.code === "P2025") {
      return sendJsonError(res, 404, "Wishlist item not found.", ERROR_CODES.NOT_FOUND);
    }
    req.log.error({ err: error }, "Failed to update wishlist item");
    return sendJsonError(res, 500, "Failed to update wishlist item.", ERROR_CODES.INTERNAL);
  }
});

app.post("/gift/:id/reserve", async (req, res) => {
  const giftId = parseIdParam(req.params.id, "Gift id", res);
  if (!giftId) {
    return;
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const giverId = Number.parseInt(req.body.giverId, 10);
  if (!Number.isFinite(giverId) || giverId <= 0) {
    return sendJsonError(res, 400, "giverId must be a positive integer.", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const gift = await loadGiftWithContext(giftId);
    if (!gift) {
      return sendJsonError(res, 404, "Gift not found.", ERROR_CODES.NOT_FOUND);
    }

    if (gift.wishlistItem?.archived) {
      return sendJsonError(res, 409, "Wishlist item is archived.", ERROR_CODES.CONFLICT);
    }

    if (gift.status !== GIFT_STATUS.PENDING) {
      return sendJsonError(res, 409, "Gift cannot be reserved in its current state.", ERROR_CODES.INVALID_TRANSITION);
    }

    const giver = await prisma.user.findUnique({
      where: { id: giverId },
      select: { id: true },
    });

    if (!giver) {
      return sendJsonError(res, 404, "Giver not found.", ERROR_CODES.NOT_FOUND);
    }

    const updated = await prisma.gift.update({
      where: { id: giftId },
      data: {
        status: GIFT_STATUS.RESERVED,
        giverId,
        reservedAt: new Date(),
      },
    });

    return res.status(200).send(buildLifecycleResponse(updated));
  } catch (error) {
    req.log.error({ err: error }, "Failed to reserve gift");
    return sendJsonError(res, 500, "Failed to reserve gift.", ERROR_CODES.INTERNAL);
  }
});

app.post("/gift/:id/purchase", async (req, res) => {
  const giftId = parseIdParam(req.params.id, "Gift id", res);
  if (!giftId) {
    return;
  }

  const payload = req.body ?? {};
  if (payload && typeof payload !== "object") {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const priceResult = normalizePriceCents(payload?.priceCents);
  if (priceResult.error) {
    return sendJsonError(res, 400, priceResult.error, ERROR_CODES.BAD_REQUEST);
  }

  try {
    const gift = await loadGiftWithContext(giftId);
    if (!gift) {
      return sendJsonError(res, 404, "Gift not found.", ERROR_CODES.NOT_FOUND);
    }

    if (gift.status !== GIFT_STATUS.RESERVED) {
      return sendJsonError(res, 409, "Gift cannot be marked as purchased.", ERROR_CODES.INVALID_TRANSITION);
    }

    let pricePointsLocked = gift.pricePointsLocked;
    if (priceResult.value !== null) {
      pricePointsLocked = roundPriceToPoints(priceResult.value);
    } else if (pricePointsLocked === null || pricePointsLocked === undefined) {
      const fallback = gift.wishlistItem?.priceCents;
      pricePointsLocked = typeof fallback === "number" ? roundPriceToPoints(fallback) : 0;
    }

    const updated = await prisma.gift.update({
      where: { id: giftId },
      data: {
        status: GIFT_STATUS.PURCHASED,
        purchasedAt: new Date(),
        pricePointsLocked: pricePointsLocked ?? 0,
      },
    });

    return res.status(200).send(buildLifecycleResponse(updated));
  } catch (error) {
    req.log.error({ err: error }, "Failed to mark gift as purchased");
    return sendJsonError(res, 500, "Failed to mark gift as purchased.", ERROR_CODES.INTERNAL);
  }
});

app.post("/gift/:id/deliver", async (req, res) => {
  const giftId = parseIdParam(req.params.id, "Gift id", res);
  if (!giftId) {
    return;
  }

  try {
    const gift = await loadGiftWithContext(giftId);
    if (!gift) {
      return sendJsonError(res, 404, "Gift not found.", ERROR_CODES.NOT_FOUND);
    }

    if (gift.status !== GIFT_STATUS.PURCHASED) {
      return sendJsonError(res, 409, "Gift cannot be marked as delivered.", ERROR_CODES.INVALID_TRANSITION);
    }

    const updated = await prisma.gift.update({
      where: { id: giftId },
      data: {
        status: GIFT_STATUS.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    return res.status(200).send(buildLifecycleResponse(updated));
  } catch (error) {
    req.log.error({ err: error }, "Failed to mark gift as delivered");
    return sendJsonError(res, 500, "Failed to mark gift as delivered.", ERROR_CODES.INTERNAL);
  }
});

app.post("/gift/:id/receive", async (req, res) => {
  const giftId = parseIdParam(req.params.id, "Gift id", res);
  if (!giftId) {
    return;
  }

  const payload = req.body ?? {};
  if (payload && typeof payload !== "object") {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const gift = await loadGiftWithContext(giftId);
    if (!gift) {
      return sendJsonError(res, 404, "Gift not found.", ERROR_CODES.NOT_FOUND);
    }

    if (gift.status !== GIFT_STATUS.DELIVERED) {
      return sendJsonError(res, 409, "Gift cannot be marked as received.", ERROR_CODES.INVALID_TRANSITION);
    }

    const spaceMode = gift.wishlistItem?.space?.mode ?? DEFAULT_SPACE_MODE;
    let sentimentPointsUpdate = undefined;

    if (spaceMode === "sentiment") {
      const sentimentResult = parseSentimentPoints(payload?.sentimentPoints);
      if (sentimentResult.error || sentimentResult.value === null) {
        return sendJsonError(res, 400, "sentimentPoints are required for sentiment-valued spaces.", ERROR_CODES.BAD_REQUEST);
      }
      sentimentPointsUpdate = sentimentResult.value;
    }

    let pricePointsLocked = gift.pricePointsLocked;
    if (spaceMode !== "sentiment") {
      if (pricePointsLocked === null || pricePointsLocked === undefined) {
        const fallbackPrice = gift.wishlistItem?.priceCents;
        pricePointsLocked = typeof fallbackPrice === "number" ? roundPriceToPoints(fallbackPrice) : 0;
      }
    }

    const updateData = {
      status: GIFT_STATUS.RECEIVED,
      receivedAt: new Date(),
    };

    if (spaceMode === "sentiment") {
      updateData.sentimentPoints = sentimentPointsUpdate;
    } else {
      updateData.pricePointsLocked = pricePointsLocked ?? 0;
    }

    const { updatedGift, lifecyclePoints } = await prisma.$transaction(
      async (tx) => {
        const updatedGift = await tx.gift.update({
          where: { id: giftId },
          data: updateData,
          include: {
            wishlistItem: {
              include: {
                space: true,
              },
            },
          },
        });

        const lifecyclePoints = resolvePointsForGift(
          updatedGift.wishlistItem.space.mode,
          updatedGift,
          updatedGift.wishlistItem,
        );

        if (lifecyclePoints.points > 0) {
          await tx.space.update({
            where: { id: updatedGift.wishlistItem.space.id },
            data: { points: { increment: lifecyclePoints.points } },
          });
        }

        return { updatedGift, lifecyclePoints };
      },
    );

    return res.status(200).send({
      giftId: updatedGift.id,
      status: updatedGift.status,
      updatedAt: serializeDate(updatedGift.updatedAt),
      pointsAwarded: lifecyclePoints.points,
      mode: lifecyclePoints.mode,
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to mark gift as received");
    return sendJsonError(res, 500, "Failed to mark gift as received.", ERROR_CODES.INTERNAL);
  }
});

// list users
app.get("/users", async () => {
  const users = await prisma.user.findMany();
  return users;
});

app.get("/space/:id/gifts", async (req, res) => {
  const spaceId = parseIdParam(req.params.id, "Space id", res);
  if (!spaceId) {
    return;
  }

  try {
    const gifts = await prisma.gift.findMany({
      where: {
        wishlistItem: {
          spaceId,
        },
      },
      include: {
        wishlistItem: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).send(
      gifts.map((gift) => ({
        ...mapGift(gift),
        wishlistItem: {
          id: gift.wishlistItem.id,
          title: gift.wishlistItem.title,
          priority: gift.wishlistItem.priority,
          archived: gift.wishlistItem.archived,
        },
      })),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to list gifts");
    return sendJsonError(res, 500, "Failed to load gifts.", ERROR_CODES.INTERNAL);
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
if (process.env.NODE_ENV !== "test") {
  app.listen({ port: 3000 }, (err, address) => {
    if (err) throw err;
    console.log(`Server running at ${address}`);
  });
}

export { app };
export default app;

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
