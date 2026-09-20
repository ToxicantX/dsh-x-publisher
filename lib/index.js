import { credentialKey } from "@deepseek-ai/dsh-credentials";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { DEFAULT_SCOPES, buildAuthorizationUrl, buildLoopbackRedirectUri, buildPostPayload, createPkcePair, createState, formatApiError, isAbortError } from "./x-api.js";

export const name = "x-publisher";
export const inject = ["authorization", "credentials", "webServer", "tools"];

const CREDENTIAL_KEY = credentialKey(name, "default");
const DEFAULT_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const DEFAULT_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const DEFAULT_API_BASE_URL = "https://api.x.com";
const DEFAULT_CALLBACK_PATH = "/x-publisher/oauth/callback";
const DEFAULT_START_PATH = "/x-publisher/oauth/start";
const AUTHORIZATION_TIMEOUT_MS = 10 * 60 * 1000;

export class XPublisherError extends Error {
  constructor(message, code = "X_PUBLISHER_ERROR", status) {
    super(message);
    this.name = "XPublisherError";
    this.code = code;
    this.status = status;
  }
}

function normalizeConfig(raw = {}) {
  const value = raw && typeof raw === "object" ? raw : {};
  const scopes = Array.isArray(value.scopes) && value.scopes.length > 0 ? value.scopes.map(String).map((scope) => scope.trim()).filter(Boolean) : [...DEFAULT_SCOPES];
  const config = {
    clientId: typeof value.clientId === "string" ? value.clientId.trim() : "",
    redirectUri: typeof value.redirectUri === "string" ? value.redirectUri.trim() : "",
    callbackPath: String(value.callbackPath ?? DEFAULT_CALLBACK_PATH),
    startPath: String(value.startPath ?? DEFAULT_START_PATH),
    authorizeUrl: String(value.authorizeUrl ?? DEFAULT_AUTHORIZE_URL),
    tokenUrl: String(value.tokenUrl ?? DEFAULT_TOKEN_URL),
    apiBaseUrl: String(value.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\\/+$/u, ""),
    scopes,
    timeoutMs: Number.isSafeInteger(value.timeoutMs) && value.timeoutMs > 0 ? value.timeoutMs : 30000
  };
  validateConfig(config);
  return config;
}

function validateConfig(config) {
  for (const field of ["callbackPath", "startPath"]) {
    const path = config[field];
    if (!path.startsWith("/") || path === "/" || path.endsWith("/") || path.includes("?") || path.includes("#")) throw new XPublisherError(field + " must be an absolute path without query, fragment, or trailing slash", "INVALID_CONFIG");
  }
  for (const field of ["authorizeUrl", "tokenUrl", "apiBaseUrl"]) {
    let url;
    try { url = new URL(config[field]); } catch { throw new XPublisherError(field + " must be a valid URL", "INVALID_CONFIG"); }
    if (url.username || url.password || url.hash) throw new XPublisherError(field + " must not contain credentials or a fragment", "INVALID_CONFIG");
  }
  if (config.redirectUri !== "") {
    let url;
    try { url = new URL(config.redirectUri); } catch { throw new XPublisherError("redirectUri must be a valid URL", "INVALID_CONFIG"); }
    if (url.username || url.password || url.search || url.hash || url.pathname !== config.callbackPath) throw new XPublisherError("redirectUri must exactly match callbackPath and contain no query or fragment", "INVALID_CONFIG");
  }
}

function requireClientId(config) {
  if (!config.clientId) throw new XPublisherError("X clientId must be configured", "NOT_CONFIGURED");
}

function parseResponse(response, text) {
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new XPublisherError("X API returned an invalid JSON response", "INVALID_RESPONSE", response.status); }
}

async function requestJson(url, init, signal) {
  let response;
  try { response = await fetch(url, { ...init, signal }); } catch (error) {
    if (isAbortError(error)) throw new XPublisherError("X request was cancelled", "ABORTED");
    throw new XPublisherError("X request failed", "NETWORK_ERROR");
  }
  const bodyText = await response.text();
  const body = parseResponse(response, bodyText);
  if (!response.ok) throw new XPublisherError(formatApiError(response.status, body), "X_API_ERROR", response.status);
  return body;
}

function tokenExpiry(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 ? Date.now() + Math.floor(value * 1000) : undefined;
}

function toGrant(token, previous = {}, user) {
  if (!token || typeof token.access_token !== "string" || token.access_token.length === 0) throw new XPublisherError("X token response did not include an access token", "INVALID_RESPONSE");
  const expiresAt = tokenExpiry(token.expires_in) ?? previous.expiresAt;
  return {
    accessToken: token.access_token,
    ...(typeof token.refresh_token === "string" && token.refresh_token ? { refreshToken: token.refresh_token } : previous.refreshToken ? { refreshToken: previous.refreshToken } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(typeof token.scope === "string" && token.scope ? { scope: token.scope } : previous.scope ? { scope: previous.scope } : {}),
    ...(user === undefined ? (previous.user ? { user: previous.user } : {}) : { user })
  };
}

function safeUser(body) {
  const data = body?.data;
  if (!data || typeof data.id !== "string") return undefined;
  return { id: data.id, ...(typeof data.name === "string" ? { name: data.name } : {}), ...(typeof data.username === "string" ? { username: data.username } : {}) };
}

function textResponse(response, status, text, headers = {}) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(text);
}

