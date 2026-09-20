import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("bundle patch mounts the authorization service before X publisher", async () => {
  const patch = await readFile(new URL("../cordis.patch.yml", import.meta.url), "utf8");
  assert.match(patch, /id: authorization[\s\S]*?name: ['"]@deepseek-ai\/dsh-authorization['"][\s\S]*?id: x-publisher/u);
});
