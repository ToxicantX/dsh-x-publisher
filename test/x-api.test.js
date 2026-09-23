import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthorizationUrl, normalizeClientId, stripTrailingSlashes, buildPostPayload, createCodeChallenge, createCodeVerifier, formatApiError } from "../lib/x-api.js";

test("PKCE challenge is deterministic", () => {
  assert.equal(createCodeChallenge("a".repeat(43)), "ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA");
});

test("PKCE verifier uses injected 32-byte randomness", () => {
  const verifier = createCodeVerifier(() => Buffer.alloc(32, 255));
  assert.equal(verifier.length, 43);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/u);
});

test("authorization URL encodes OAuth parameters", () => {
  const result = buildAuthorizationUrl({ authorizeUrl: "https://x.com/i/oauth2/authorize", clientId: "client id", redirectUri: "http://127.0.0.1:3080/x-publisher/oauth/callback", state: "state with spaces", codeChallenge: "challenge", scopes: ["tweet.write", "users.read"] });
  const url = new URL(result);
  assert.equal(url.searchParams.get("client_id"), "client id");
  assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:3080/x-publisher/oauth/callback");
  assert.equal(url.searchParams.get("state"), "state with spaces");
  assert.equal(url.searchParams.get("scope"), "tweet.write users.read");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("post payload builds reply and quote fields", () => {
  assert.deepEqual(buildPostPayload({ text: "  hello X  ", replyToTweetId: " 123 ", quoteTweetId: "456" }), { text: "  hello X  ", reply: { in_reply_to_tweet_id: "123" }, quote_tweet_id: "456" });
});

test("post payload rejects blank text", () => {
  assert.throws(() => buildPostPayload({ text: "   " }), /non-empty/iu);
});

test("API error formatting redacts bearer values", () => {
  const message = formatApiError(400, { detail: "Bearer secret-value access_token=another-secret" });
  assert.match(message, /X API request failed/iu);
  assert.doesNotMatch(message, /secret-value|another-secret/iu);
  assert.match(message, /redacted/iu);
});

test("client ID normalization rejects blank and whitespace values", () => {
  assert.equal(normalizeClientId("  public-client-id  "), "public-client-id");
  assert.throws(() => normalizeClientId("  "), /non-empty/iu);
  assert.throws(() => normalizeClientId("public client id"), /whitespace/iu);
});

test("trailing API base URL slashes are normalized", () => {
  assert.equal(stripTrailingSlashes("https://api.x.com///"), "https://api.x.com");
  assert.equal(stripTrailingSlashes("https://api.x.com"), "https://api.x.com");
});

test("rate limit errors are stable", () => {
  assert.equal(formatApiError(429, { detail: "private server text" }), "X API rate limit exceeded");
});
