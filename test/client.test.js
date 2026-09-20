import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const bundle = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");

function settingsPage(initialClientId) {
  const state = [];
  const popups = [];
  const saves = [];
  const navigations = [];
  let cursor = 0;
  let mounted = false;
  let section;
  let plugin;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = value; }];
    },
    useEffect(effect) { if (!mounted) effect(); }
  };
  const browser = {
    location: { origin: "http://127.0.0.1:3080", assign: (url) => navigations.push(url) },
    open(url, _target, features = "") {
      const popup = { opener: browser, location: { href: url }, close() { this.closed = true; } };
      popups.push(popup);
      return features.includes("noopener") ? null : popup;
    },
    __ModuleLoader__: { load({ factory }) { plugin = factory(() => React); } }
  };
  const fetch = async (_url, init) => ({
    ok: true,
    async json() {
      if (init.method === "GET") return { clientId: initialClientId, authorized: false };
      const body = JSON.parse(init.body);
      saves.push(body.clientId);
      return { clientId: body.clientId, authorized: false };
    }
  });
  runInNewContext(bundle, { window: browser, fetch, URL });
  plugin.apply({
    effect: (fn) => fn(),
    locale: { register: () => () => {}, bind: () => (key) => key },
    slots: { inject: (_slot, fn) => fn(), register: (_options, component) => { section = component; } }
  });
  function render() {
    cursor = 0;
    const tree = section({ t: (key) => key });
    mounted = true;
    return tree;
  }
  function find(node, type, label) {
    if (!node || typeof node !== "object") return undefined;
    if (node.type === type && (label === undefined || node.children.includes(label))) return node;
    for (const child of node.children) {
      const match = find(child, type, label);
      if (match) return match;
    }
  }
  return { render, find, popups, saves, navigations };
}

test("authorization opens the prepared tab after saving a new Client ID", async () => {
  const page = settingsPage("");
  page.render();
  await new Promise(setImmediate);
  const input = page.find(page.render(), "input");
  assert.equal(input.props.id, "x-publisher-client-id");
  input.props.onChange({ target: { value: "public-client-id" } });
  const button = page.find(page.render(), "button", "authorize");
  assert.equal(button.props.disabled, false);
  await button.props.onClick();
  assert.deepEqual(page.saves, ["public-client-id"]);
  assert.equal(page.popups.length, 1);
  assert.equal(page.popups[0].location.href, "/x-publisher/oauth/start");
  assert.equal(page.popups[0].opener, null);
  assert.deepEqual(page.navigations, []);
});

test("authorization with a saved Client ID opens a tab without another save", async () => {
  const page = settingsPage("saved-client-id");
  page.render();
  await new Promise(setImmediate);
  await page.find(page.render(), "button", "authorize").props.onClick();
  assert.deepEqual(page.saves, []);
  assert.equal(page.popups[0].location.href, "/x-publisher/oauth/start");
  assert.deepEqual(page.navigations, []);
});
