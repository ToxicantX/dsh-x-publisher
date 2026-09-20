# dsh-x-publisher

[中文（默认）](README.md) | English

A standalone DeepSeek Harness plugin for account authorization and posting through the official X API.

The plugin does not call an LLM itself. DSH forms the final text from the user's requirements, then calls x_post with the exact text only after the user explicitly requests publication.

## Features

- OAuth 2.0 Authorization Code with PKCE using S256.
- A DSH authorization flow that opens the X authorization page.
- Access and refresh tokens stored as a DSH GrantRecord, never in the plugin directory.
- Local Web routes for starting authorization and receiving a one-time OAuth callback.
- Automatic refresh-token exchange near access-token expiry.
- x_account_status and x_post tools.
- X API v2 only: no cookies, password login, scraping, or unofficial endpoints.

## X Developer Portal setup

Create an application in the X Developer Portal and enable OAuth 2.0 User Authentication.

Use a Public Client with PKCE and configure an exact callback such as:

~~~text
http://127.0.0.1:3080/x-publisher/oauth/callback
~~~

Request these scopes:

- tweet.read
- tweet.write
- users.read
- offline.access

The Redirect URI in the X Developer Portal, plugin configuration, and authorization request must match byte-for-byte. A Public PKCE flow does not need a Client Secret.

## Remote installation

Install from the GitHub SSH repository through the DSH plugin command:

~~~powershell
dsh plugin --profile web add "git+ssh://git@github.com/ToxicantX/dsh-x-publisher.git"
~~~

The command forwards the remote Git specification to pnpm for the selected profile. A newly installed bundle is enabled by default. Restart DSH Web after installation so the new runtime module is loaded.

The same Git SSH URL can also be entered in the DSH Web Plugins page:

~~~text
git+ssh://git@github.com/ToxicantX/dsh-x-publisher.git
~~~

## Startup configuration

The Client ID is public, not a secret. Set these values before starting DSH:

~~~powershell
$env:X_CLIENT_ID = "your-public-client-id"
$env:X_REDIRECT_URI = "http://127.0.0.1:3080/x-publisher/oauth/callback"
dsh web
~~~

For a persistent local setup, put these non-sensitive variables in the DSH home .env file. Never put access tokens, refresh tokens, or client secrets in the plugin directory or cordis.patch.yml.

The target profile must provide authorization, credentials, webServer, and tools. This plugin targets DSH Web because the OAuth browser callback requires the Web Server.

## Authorize an account

Use the DSH authorization UI and choose X posting account, or open this URL while DSH Web is running:

~~~text
http://127.0.0.1:3080/x-publisher/oauth/start
~~~

The start route redirects the browser to X. After approval, X redirects to the exact callback URI and the plugin stores the access token, refresh token, and limited account information in the DSH credentials store.

The credentials file is normally located at $DSH_HOME/.credentials.yaml and is managed by dsh-credentials-local.

## Use from DSH

After authorization, describe the desired content, tone, language, links, and constraints. The agent should form the final text and call x_post only after the user explicitly requests publication.

x_post supports normal posts, replies through replyToTweetId, and quotes through quoteTweetId.

The tool returns only the created post ID, text, and canonical x.com URL. x_account_status never returns token fields.

## Checks

~~~powershell
npm test
npm run check
~~~

Tests use deterministic PKCE fixtures and never contact X. The runtime uses native Node fetch and crypto; no third-party OAuth client is bundled.

## Security

- Each authorization attempt gets a new state and PKCE verifier; callbacks are accepted once.
- Authorization attempts expire after ten minutes and observe DSH cancellation and plugin disposal.
- Use loopback locally. Use TLS and an authenticated reverse proxy before exposing a callback beyond the local machine.
- Errors are sanitized; callback query values and bearer tokens are never logged.
- Posting is an external side effect and remains an explicit user action.