function htmlResponse(response, status, title, text) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end("<!doctype html><meta charset=\"utf-8\"><title>" + title + "</title><p>" + text + "</p>");
}

function callbackErrorMessage(error) {
  if (error?.code === "ABORTED") return "Authorization was cancelled. You can close this tab.";
  if (error?.code === "X_API_ERROR") return "X rejected the authorization request. Start again.";
  return "Authorization could not be completed. Start again.";
}

function createStatusTool(client) {
  return defineTool({
    name: "x_account_status",
    description: "Check whether the X posting account is authorized. Never returns access tokens or refresh tokens.",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          authorized: { type: "boolean", required: true },
          expiresAt: { type: "integer" },
          user: { type: "object", additionalProperties: false, properties: { id: { type: "string", required: true }, name: { type: "string" }, username: { type: "string" } } }
        }
      },
      render: (_args, value) => [{ type: "text", text: value.authorized ? "X account is authorized" + (value.user?.username ? " as @" + value.user.username : "") : "X account is not authorized" }]
    },
    isConcurrencySafe: () => true,
    async execute() { return client.accountStatus(); }
  });
}

function createPostTool(client) {
  return defineTool({
    name: "x_post",
    description: "Publish a post through the official X API. This is an external side effect; call only after the user explicitly requests publication.",
    parameters: {
      text: { type: "string", required: true, description: "Exact post text formed from the user's requirements." },
      replyToTweetId: { type: "string", description: "Optional X post ID to reply to." },
      quoteTweetId: { type: "string", description: "Optional X post ID to quote." }
    },
    output: {
      schema: { type: "object", additionalProperties: false, properties: { id: { type: "string", required: true }, text: { type: "string", required: true }, url: { type: "string", required: true } } },
      render: (_args, value) => [{ type: "text", text: "Published X post " + value.url + "\\n" + value.text }]
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) { return client.postTweet(args, exec.signal); }
  });
}

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig);
  const pending = new Map();
  let refreshPromise;

  function resolveRedirectUri() {
    if (config.redirectUri) return config.redirectUri;
    try {
      return buildLoopbackRedirectUri({ host: ctx.webServer.host, port: ctx.webServer.port, callbackPath: config.callbackPath });
    } catch {
      throw new XPublisherError("DSH Web Server is not ready for OAuth callback; retry authorization after startup", "WEB_SERVER_NOT_READY");
    }
  }

  const client = {
    async readGrant() {
      const record = await ctx.credentials.readRecord(CREDENTIAL_KEY);
      if (!record || record.kind !== "grant" || !record.payload || typeof record.payload !== "object") return undefined;
      return typeof record.payload.accessToken === "string" && record.payload.accessToken ? record.payload : undefined;
    },
    async saveGrant(payload) { await ctx.credentials.modifyRecord(CREDENTIAL_KEY, () => ({ kind: "grant", payload })); },
    async exchangeCode(code, verifier, signal) {
      const form = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: resolveRedirectUri(), client_id: config.clientId, code_verifier: verifier });
      return requestJson(config.tokenUrl, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: form.toString() }, signal);
    },
    async refreshGrant(grant, signal) {
      if (!grant.refreshToken) throw new XPublisherError("X access token expired; authorize the account again", "REAUTH_REQUIRED");
      const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: grant.refreshToken, client_id: config.clientId });
      const token = await requestJson(config.tokenUrl, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: form.toString() }, signal);
      const payload = toGrant(token, grant);
      await this.saveGrant(payload);
      return payload;
    },
    async accessToken(signal) {
      requireClientId(config);
      const grant = await this.readGrant();
      if (!grant) throw new XPublisherError("Authorize an X account before posting", "NOT_AUTHORIZED");
      if (!grant.expiresAt || grant.expiresAt > Date.now() + 60000) return grant.accessToken;
      if (!refreshPromise) refreshPromise = this.refreshGrant(grant, signal).finally(() => { refreshPromise = undefined; });
      return (await refreshPromise).accessToken;
    },
    async postTweet(args, signal) {
      const accessToken = await this.accessToken(signal);
      const body = await requestJson(config.apiBaseUrl + "/2/tweets", { method: "POST", headers: { accept: "application/json", "content-type": "application/json", authorization: "Bearer " + accessToken }, body: JSON.stringify(buildPostPayload(args)) }, signal);
      if (!body?.data || typeof body.data.id !== "string" || typeof body.data.text !== "string") throw new XPublisherError("X returned an incomplete post response", "INVALID_RESPONSE");
      return { id: body.data.id, text: body.data.text, url: "https://x.com/i/web/status/" + body.data.id };
    },
    async accountStatus() {
      const grant = await this.readGrant();
      return { authorized: grant !== undefined, ...(grant?.expiresAt ? { expiresAt: grant.expiresAt } : {}), ...(grant?.user ? { user: grant.user } : {}) };
    }
  };

  function removePending(entry) {
    pending.delete(entry.state);
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener("abort", entry.onAbort);
  }

  function rejectPending(entry, error) {
    if (entry.consumed) return;
    entry.consumed = true;
    removePending(entry);
    entry.reject(error);
  }

  function createPending(signal) {
    requireClientId(config);
    if (pending.size > 0) throw new XPublisherError("An X authorization attempt is already in progress", "AUTH_IN_FLIGHT");
    const pkce = createPkcePair();
    const state = createState();
    const url = buildAuthorizationUrl({ authorizeUrl: config.authorizeUrl, clientId: config.clientId, redirectUri: resolveRedirectUri(), state, codeChallenge: pkce.challenge, scopes: config.scopes });
    let resolvePromise;
    let rejectPromise;
    const entry = { state, verifier: pkce.verifier, url, signal, consumed: false, resolve: undefined, reject: undefined, promise: undefined, timer: undefined, onAbort: undefined };
    entry.promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
    entry.resolve = resolvePromise;
    entry.reject = rejectPromise;
    entry.onAbort = () => rejectPending(entry, new XPublisherError("Authorization was cancelled", "ABORTED"));
    entry.timer = setTimeout(() => rejectPending(entry, new XPublisherError("Authorization timed out", "AUTH_TIMEOUT")), AUTHORIZATION_TIMEOUT_MS);
    entry.timer.unref?.();
    signal?.addEventListener("abort", entry.onAbort, { once: true });
    pending.set(state, entry);
    return entry;
  }

  async function callbackHandler(request, response) {
    if (request.method !== "GET") return textResponse(response, 405, "Method not allowed", { allow: "GET" });
    let url;
    try { url = new URL(request.url ?? "/", "http://127.0.0.1"); } catch { return textResponse(response, 400, "Invalid callback request"); }
    const state = url.searchParams.get("state");
    const entry = state === null ? undefined : pending.get(state);
    if (!entry) return textResponse(response, 400, "Authorization state is invalid or expired");
    pending.delete(entry.state);
    entry.consumed = true;
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener("abort", entry.onAbort);
    if (url.searchParams.has("error")) {
      entry.reject(new XPublisherError("The X authorization request was denied", "AUTH_DENIED"));
      return htmlResponse(response, 400, "X authorization denied", "Authorization was denied. You can close this tab.");
    }
    const code = url.searchParams.get("code");
    if (!code) {
      entry.reject(new XPublisherError("The X authorization callback did not include a code", "AUTH_CALLBACK_INVALID"));
      return textResponse(response, 400, "Authorization code is missing");
    }
    try {
      const token = await client.exchangeCode(code, entry.verifier, entry.signal);
      let user;
      try {
        if (typeof token?.access_token === "string" && token.access_token) user = safeUser(await requestJson(config.apiBaseUrl + "/2/users/me", { method: "GET", headers: { accept: "application/json", authorization: "Bearer " + token.access_token } }, entry.signal));
      } catch { user = undefined; }
      await client.saveGrant(toGrant(token, {}, user));
      entry.resolve({ user });
      return htmlResponse(response, 200, "X authorization complete", "X account authorized. You can close this tab.");
    } catch (error) {
      entry.reject(error);
      try { ctx.logger.warn("x-publisher: OAuth callback failed"); } catch { /* logging is best effort */ }
      return htmlResponse(response, 502, "X authorization failed", callbackErrorMessage(error));
    }
  }

  function startHandler(request, response) {
    if (request.method !== "GET") return textResponse(response, 405, "Method not allowed", { allow: "GET" });
    try {
      const entry = createPending();
      entry.promise.catch(() => undefined);
      response.writeHead(302, { location: entry.url, "cache-control": "no-store" });
      response.end();
    } catch (error) {
      const status = error?.code === "AUTH_IN_FLIGHT" ? 409 : error?.code === "NOT_CONFIGURED" ? 503 : 400;
      textResponse(response, status, error?.message ?? "Authorization is unavailable");
    }
  }

  ctx.effect(() => {
    const flowDisposer = ctx.authorization.registerFlow({
      key: CREDENTIAL_KEY,
      label: "X posting account",
      methods: [{ id: "oauth2-pkce", label: "Authorize with X" }],
      async run(session) {
        const entry = createPending(session.signal);
        session.notify({ message: "Open the X authorization page to connect the posting account.", url: entry.url });
        await entry.promise;
      }
    });
    const callbackDisposer = ctx.webServer.register({ kind: "exact", path: config.callbackPath, handler: callbackHandler });
    const startDisposer = ctx.webServer.register({ kind: "exact", path: config.startPath, handler: startHandler });
    const postDisposer = ctx.tools.register(createPostTool(client));
    const statusDisposer = ctx.tools.register(createStatusTool(client));
    return () => {
      for (const entry of pending.values()) rejectPending(entry, new XPublisherError("Authorization plugin stopped", "DISPOSED"));
      flowDisposer();
      callbackDisposer();
      startDisposer();
      postDisposer();
      statusDisposer();
    };
  }, "x-publisher lifecycle");
}

export { CREDENTIAL_KEY };
