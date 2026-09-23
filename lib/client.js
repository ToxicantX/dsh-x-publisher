window.__ModuleLoader__.load({ id: "dsh-x-publisher", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
const React = require("react");
const h = React.createElement;
const { useEffect, useState } = React;
const NS = "settings.x_publisher";
const SETTINGS_ENDPOINT = "/x-publisher/settings";
const zh = {
  nav: "X 发布",
  title: "X 发布设置",
  description: "配置 X 官方 API 应用并授权要用于发帖的账户。",
  clientId: "X Client ID",
  clientIdHint: "这是 X Developer 应用的公开标识，不是 Client Secret。",
  callbackUrl: "Callback URL",
  callbackUrlHint: "将此固定地址完整登记到 X Developer Console；应用类型须为 Native App 或 Single Page App，权限须为 Read and write。",
  copy: "复制",
  copied: "已复制",
  copyFailed: "复制失败，请手动复制。",
  openConsole: "打开 X Developer Console",
  save: "保存",
  saving: "保存中...",
  saved: "已保存",
  authorize: "打开 X 授权",
  refresh: "刷新状态",
  loading: "加载中...",
  authorized: "已授权",
  notAuthorized: "未授权",
  account: "当前账户",
  notConfigured: "请先保存 X Client ID。",
  authorizeHint: "点击按钮后会在新标签页打开 X 授权页面。",
  authorizationHint: "账户已授权；需要重新授权时可以再次打开授权页面。",
  requestFailed: "请求失败，请重试。"
};
const en = {
  nav: "X Publisher",
  title: "X Publisher",
  description: "Configure the official X API application and authorize the account used for posting.",
  clientId: "X Client ID",
  clientIdHint: "This is the public identifier of the X Developer application, not a Client Secret.",
  callbackUrl: "Callback URL",
  callbackUrlHint: "Register this fixed URL in the X Developer Console. Use Native App or Single Page App with Read and write permissions.",
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Copy failed. Copy the value manually.",
  openConsole: "Open X Developer Console",
  save: "Save",
  saving: "Saving...",
  saved: "Saved",
  authorize: "Open X authorization",
  refresh: "Refresh status",
  loading: "Loading...",
  authorized: "Authorized",
  notAuthorized: "Not authorized",
  account: "Account",
  notConfigured: "Save an X Client ID first.",
  authorizeHint: "The button opens the X authorization page in a new tab.",
  authorizationHint: "The account is authorized; open the authorization page again when reauthorization is needed.",
  requestFailed: "Request failed. Try again."
};
function errorMessage(value, fallback) {
  return value && typeof value.error === "string" ? value.error : fallback;
}
function callbackUrlFromSettings(value) {
  const configured = typeof value?.redirectUri === "string" ? value.redirectUri.trim() : "";
  if (configured) return configured;
  try {
    return new URL("/x-publisher/oauth/callback", window.location.origin).toString();
  } catch {
    return "";
  }
}
async function requestSettings(init, signal) {
  const response = await fetch(SETTINGS_ENDPOINT, { ...init, signal, headers: { accept: "application/json", ...(init?.headers ?? {}) } });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(value, "Settings request failed"));
  return value;
}
function XPublisherSettingsSection({ t }) {
  const [clientId, setClientId] = useState("");
  const [savedClientId, setSavedClientId] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const value = await requestSettings({ method: "GET" });
      const nextClientId = String(value.clientId ?? "");
      setClientId(nextClientId);
      setSavedClientId(nextClientId);
      setCallbackUrl(callbackUrlFromSettings(value));
      setAuthorized(Boolean(value.authorized));
      setUser(value.user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("requestFailed"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const value = await requestSettings({ method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId }) });
      const nextClientId = String(value.clientId ?? "");
      setClientId(nextClientId);
      setSavedClientId(nextClientId);
      setCallbackUrl(callbackUrlFromSettings(value));
      setAuthorized(Boolean(value.authorized));
      setUser(value.user);
      setMessage(t("saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("requestFailed"));
    } finally {
      setSaving(false);
    }
  };
  const copyCallbackUrl = async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setMessage(t("copied"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("copyFailed"));
    }
  };
  const openAuthorization = async () => {
    const value = clientId.trim();
    if (!value) return;
    setAuthorizing(true);
    setError("");
    setMessage("");
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      if (value !== savedClientId) {
        const response = await requestSettings({ method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: value }) });
        const nextClientId = String(response.clientId ?? value);
        setClientId(nextClientId);
        setSavedClientId(nextClientId);
        setCallbackUrl(callbackUrlFromSettings(response));
      }
      if (popup) popup.location.href = "/x-publisher/oauth/start";
      else window.location.assign("/x-publisher/oauth/start");
    } catch (cause) {
      popup?.close();
      setError(cause instanceof Error ? cause.message : t("requestFailed"));
    } finally {
      setAuthorizing(false);
    }
  };
  const changed = clientId !== savedClientId;
  const statusText = loading ? t("loading") : authorized ? t("authorized") : t("notAuthorized");
  return h("section", { style: { maxWidth: 720, padding: "24px 0" } },
    h("style", null, ".x-publisher-client-id::placeholder { color: var(--dsw-alias-label-dimmed, rgba(127, 127, 127, 0.65)); opacity: 1; } .x-publisher-client-id:focus { border-color: var(--dsw-alias-brand-primary, #2563eb) !important; outline: 2px solid var(--dsw-alias-brand-primary, #2563eb); outline-offset: 1px; }"),
    h("h1", { style: { margin: "0 0 8px", fontSize: 24 } }, t("title")),
    h("p", { style: { margin: "0 0 24px", color: "var(--fg-muted, #737373)" } }, t("description")),
    h("label", { style: { display: "block", fontWeight: 600, marginBottom: 8 }, htmlFor: "x-publisher-client-id" }, t("clientId")),
    h("input", { id: "x-publisher-client-id", className: "x-publisher-client-id", value: clientId, onChange: (event) => setClientId(event.target.value), placeholder: "1234567890", autoComplete: "off", style: { display: "block", width: "min(100%, 560px)", boxSizing: "border-box", height: 40, padding: "9px 12px", border: "1px solid var(--dsw-alias-border-l4, rgba(127, 127, 127, 0.35))", borderRadius: 8, background: "var(--dsw-alias-bg-layer-1, transparent)", color: "var(--dsw-alias-label-primary, inherit)", WebkitTextFillColor: "var(--dsw-alias-label-primary, inherit)", caretColor: "var(--dsw-alias-brand-primary, currentColor)", fontSize: 14, lineHeight: "22px", outline: "none", transition: "box-shadow 120ms ease, border-color 120ms ease" } }),
    h("p", { style: { margin: "8px 0 16px", color: "var(--fg-muted, #737373)", fontSize: 13 } }, t("clientIdHint")),
    h("label", { style: { display: "block", fontWeight: 600, margin: "20px 0 8px" }, htmlFor: "x-publisher-callback-url" }, t("callbackUrl")),
    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
      h("input", { id: "x-publisher-callback-url", className: "x-publisher-client-id x-publisher-callback-url", value: callbackUrl, readOnly: true, spellCheck: false, "aria-describedby": "x-publisher-callback-hint", style: { flex: "1 1 420px", minWidth: 0, boxSizing: "border-box", height: 40, padding: "9px 12px", border: "1px solid var(--dsw-alias-border-l4, rgba(127, 127, 127, 0.35))", borderRadius: 8, background: "var(--dsw-alias-bg-layer-1, transparent)", color: "var(--dsw-alias-label-primary, inherit)", WebkitTextFillColor: "var(--dsw-alias-label-primary, inherit)", fontSize: 14, lineHeight: "22px", outline: "none" } }),
      h("button", { type: "button", onClick: copyCallbackUrl, disabled: loading || !callbackUrl, style: { padding: "9px 14px", borderRadius: 6, border: "1px solid var(--dsw-alias-border-l4, rgba(127, 127, 127, 0.35))", background: "var(--dsw-alias-bg-layer-1, transparent)", color: "var(--dsw-alias-label-primary, inherit)", cursor: loading || !callbackUrl ? "default" : "pointer", opacity: loading || !callbackUrl ? 0.55 : 1 } }, t("copy"))
    ),
    h("p", { id: "x-publisher-callback-hint", style: { margin: "8px 0 10px", color: "var(--fg-muted, #737373)", fontSize: 13 } }, t("callbackUrlHint")),
    h("button", { type: "button", onClick: () => window.open("https://console.x.com/", "_blank", "noopener,noreferrer"), style: { padding: "9px 14px", borderRadius: 6, border: "1px solid var(--dsw-alias-brand-primary, #2563eb)", background: "transparent", color: "var(--dsw-alias-brand-primary, #2563eb)", cursor: "pointer" } }, t("openConsole")),

    h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 24 } },
      h("button", { type: "button", onClick: save, disabled: saving || !changed, style: { padding: "9px 14px", borderRadius: 6, border: "1px solid var(--accent, #2563eb)", background: "var(--accent, #2563eb)", color: "white", cursor: saving || !changed ? "default" : "pointer", opacity: saving || !changed ? 0.55 : 1 } }, saving ? t("saving") : t("save")),
      message ? h("span", { style: { color: "var(--success, #15803d)", fontSize: 13 } }, message) : null
    ),
    h("div", { style: { borderTop: "1px solid var(--border, #e5e5e5)", paddingTop: 20 } },
      h("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 } },
        h("strong", null, t("account")),
        h("span", { style: { color: authorized ? "var(--success, #15803d)" : "var(--fg-muted, #737373)" } }, statusText),
        user?.username ? h("span", null, "@" + user.username) : null
      ),
      h("p", { style: { margin: "0 0 14px", color: "var(--fg-muted, #737373)", fontSize: 13 } }, authorized ? t("authorizationHint") : savedClientId ? t("authorizeHint") : t("notConfigured")),
      h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        h("button", { type: "button", onClick: openAuthorization, disabled: loading || authorizing || !clientId.trim(), style: { padding: "9px 14px", borderRadius: 6, border: "1px solid var(--accent, #2563eb)", background: "var(--accent, #2563eb)", color: "white", cursor: loading || authorizing || !clientId.trim() ? "default" : "pointer", opacity: loading || authorizing || !clientId.trim() ? 0.55 : 1 } }, t("authorize")),
        h("button", { type: "button", onClick: () => void load(), disabled: loading, style: { padding: "9px 14px", borderRadius: 6, border: "1px solid var(--border, #d4d4d4)", background: "transparent", color: "inherit", cursor: loading ? "default" : "pointer", opacity: loading ? 0.55 : 1 } }, t("refresh"))
      )
    ),
    error ? h("p", { role: "alert", style: { marginTop: 16, color: "var(--danger, #b91c1c)" } }, error) : null
  );
}
const inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "x-publisher: locale");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "x-publisher", order: 40, label: () => t("nav"), inject: () => ({ t }) }, XPublisherSettingsSection));
}
exports.apply = apply;
exports.inject = inject;
return module.exports; } });
