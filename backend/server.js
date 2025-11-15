import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomBytes } from "node:crypto";
import prisma from "./prisma/prisma.js";
import { fetchUrlMetadata, mergeMetadataWithManualFields } from "./lib/urlMetadata.js";
import { resolvePointsForGift, roundPriceToPoints } from "./lib/giftPoints.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { requireAuth, requireSpaceMembership, requireSpaceOwnership } from "./middleware/auth.js";
import { isSpaceMember, addSpaceMember } from "./lib/spaceHelpers.js";

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

// Register authentication routes
registerAuthRoutes(app);

// create user (DEPRECATED - use /auth/register instead)
app.post("/user", async (req, res) => {
  const { name, email } = req.body;
  const user = await prisma.user.create({
    data: { name, email },
  });
  return user;
});

app.post("/metadata/peekalink", { preHandler: requireAuth }, async (req, res) => {
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

app.post("/gifts/parse", { preHandler: requireAuth }, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const urlResult = normalizeUrl(req.body.url, { allowNull: false, fieldName: "URL" });
  if (urlResult.error || !urlResult.value) {
    return sendJsonError(
      res,
      400,
      urlResult.error ?? "URL is required.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  if (!isAmazonProductUrl(urlResult.value)) {
    return sendJsonError(
      res,
      422,
      "Auto-fill currently supports Amazon product links.",
      ERROR_CODES.UNPROCESSABLE,
    );
  }

  try {
    const peekalinkPayload = await fetchAmazonPeekalink(urlResult.value);
    const amazonProduct = peekalinkPayload?.amazonProduct;
    const fallbackImage = pickPeekalinkImage(peekalinkPayload?.image);

    const rawTitle = selectAmazonTitle(amazonProduct, peekalinkPayload) ?? deriveAmazonTitleFromUrl(urlResult.value);
    const cleanTitle = rawTitle ? cleanAmazonTitle(rawTitle) : null;

    const { price, currency } = await resolveAmazonPrice(amazonProduct, peekalinkPayload, req.log);
    const rawImageUrl = pickAmazonImage(amazonProduct, fallbackImage);
    const imageUrl = normalizeUrl(rawImageUrl, {
      allowNull: true,
      fieldName: "Image URL",
      strict: false,
    }).value;
    const asin = selectAmazonAsin(urlResult.value, amazonProduct);
    const features = selectAmazonFeatures(amazonProduct);
    const rating = typeof amazonProduct?.rating === "number" ? amazonProduct.rating : null;
    const reviewCount =
      typeof amazonProduct?.reviewCount === "number" ? amazonProduct.reviewCount : null;

    if (!cleanTitle && price === null && !imageUrl) {
      return sendJsonError(
        res,
        422,
        "We couldn’t read that link. Try another or enter details manually.",
        ERROR_CODES.UNPROCESSABLE,
      );
    }

    const payload = {
      title: cleanTitle,
      rawTitle: rawTitle ?? null,
      price,
      currency: currency ?? null,
      imageUrl,
      asin: asin ?? null,
    };

    if (features.length > 0) {
      payload.features = features;
    }
    if (rating !== null) {
      payload.rating = rating;
    }
    if (reviewCount !== null) {
      payload.reviewCount = reviewCount;
    }

    return res.status(200).send(payload);
  } catch (error) {
    if (error instanceof PeekalinkUnavailableError) {
      req.log.error({ err: error, url: urlResult.value }, "Peekalink request failed");
      return sendJsonError(
        res,
        502,
        "Unable to fetch details for the provided link.",
        ERROR_CODES.INTERNAL,
      );
    }

    req.log.error({ err: error, url: urlResult.value }, "Failed to parse gift URL");
    return sendJsonError(
      res,
      502,
      "Unable to fetch details for the provided link.",
      ERROR_CODES.INTERNAL,
    );
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

const LEDGER_ENTRY_TYPES = {
  CREDIT: "CREDIT",
  DEBIT: "DEBIT",
};

const ACTIVITY_TYPES = {
  WISHLIST_ADD: "wishlist_add",
  REWARD_ADD: "reward_add",
  REWARD_EDIT: "reward_edit",
  REWARD_REDEEM: "reward_redeem",
};

const REDEMPTION_STATUS = {
  PENDING: "PENDING",
  REDEEMED: "REDEEMED",
};

const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  INTERNAL: "INTERNAL_SERVER_ERROR",
  UNPROCESSABLE: "UNPROCESSABLE_ENTITY",
};

class PeekalinkUnavailableError extends Error {}

async function fetchAmazonPeekalink(url) {
  const apiKey = process.env.PEEKALINK_API_KEY;

  if (!apiKey) {
    throw new PeekalinkUnavailableError("Peekalink API key is not configured.");
  }

  const response = await fetch("https://api.peekalink.io/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ link: url }),
  });

  if (!response.ok) {
    throw new PeekalinkUnavailableError(`Peekalink responded with status ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new PeekalinkUnavailableError("Peekalink returned an unexpected payload.");
  }

  return payload;
}

function selectAmazonTitle(amazonProduct, payload) {
  if (amazonProduct?.title && typeof amazonProduct.title === "string") {
    return amazonProduct.title;
  }

  if (payload?.title && typeof payload.title === "string") {
    return payload.title;
  }

  return null;
}

function cleanAmazonTitle(title) {
  if (typeof title !== "string") {
    return null;
  }

  // Remove amazon.com prefix
  let cleaned = title.replace(/^amazon\.com\s*:\s*/i, "");

  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Remove leading/trailing punctuation
  cleaned = cleaned.replace(/^[\s:;,.\-|]+/, "").replace(/[\s:;,.\-|]+$/, "");

  // Simplify long Amazon titles by removing common verbose patterns
  // Remove size/color variants in parentheses or after commas (e.g., "(Large, Blue)")
  cleaned = cleaned.replace(/[,\-]\s*\(.*?\)/g, "");

  // Remove specifications in parentheses at the end (e.g., "(Pack of 12)", "(2-Pack)")
  cleaned = cleaned.replace(/\s*\([^)]*(?:pack|count|size|oz|lb|piece|set)[^)]*\)\s*$/i, "");

  // Remove common promotional phrases
  cleaned = cleaned.replace(/\s*[-–]\s*(Amazon Exclusive|Best Seller|New Release|Limited Edition|Sale).*$/i, "");

  // Remove excessive details after a dash or pipe if the title is long
  if (cleaned.length > 60) {
    // Keep only the first part before dash/pipe if there's a clear product name
    const parts = cleaned.split(/\s+[-–|]\s+/);
    if (parts.length > 1 && parts[0].length > 20) {
      cleaned = parts[0];
    }
  }

  // Truncate very long titles and add ellipsis
  if (cleaned.length > 80) {
    // Try to truncate at a word boundary
    const truncated = cleaned.substring(0, 77);
    const lastSpace = truncated.lastIndexOf(' ');
    cleaned = (lastSpace > 50 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }

  // Final cleanup
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/[\s:;,.\-|]+$/, "");

  return cleaned || null;
}

async function resolveAmazonPrice(amazonProduct, payload, logger) {
  const result = { price: null, currency: null };

  const directPrice = normalizePriceNumber(amazonProduct?.price ?? payload?.price?.value);
  if (directPrice !== null) {
    result.price = directPrice;
    result.currency = selectCurrency(amazonProduct, payload);
    return result;
  }

  const rawTextUrl = typeof payload?.page?.rawTextUrl === "string" ? payload.page.rawTextUrl : null;
  if (!rawTextUrl) {
    result.currency = selectCurrency(amazonProduct, payload);
    return result;
  }

  try {
    const rawResponse = await fetch(rawTextUrl);
    if (!rawResponse.ok) {
      logger?.warn?.({ statusCode: rawResponse.status }, "Failed to fetch Peekalink raw text");
      result.currency = selectCurrency(amazonProduct, payload);
      return result;
    }

    const rawText = await rawResponse.text();
    const parsed = extractPriceFromText(rawText);
    if (parsed !== null) {
      result.price = parsed;
    }
    result.currency = selectCurrency(amazonProduct, payload);
    return result;
  } catch (error) {
    logger?.warn?.({ err: error }, "Unable to parse price from Peekalink raw text");
    result.currency = selectCurrency(amazonProduct, payload);
    return result;
  }
}

function normalizePriceNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 0) {
      return null;
    }
    return Number.parseFloat(value.toFixed(2));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return Number.parseFloat(parsed.toFixed(2));
  }

  return null;
}

function selectCurrency(amazonProduct, payload) {
  if (amazonProduct?.currency && typeof amazonProduct.currency === "string") {
    return amazonProduct.currency.toUpperCase();
  }
  if (payload?.price?.currency && typeof payload.price.currency === "string") {
    return payload.price.currency.toUpperCase();
  }
  return null;
}

function pickAmazonImage(amazonProduct, fallbackImage) {
  const media = Array.isArray(amazonProduct?.media) ? amazonProduct.media : [];
  for (const asset of media) {
    if (!asset || typeof asset !== "object") {
      continue;
    }
    const original = typeof asset?.original?.url === "string" ? asset.original.url.trim() : "";
    if (original) {
      return original;
    }
    const large = typeof asset?.large?.url === "string" ? asset.large.url.trim() : "";
    if (large) {
      return large;
    }
    const medium = typeof asset?.medium?.url === "string" ? asset.medium.url.trim() : "";
    if (medium) {
      return medium;
    }
    const thumbnail = typeof asset?.thumbnail?.url === "string" ? asset.thumbnail.url.trim() : "";
    if (thumbnail) {
      return thumbnail;
    }
  }

  return fallbackImage ?? null;
}

function pickPeekalinkImage(image) {
  if (!image) {
    return null;
  }

  if (typeof image?.large?.url === "string" && image.large.url.trim()) {
    return image.large.url.trim();
  }
  if (typeof image?.medium?.url === "string" && image.medium.url.trim()) {
    return image.medium.url.trim();
  }
  if (typeof image?.thumbnail?.url === "string" && image.thumbnail.url.trim()) {
    return image.thumbnail.url.trim();
  }
  if (typeof image?.url === "string" && image.url.trim()) {
    return image.url.trim();
  }
  return null;
}

function selectAmazonAsin(url, amazonProduct) {
  if (amazonProduct?.asin && typeof amazonProduct.asin === "string") {
    return amazonProduct.asin;
  }

  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    for (const segment of segments) {
      if (/^[A-Z0-9]{10}$/i.test(segment)) {
        return segment.toUpperCase();
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

function selectAmazonFeatures(amazonProduct) {
  if (!Array.isArray(amazonProduct?.features)) {
    return [];
  }

  return amazonProduct.features
    .filter((feature) => typeof feature === "string")
    .map((feature) => feature.trim())
    .filter((feature) => feature.length > 0);
}

function extractPriceFromText(text) {
  if (typeof text !== "string") {
    return null;
  }

  const match = text.match(/(?:USD|US\$|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!match) {
    return null;
  }

  const normalized = match[1].replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Number.parseFloat(parsed.toFixed(2));
}

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

// DEPRECATED: resolveUserKey removed - now using JWT authentication
// All routes now get userId from req.user.userId set by requireAuth middleware

function normalizeExternalUserKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 120);
}

app.post("/space", { preHandler: requireAuth }, async (req, res) => {
  // Get authenticated user ID from JWT token
  const userId = req.user.userId;

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
    // Set owner and add as member
    await prisma.space.update({ where: { id: space.id }, data: { ownerId: userId } });
    await addSpaceMember(userId, space.id, "OWNER");
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

app.post("/spaces", { preHandler: requireAuth }, async (req, res) => {
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
    // Set owner and add as member
    await prisma.space.update({ where: { id: space.id }, data: { ownerId: userId } });
    await addSpaceMember(userId, space.id, "OWNER");
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

app.get("/spaces/:id", { preHandler: [requireAuth, requireSpaceMembership] }, async (req, res) => {
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

app.get("/user/spaces", { preHandler: requireAuth }, async (req, res) => {
  const userId = req.user.userId;

  try {
    const memberships = await prisma.spaceMember.findMany({
      where: { userId },
      include: {
        space: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    const spaces = memberships.map(membership => serializeSpace(membership.space));
    return res.status(200).send({ spaces });
  } catch (error) {
    req.log.error({ err: error }, "Failed to load user spaces");
    return sendJsonError(res, 500, "Failed to load user spaces.", ERROR_CODES.INTERNAL);
  }
});

app.patch("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] }, async (req, res) => {
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

app.delete("/spaces/:id", { preHandler: [requireAuth, requireSpaceOwnership] }, async (req, res) => {
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

app.get("/spaces", { preHandler: requireAuth }, async (req, res) => {
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

app.post("/spaces/join", { preHandler: requireAuth }, async (req, res) => {
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

app.get("/spaces/:id/code", { preHandler: [requireAuth, requireSpaceOwnership] }, async (req, res) => {
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

app.post("/spaces/:id/code/rotate", { preHandler: [requireAuth, requireSpaceOwnership] }, async (req, res) => {
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

app.get("/spaces/:id/balance", async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  const userKey =(req);

  try {
    const points = await computeBalance(prisma, spaceId, userKey);
    return res.status(200).send({ userId: userKey, points });
  } catch (balanceError) {
    req.log.error({ err: balanceError }, "Failed to compute balance");
    return sendJsonError(res, 500, "Failed to compute balance.", ERROR_CODES.INTERNAL);
  }
});

app.get("/spaces/:id/ledger", { preHandler: [requireAuth, requireSpaceMembership] }, async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  const fallbackUser =(req);
  const rawUserParam = Array.isArray(req.query?.user) ? req.query?.user[0] : req.query?.user;
  const requestedUser = normalizeExternalUserKey(rawUserParam) ?? fallbackUser;
  const rawLimit = Array.isArray(req.query?.limit) ? req.query?.limit[0] : req.query?.limit;
  const parsedLimit = Number.parseInt(rawLimit ?? "", 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 100;

  try {
    const [entries, points] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where: { spaceId, userKey: requestedUser },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      computeBalance(prisma, spaceId, requestedUser),
    ]);

    return res.status(200).send({
      userId: requestedUser,
      points,
      entries: entries.map(serializeLedgerEntry),
    });
  } catch (ledgerError) {
    req.log.error({ err: ledgerError }, "Failed to load ledger");
    return sendJsonError(res, 500, "Failed to load ledger.", ERROR_CODES.INTERNAL);
  }
});

app.get("/spaces/:id/activity", { preHandler: [requireAuth, requireSpaceMembership] }, async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  const rawLimit = Array.isArray(req.query?.limit) ? req.query?.limit[0] : req.query?.limit;
  const parsedLimit = Number.parseInt(rawLimit ?? "", 10);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;

  try {
    const activity = await prisma.activity.findMany({
      where: { spaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.status(200).send({ activity: activity.map(serializeActivity) });
  } catch (activityError) {
    req.log.error({ err: activityError }, "Failed to load activity");
    return sendJsonError(res, 500, "Failed to load activity.", ERROR_CODES.INTERNAL);
  }
});

app.post("/spaces/:id/rewards", { preHandler: [requireAuth, requireSpaceMembership] }, async (req, res) => {
  const { value: spaceId, error } = parseSpaceId(req.params.id);
  if (error) {
    return sendJsonError(res, 400, error, ERROR_CODES.BAD_REQUEST);
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const ownerKey =(req);
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
  const icon = sanitizeIconName(req.body.icon);

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
        icon,
      },
    });

    await logActivity(prisma, {
      spaceId,
      actorKey: ownerKey,
      type: ACTIVITY_TYPES.REWARD_ADD,
      payload: {
        rewardId: created.id,
        title: created.title,
        points: created.points,
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

  const ownerKey =(req);
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
  const icon = sanitizeIconName(req.body.icon);

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
        icon,
      },
    });

    await logActivity(prisma, {
      spaceId,
      actorKey: ownerKey,
      type: ACTIVITY_TYPES.REWARD_EDIT,
      payload: {
        rewardId: updated.id,
        title: updated.title,
        points: updated.points,
      },
    });

    return res.status(200).send({ reward: serializeReward(updated) });
  } catch (updateError) {
    req.log.error({ err: updateError }, "Failed to update reward");
    return sendJsonError(res, 500, "Failed to update reward.", ERROR_CODES.INTERNAL);
  }
});

app.post("/spaces/:id/rewards/:rewardId/redeem", async (req, res) => {
  const { value: spaceId, error: spaceError } = parseSpaceId(req.params.id);
  if (spaceError) {
    return sendJsonError(res, 400, spaceError, ERROR_CODES.BAD_REQUEST);
  }

  const { value: rewardId, error: rewardError } = parseSpaceId(req.params.rewardId);
  if (rewardError) {
    return sendJsonError(res, 400, rewardError, ERROR_CODES.BAD_REQUEST);
  }

  const redeemerKey =(req);

  try {
    const reward = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!reward || reward.spaceId !== spaceId) {
      return sendJsonError(res, 404, "Reward not found.", ERROR_CODES.NOT_FOUND);
    }

    if (reward.ownerKey === redeemerKey) {
      return sendJsonError(res, 403, "You cannot redeem your own reward.", ERROR_CODES.FORBIDDEN);
    }

    if (!Number.isFinite(reward.points) || reward.points <= 0) {
      return sendJsonError(res, 400, "Reward is missing a points value.", ERROR_CODES.BAD_REQUEST);
    }

    const balance = await computeBalance(prisma, spaceId, redeemerKey);
    if (balance < reward.points) {
      return sendJsonError(
        res,
        403,
        "Not enough points to redeem this reward.",
        ERROR_CODES.FORBIDDEN,
      );
    }

    const { redemption } = await prisma.$transaction(async (tx) => {
      const redemption = await tx.rewardRedemption.create({
        data: {
          spaceId,
          rewardId,
          redeemerKey,
          status: REDEMPTION_STATUS.PENDING,
        },
      });

      await createLedgerEntry(tx, {
        spaceId,
        userKey: redeemerKey,
        type: LEDGER_ENTRY_TYPES.DEBIT,
        points: reward.points,
        reason: "reward:redeem",
        meta: {
          redemptionId: redemption.id,
          rewardId: reward.id,
        },
      });

      return { redemption };
    });

    const points = await computeBalance(prisma, spaceId, redeemerKey);

    await logActivity(prisma, {
      spaceId,
      actorKey: redeemerKey,
      type: ACTIVITY_TYPES.REWARD_REDEEM,
      payload: {
        rewardId: reward.id,
        title: reward.title,
        points: reward.points,
      },
    });

    return res.status(201).send({
      balance: { userId: redeemerKey, points },
      purchase: serializeRedemption(redemption),
    });
  } catch (redeemError) {
    req.log.error({ err: redeemError }, "Failed to redeem reward");
    return sendJsonError(res, 500, "Failed to redeem reward.", ERROR_CODES.INTERNAL);
  }
});

app.delete("/spaces/:id/rewards/:rewardId", async (req, res) => {
  const { value: spaceId, error: spaceError } = parseSpaceId(req.params.id);
  if (spaceError) {
    return sendJsonError(res, 400, spaceError, ERROR_CODES.BAD_REQUEST);
  }

  const { value: rewardId, error: rewardError } = parseSpaceId(req.params.rewardId);
  if (rewardError) {
    return sendJsonError(res, 400, rewardError, ERROR_CODES.BAD_REQUEST);
  }

  const ownerKey =(req);

  try {
    const existing = await prisma.reward.findUnique({
      where: { id: rewardId },
    });

    if (!existing || existing.spaceId !== spaceId) {
      return sendJsonError(res, 404, "Reward not found.", ERROR_CODES.NOT_FOUND);
    }

    if (existing.ownerKey !== ownerKey) {
      return sendJsonError(res, 403, "Only the owner can delete this reward.", ERROR_CODES.FORBIDDEN);
    }

    await prisma.reward.delete({ where: { id: rewardId } });
    return res.status(204).send();
  } catch (deleteError) {
    req.log.error({ err: deleteError }, "Failed to delete reward");
    return sendJsonError(res, 500, "Failed to delete reward.", ERROR_CODES.INTERNAL);
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

function sanitizeIconName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const cleaned = trimmed.replace(/[^0-9A-Za-z-]/g, "");
  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, 60);
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

function normalizePriceDollarsToCents(value, { fieldName = "Price" } = {}) {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { error: `${fieldName} must be a finite number.` };
    }
    if (value < 0) {
      return { error: `${fieldName} cannot be negative.` };
    }
    return { value: Math.round(value * 100) };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { value: null };
    }

    const cleaned = trimmed.replace(/[^0-9.,-]/g, "");
    if (!cleaned) {
      return { value: null };
    }

    const normalized = cleaned.replace(/,/g, "");
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return { error: `${fieldName} must be a number.` };
    }
    if (parsed < 0) {
      return { error: `${fieldName} cannot be negative.` };
    }
    return { value: Math.round(parsed * 100) };
  }

  return { error: `${fieldName} must be a number.` };
}

function isAmazonProductUrl(url) {
  try {
    const parsed = new URL(url);
    return /amazon\./i.test(parsed.hostname);
  } catch (error) {
    return false;
  }
}

function deriveAmazonTitleFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const ignored = new Set(["dp", "gp", "product", "ref", "aw", "sspa"]);

    for (const segment of segments) {
      const normalized = segment.trim();
      if (!normalized) {
        continue;
      }

      if (ignored.has(normalized.toLowerCase())) {
        continue;
      }

      if (/^[A-Z0-9]{10}$/i.test(normalized)) {
        continue;
      }

      const words = normalized
        .replace(/[-_+]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!words) {
        continue;
      }

      return words
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }

    const keywords = parsed.searchParams.get("k") || parsed.searchParams.get("keywords");
    if (keywords) {
      return keywords
        .replace(/\+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  } catch (error) {
    return null;
  }

  return null;
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
  const spaceMode = item?.space?.mode ?? DEFAULT_SPACE_MODE;
  const { points } = resolvePointsForGift(spaceMode, item.gift, item);

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
    archivedAt: serializeDate(item.archivedAt),
    createdAt: serializeDate(item.createdAt),
    updatedAt: serializeDate(item.updatedAt),
    gift: mapGift(item.gift ?? null),
    points,
  };
}

function serializeReward(reward) {
  return {
    id: reward.id,
    spaceId: reward.spaceId,
    ownerKey: reward.ownerKey,
    userId: reward.ownerKey,
    title: reward.title,
    points: reward.points,
    description: reward.description,
    icon: reward.icon ?? null,
    createdAt: serializeDate(reward.createdAt),
    updatedAt: serializeDate(reward.updatedAt),
  };
}

function serializeLedgerEntry(entry) {
  return {
    id: entry.id,
    spaceId: entry.spaceId,
    userId: entry.userKey,
    type: entry.type,
    points: entry.points,
    reason: entry.reason,
    meta: entry.meta ?? null,
    createdAt: serializeDate(entry.createdAt),
  };
}

function serializeActivity(activity) {
  return {
    id: activity.id,
    spaceId: activity.spaceId,
    actor: activity.actorKey,
    type: activity.type,
    payload: activity.payload ?? null,
    createdAt: serializeDate(activity.createdAt),
  };
}

function serializeRedemption(redemption) {
  return {
    id: redemption.id,
    spaceId: redemption.spaceId,
    rewardId: redemption.rewardId,
    redeemer: redemption.redeemerKey,
    status: redemption.status,
    createdAt: serializeDate(redemption.createdAt),
    updatedAt: serializeDate(redemption.updatedAt),
  };
}

async function logActivity(client, { spaceId, actorKey, type, payload }) {
  if (!spaceId || !actorKey || !type) {
    return null;
  }

  const db = client ?? prisma;

  if (!db?.activity?.create) {
    return null;
  }

  try {
    const created = await db.activity.create({
      data: {
        spaceId,
        actorKey,
        type,
        payload: payload ?? null,
      },
    });
    return created;
  } catch (error) {
    console.warn("Unable to log activity", error);
    return null;
  }
}

async function createLedgerEntry(client, { spaceId, userKey, type, points, reason, meta }) {
  const numeric = typeof points === "number" ? points : Number.parseInt(points, 10);
  const sanitizedPoints = Math.max(0, Number.isFinite(numeric) ? Math.trunc(numeric) : 0);

  if (!spaceId || !userKey || !type || sanitizedPoints <= 0 || !reason) {
    return null;
  }

  const db = client ?? prisma;

  if (!db?.ledgerEntry?.create) {
    return null;
  }

  return db.ledgerEntry.create({
    data: {
      spaceId,
      userKey,
      type,
      points: sanitizedPoints,
      reason,
      meta: meta ?? null,
    },
  });
}

async function computeBalance(client, spaceId, userKey) {
  if (!spaceId || !userKey) {
    return 0;
  }

  const db = client ?? prisma;

  if (!db?.ledgerEntry?.aggregate) {
    return 0;
  }

  const [credits, debits] = await Promise.all([
    db.ledgerEntry.aggregate({
      _sum: { points: true },
      where: { spaceId, userKey, type: LEDGER_ENTRY_TYPES.CREDIT },
    }),
    db.ledgerEntry.aggregate({
      _sum: { points: true },
      where: { spaceId, userKey, type: LEDGER_ENTRY_TYPES.DEBIT },
    }),
  ]);

  const creditTotal = credits?._sum?.points ?? 0;
  const debitTotal = debits?._sum?.points ?? 0;

  return Math.max(0, creditTotal - debitTotal);
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

app.post("/wishlist", { preHandler: requireAuth }, async (req, res) => {
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

    const userId = req.user.userId;

    const created = await prisma.wishlistItem.create({
      data: {
        spaceId,
        creatorId: userId,
        title,
        url: urlResult.value,
        image: resolvedImage,
        priceCents: resolvedPrice,
        category,
        notes,
        priority: priorityResult.value,
        gift: {
          create: {
            pricePointsLocked:
              typeof resolvedPrice === "number" ? roundPriceToPoints(resolvedPrice) : null,
          },
        },
      },
      include: { gift: true, space: { select: { mode: true } } },
    });

    await logActivity(prisma, {
      spaceId,
      actorKey: userId,
      type: ACTIVITY_TYPES.WISHLIST_ADD,
      payload: {
        itemId: created.id,
        title: created.title,
      },
    });

    return res.status(201).send(mapWishlistItem(created));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create wishlist item");
    return sendJsonError(res, 500, "Failed to create wishlist item.", ERROR_CODES.INTERNAL);
  }
});

app.post("/spaces/:id/gifts", { preHandler: [requireAuth, requireSpaceMembership] }, async (req, res) => {
  const { value: spaceId, error: spaceError } = parseSpaceId(req.params.id);
  if (spaceError) {
    return sendJsonError(res, 400, spaceError, ERROR_CODES.BAD_REQUEST);
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const title = sanitizeNullableString(req.body.title);
  if (!title) {
    return sendJsonError(res, 400, "Title is required.", ERROR_CODES.BAD_REQUEST);
  }

  const urlResult = normalizeUrl(req.body.url, { allowNull: true, fieldName: "URL" });
  if (urlResult.error) {
    return sendJsonError(res, 400, urlResult.error, ERROR_CODES.BAD_REQUEST);
  }

  const imageResult = normalizeUrl(req.body.imageUrl, {
    allowNull: true,
    fieldName: "Image URL",
    strict: false,
  });
  if (imageResult.error) {
    return sendJsonError(res, 400, imageResult.error, ERROR_CODES.BAD_REQUEST);
  }

  const priceResult = normalizePriceDollarsToCents(req.body.price);
  if (priceResult.error) {
    return sendJsonError(res, 400, priceResult.error, ERROR_CODES.BAD_REQUEST);
  }

  const notes = sanitizeNullableString(req.body.notes);

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
      select: { id: true, mode: true },
    });

    if (!space) {
      return sendJsonError(res, 404, "Space not found.", ERROR_CODES.NOT_FOUND);
    }

    const normalizedMode = typeof space.mode === "string" ? space.mode.toLowerCase() : DEFAULT_SPACE_MODE;
    const isValueMode = normalizedMode === "value" || normalizedMode === "sentiment";

    const rawPoints = req.body.points;
    let resolvedPoints = null;

    if (isValueMode) {
      const parsed = typeof rawPoints === "number" ? rawPoints : Number.parseInt(rawPoints, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return sendJsonError(res, 400, "Points must be a positive integer.", ERROR_CODES.BAD_REQUEST);
      }
      resolvedPoints = Math.trunc(parsed);
    } else {
      if (priceResult.value === null) {
        return sendJsonError(
          res,
          400,
          "Price is required for price-based spaces.",
          ERROR_CODES.BAD_REQUEST,
        );
      }
      if (rawPoints !== undefined && rawPoints !== null) {
        const parsed = typeof rawPoints === "number" ? rawPoints : Number.parseInt(rawPoints, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return sendJsonError(res, 400, "Points must be zero or a positive integer.", ERROR_CODES.BAD_REQUEST);
        }
        resolvedPoints = Math.trunc(parsed);
      } else {
        resolvedPoints = roundPriceToPoints(priceResult.value);
      }
    }

    const userId = req.user.userId;

    const created = await prisma.wishlistItem.create({
      data: {
        spaceId,
        creatorId: userId,
        title,
        url: urlResult.value,
        image: imageResult.value,
        priceCents: priceResult.value,
        notes,
        gift: {
          create: {
            sentimentPoints: isValueMode ? resolvedPoints : null,
            pricePointsLocked: !isValueMode ? resolvedPoints : null,
          },
        },
      },
      include: { gift: true, space: { select: { mode: true } } },
    });

    await logActivity(prisma, {
      spaceId,
      actorKey: userId,
      type: ACTIVITY_TYPES.WISHLIST_ADD,
      payload: {
        itemId: created.id,
        title: created.title,
      },
    });

    return res.status(201).send({ wishlistItem: mapWishlistItem(created) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to create wishlist item from space route");
    return sendJsonError(res, 500, "Failed to create wishlist item.", ERROR_CODES.INTERNAL);
  }
});

app.get("/wishlist", { preHandler: requireAuth }, async (req, res) => {
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
      include: { gift: true, space: { select: { mode: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).send(items.map(mapWishlistItem));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load wishlist items");
    return sendJsonError(res, 500, "Failed to load wishlist items.", ERROR_CODES.INTERNAL);
  }
});

app.delete("/wishlist/:id", { preHandler: requireAuth }, async (req, res) => {
  const itemId = parseIdParam(req.params.id, "Wishlist id", res);
  if (!itemId) {
    return;
  }

  try {
    const existing = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });

    if (!existing) {
      return sendJsonError(res, 404, "Wishlist item not found.", ERROR_CODES.NOT_FOUND);
    }

    await prisma.wishlistItem.delete({ where: { id: itemId } });
    return res.status(204).send();
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete wishlist item");
    return sendJsonError(res, 500, "Failed to delete wishlist item.", ERROR_CODES.INTERNAL);
  }
});

app.patch("/wishlist/:id", { preHandler: requireAuth }, async (req, res) => {
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
    updates.archivedAt = archivedResult.value ? new Date() : null;
  }

  if (Object.keys(updates).length === 0) {
    return sendJsonError(res, 400, "At least one updatable field is required.", ERROR_CODES.BAD_REQUEST);
  }

  try {
    const updated = await prisma.wishlistItem.update({
      where: { id: itemId },
      data: updates,
      include: { gift: true, space: { select: { mode: true } } },
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

app.post("/wishlist/bulk-archive", { preHandler: requireAuth }, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const rawIds = Array.isArray(req.body.ids) ? req.body.ids : null;
  if (!rawIds || rawIds.length === 0) {
    return sendJsonError(
      res,
      400,
      "ids must be a non-empty array of up to 200 positive integers.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  const parsedIds = [];
  for (const value of rawIds) {
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value <= 0) {
        return sendJsonError(
          res,
          400,
          "ids must contain only positive integers.",
          ERROR_CODES.BAD_REQUEST,
        );
      }
      parsedIds.push(value);
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!/^[0-9]+$/.test(trimmed)) {
        return sendJsonError(
          res,
          400,
          "ids must contain only positive integers.",
          ERROR_CODES.BAD_REQUEST,
        );
      }
      const numeric = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return sendJsonError(
          res,
          400,
          "ids must contain only positive integers.",
          ERROR_CODES.BAD_REQUEST,
        );
      }
      parsedIds.push(numeric);
      continue;
    }

    return sendJsonError(
      res,
      400,
      "ids must contain only positive integers.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  const uniqueIds = Array.from(new Set(parsedIds));
  if (uniqueIds.length === 0 || uniqueIds.length > 200) {
    return sendJsonError(
      res,
      400,
      "ids must be a non-empty array of up to 200 positive integers.",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  try {
    const existing = await prisma.wishlistItem.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    const existingIds = new Set(existing.map((item) => item.id));
    const notFound = uniqueIds.filter((id) => !existingIds.has(id));

    const result = await prisma.wishlistItem.updateMany({
      where: { id: { in: uniqueIds }, archived: false },
      data: { archived: true, archivedAt: new Date() },
    });

    return res.status(200).send({
      updatedCount: result.count,
      ids: uniqueIds,
      notFound,
    });
  } catch (error) {
    req.log?.error?.({ err: error, ids: uniqueIds }, "Failed to bulk archive wishlist items");
    return sendJsonError(res, 500, "Failed to archive wishlist items.", ERROR_CODES.INTERNAL);
  }
});

app.post("/gift/:id/reserve", { preHandler: requireAuth }, async (req, res) => {
  const giftId = parseIdParam(req.params.id, "Gift id", res);
  if (!giftId) {
    return;
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return sendJsonError(res, 400, "Body must be a JSON object.", ERROR_CODES.BAD_REQUEST);
  }

  const payload = req.body;

  const giverId = Number.parseInt(payload.giverId, 10);
  if (!Number.isFinite(giverId) || giverId <= 0) {
    return sendJsonError(res, 400, "giverId must be a positive integer.", ERROR_CODES.BAD_REQUEST);
  }

  const actorKey =(req);
  const creditTarget = normalizeExternalUserKey(payload?.giverKey) ?? actorKey;

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

app.post("/gift/:id/purchase", { preHandler: requireAuth }, async (req, res) => {
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

app.post("/gift/:id/deliver", { preHandler: requireAuth }, async (req, res) => {
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

app.post("/gift/:id/receive", { preHandler: requireAuth }, async (req, res) => {
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
    const actorKey =(req);
    const creditTarget = normalizeExternalUserKey(payload?.giverKey) ?? actorKey;
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

          await createLedgerEntry(tx, {
            spaceId: updatedGift.wishlistItem.space.id,
            userKey: creditTarget,
            type: LEDGER_ENTRY_TYPES.CREDIT,
            points: lifecyclePoints.points,
            reason: "gift:receive",
            meta: {
              giftId: updatedGift.id,
              wishlistItemId: updatedGift.wishlistItemId,
            },
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
