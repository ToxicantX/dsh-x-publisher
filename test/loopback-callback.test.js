import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request } from "node:http";
import { isLoopbackHttpUrl, resolveCallbackRedirectUri, startLoopbackCallbackServer } from "../lib/loopback-callback.js";

function get(url) {
  return new Promise((resolve, reject) => {
    const requestHandle = request(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    requestHandle.on("error", reject);
    requestHandle.end();
  });
}

test("loopback callback server accepts only the configured path", async () => {
  const reservation = await new Promise((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
  const port = reservation.address().port;
  reservation.close();
  await once(reservation, "close");

  const redirectUri = "http://127.0.0.1:" + port + "/x-publisher/oauth/callback";
  const server = await startLoopbackCallbackServer(redirectUri, (_request, response) => response.writeHead(200).end("callback received"));
  try {
    assert.deepEqual(await get(redirectUri + "?state=test"), { status: 200, body: "callback received" });
    assert.deepEqual(await get("http://127.0.0.1:" + port + "/other"), { status: 404, body: "Not found" });
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("loopback callback validation rejects non-loopback URLs", () => {
  assert.equal(resolveCallbackRedirectUri("", "/x-publisher/oauth/callback"), "http://127.0.0.1:3080/x-publisher/oauth/callback");
  assert.equal(isLoopbackHttpUrl("http://127.0.0.1:3080/callback"), true);
  assert.equal(isLoopbackHttpUrl("https://example.com/callback"), false);
  assert.throws(() => startLoopbackCallbackServer("https://example.com/callback", () => {}), /loopback/iu);
});

test("loopback callback server reports an occupied port", async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  try {
    await assert.rejects(startLoopbackCallbackServer("http://127.0.0.1:" + port + "/callback", () => {}), { code: "EADDRINUSE" });
  } finally {
    server.close();
    await once(server, "close");
  }
});
