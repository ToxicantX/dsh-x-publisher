import { createHash, randomBytes } from "node:crypto";

export const DEFAULT_SCOPES = Object.freeze(["tweet.read", "tweet.write", "users.read", "offline.access"]);

export function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function createCodeVerifier(random = randomBytes) {
  const bytes = random(32);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 32) throw new TypeError("PKCE randomness must return 32 bytes");
  return base64UrlEncode(bytes);
}

export function createCodeChallenge(verifier) {
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) throw new TypeError("PKCE verifier must be 43 to 128 characters");
  return base64UrlEncode(createHash("sha256").update(verifier, "ascii").digest());
}

export function createPkcePair(random = randomBytes) {
  const verifier = createCodeVerifier(random);
  return Object.freeze({ verifier, challenge: createCodeChallenge(verifier) });
}

export function createState(random = randomBytes) {
  const bytes = random(24);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 24) throw new TypeError("OAuth state randomness must return 24 bytes");
  return base64UrlEncode(bytes);
}

export function buildLoopbackRedirectUri({ host, port, callbackPath }) {
  const address = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  if (typeof address !== "string" || address.length === 0 || !Number.isInteger(port) || port < 1 || port > 65535 || typeof callbackPath !== "string" || !callbackPath.startsWith("/")) {
    throw new TypeError("A valid Web Server host, port, and callback path are required");
  }
  return new URL(callbackPath, "http://" + address + ":" + port).toString();
}

export function buildAuthorizationUrl({ authorizeUrl, clientId, redirectUri, state, codeChallenge, scopes = DEFAULT_SCOPES }) {
  const url = new URL(authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  }).toString();
  return url.toString();
}

export function buildPostPayload({ text, replyToTweetId, quoteTweetId }) {
  if (typeof text !== "string" || text.trim().length === 0) throw new TypeError("post text must be a non-empty string");
  const payload = { text };
  if (replyToTweetId !== undefined) payload.reply = { in_reply_to_tweet_id: normalizeIdentifier(replyToTweetId, "replyToTweetId") };
  if (quoteTweetId !== undefined) payload.quote_tweet_id = normalizeIdentifier(quoteTweetId, "quoteTweetId");
  return payload;
}

function normalizeIdentifier(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(name + " must be a non-empty string");
  return value.trim();
}

export function formatApiError(status, body) {
  if (status === 401) return "X API authentication failed";
  if (status === 403) return "X API refused this operation";
  if (status === 429) return "X API rate limit exceeded";
  if (status >= 500) return "X API is temporarily unavailable";
  const detail = [body?.detail, body?.title, body?.errors?.[0]?.message].find((value) => typeof value === "string" && value.trim().length > 0);
  if (detail === undefined) return "X API request failed (HTTP " + status + ")";
function redactSensitiveDetail(detail) {
  let safe = detail;
  const lower = safe.toLowerCase();
  const bearerIndex = lower.indexOf("bearer ");
  if (bearerIndex >= 0) {
    const valueStart = bearerIndex + 7;
    const valueEnd = safe.indexOf(" ", valueStart);
    safe = safe.slice(0, valueStart) + "[redacted]" + (valueEnd >= 0 ? safe.slice(valueEnd) : "");
  }
  for (const marker of ["access_token=", "access-token=", "refresh_token=", "refresh-token="]) {
    const index = safe.toLowerCase().indexOf(marker);
    if (index < 0) continue;
    const valueStart = index + marker.length;
    const valueEnd = safe.indexOf(" ", valueStart);
    safe = safe.slice(0, valueStart) + "[redacted]" + (valueEnd >= 0 ? safe.slice(valueEnd) : "");
  }
  return safe.slice(0, 240);
}

  const safe = redactSensitiveDetail(detail);
  return "X API request failed (HTTP " + status + "): " + safe;
}

export function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ABORT_ERR";
}
