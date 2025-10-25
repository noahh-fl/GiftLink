const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

function normalizePriceCandidate(candidate) {
  if (typeof candidate !== "string") {
    return null;
  }

  const cleaned = candidate
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/([-+]?[0-9]*[.,]?[0-9]+)/);
  if (!match) {
    return null;
  }

  const numeric = match[1].replace(/,/g, "");
  const parsed = Number.parseFloat(numeric);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function extractMetaContent(html, names) {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["'](${names.join("|")})["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match ? match[2].trim() : null;
}

function extractTitle(html) {
  const title = extractMetaContent(html, ["og:title", "twitter:title", "title"]);
  if (title) {
    return title;
  }
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractImage(html) {
  return (
    extractMetaContent(html, ["og:image", "twitter:image", "og:image:url"]) ||
    extractMetaContent(html, ["image", "og:image:secure_url"]) ||
    null
  );
}

function extractPrice(html) {
  const priceMeta =
    extractMetaContent(html, ["product:price:amount", "og:price:amount", "price", "twitter:data1"]) ||
    null;

  if (priceMeta) {
    const cents = normalizePriceCandidate(priceMeta);
    if (cents !== null) {
      return cents;
    }
  }

  const match = html.match(/\b(?:USD|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (match) {
    const cents = normalizePriceCandidate(match[1]);
    if (cents !== null) {
      return cents;
    }
  }

  return null;
}

function shouldAttemptFetch(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

async function readLimitedBody(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  let received = 0;
  const chunks = [];

  while (received < maxBytes) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      const chunk = value.length + received > maxBytes ? value.slice(0, maxBytes - received) : value;
      chunks.push(chunk);
      received += chunk.length;
      if (received >= maxBytes) {
        break;
      }
    }
  }

  return Buffer.concat(chunks).toString("utf-8");
}

export async function fetchUrlMetadata(url, { timeoutMs = 3500, maxBytes = 150_000 } = {}) {
  if (!shouldAttemptFetch(url)) {
    return { title: null, image: null, priceCents: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "GiftLinkBot/1.0 (+https://giftlink.example)",
        Accept: HTML_CONTENT_TYPES.join(","),
      },
    });

    if (!response.ok) {
      return { title: null, image: null, priceCents: null };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!HTML_CONTENT_TYPES.some((type) => contentType.includes(type))) {
      return { title: null, image: null, priceCents: null };
    }

    const snippet = await readLimitedBody(response, maxBytes);

    return {
      title: extractTitle(snippet),
      image: extractImage(snippet),
      priceCents: extractPrice(snippet),
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { title: null, image: null, priceCents: null };
    }
    return { title: null, image: null, priceCents: null };
  } finally {
    clearTimeout(timeout);
  }
}

export function mergeMetadataWithManualFields(metadata, manual = {}) {
  return {
    title: manual.title ?? metadata.title ?? null,
    image: manual.image ?? metadata.image ?? null,
    priceCents: manual.priceCents ?? metadata.priceCents ?? null,
  };
}
