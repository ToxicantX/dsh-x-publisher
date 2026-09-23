import { createServer } from "node:http";

export const DEFAULT_LOOPBACK_HOST = "127.0.0.1";
export const DEFAULT_LOOPBACK_PORT = 3080;

export function resolveCallbackRedirectUri(configured, callbackPath) {
  if (configured) return configured;
  return new URL(callbackPath, "http://" + DEFAULT_LOOPBACK_HOST + ":" + DEFAULT_LOOPBACK_PORT).toString();
}

export function isLoopbackHttpUrl(value) {
  const url = value instanceof URL ? value : new URL(value);
  return url.protocol === "http:" && url.hostname === DEFAULT_LOOPBACK_HOST;
}

export function startLoopbackCallbackServer(redirectUri, handler) {
  const target = new URL(redirectUri);
  if (!isLoopbackHttpUrl(target) || !target.port) throw new TypeError("OAuth loopback callback must use an explicit localhost port");

  const server = createServer((request, response) => {
    let url;
    try { url = new URL(request.url ?? "/", target); } catch { response.writeHead(400).end("Invalid request"); return; }
    if (url.pathname !== target.pathname) { response.writeHead(404).end("Not found"); return; }
    Promise.resolve().then(() => handler(request, response)).catch(() => {
      if (!response.headersSent) response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      if (!response.writableEnded) response.end("OAuth callback failed");
    });
  });

  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(Number(target.port), target.hostname, () => {
      server.off("error", onError);
      resolve(server);
    });
  });
}
