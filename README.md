# dsh-x-publisher

A standalone DeepSeek Harness plugin for publishing posts through the official X API. The plugin does not call an LLM itself: DSH forms the post text from the user's requirements, then the x_post tool submits the exact text after the user requests publication.

## Features

- OAuth 2.0 Authorization Code with PKCE using S256.
- A DSH authorization flow that opens X and stores the resulting grant in the DSH credentials store.
- Loopback-friendly start and callback routes.
- Automatic refresh-token exchange near access-token expiry.
- x_account_status and x_post model tools.

The plugin uses X API v2 only. It does not use browser cookies, password login, scraping, or unofficial posting endpoints.

## X developer setup

Create an application in the X Developer Portal and enable OAuth 2.0 User Authentication.

Use a public client with PKCE and configure an exact callback such as:

~~~text
http://127.0.0.1:3080/x-publisher/oauth/callback
~~~

Required scopes are tweet.read, tweet.write, users.read, and offline.access. The redirect URI in the portal, plugin config, and authorization request must be byte-for-byte identical. No client secret is needed for this public PKCE flow.

## Install as a DSH bundle

From the DSH Web profile, install the local package:

~~~powershell
pnpm --dir "$env:USERPROFILE/.dsh/profiles/web" add "file:E:/workspace/PluginProjects/dsh-x-publisher"
~~~

Add dsh-x-publisher to the profile dsh.profile.bundles list if the plugin manager did not add it automatically. Restart DSH Web after changing the profile composition.

Set the public client values before starting DSH. They are not secrets:

~~~powershell
$env:X_CLIENT_ID = "your-public-client-id"
$env:X_REDIRECT_URI = "http://127.0.0.1:3080/x-publisher/oauth/callback"
dsh web
~~~

The plugin bundle reads those values through cordis.patch.yml. For a persistent local setup, put them in the DSH home .env file. Never put access tokens, refresh tokens, or client secrets in this directory or in cordis.patch.yml.

The target profile must include authorization, credentials, webServer, and tools. This bundle is intended for DSH Web because the browser callback needs the Web server.

## Authorize an account

Use the DSH authorization UI and choose X posting account, or open this URL while DSH Web is running:

~~~text
http://127.0.0.1:3080/x-publisher/oauth/start
~~~

The start route redirects to X. After approval, X redirects to the exact callback and the plugin stores the access and refresh tokens as an opaque grant under the DSH credentials store. The local credentials file is normally $DSH_HOME/.credentials.yaml and is managed by dsh-credentials-local.

## Use from DSH

After authorization, ask DSH to publish a post and include the desired tone, language, links, and constraints. The agent should form the final text and call x_post only when the user explicitly requested publication. Optional fields support replying to or quoting an existing X post.

The tool returns the created post ID, text, and canonical x.com URL. Account status never returns token fields.

## Checks

~~~powershell
npm test
npm run check
~~~

Tests use deterministic PKCE fixtures and never contact X. The runtime uses native fetch and Node crypto; no third-party OAuth client is bundled.

## Security

- State and PKCE verifier are generated per authorization attempt and the callback is accepted once.
- Authorization attempts expire after ten minutes and observe DSH cancellation and disposal.
- Use loopback locally. Use TLS and an authenticated reverse proxy before exposing a callback beyond the local machine.
- Errors are sanitized and callback query values and bearer tokens are never logged or returned by tools.
- Posting is an external side effect and remains an explicit user action.
