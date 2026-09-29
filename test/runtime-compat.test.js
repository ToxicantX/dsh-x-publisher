import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("DSH peer dependencies match the selected runtime", { skip: !process.env.DSH_RUNTIME_PACKAGE_JSON }, async () => {
  const plugin = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const runtime = JSON.parse(await readFile(process.env.DSH_RUNTIME_PACKAGE_JSON, "utf8"));
  for (const name of ["@deepseek-ai/cordis", "@deepseek-ai/dsh-authorization", "@deepseek-ai/dsh-credentials", "@deepseek-ai/dsh-host-webserver", "@deepseek-ai/dsh-tools"]) {
    assert.equal(plugin.peerDependencies[name], runtime.dependencies[name], name);
  }
});
