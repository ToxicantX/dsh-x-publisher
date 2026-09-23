# dsh-x-publisher

[中文（默认）](README.md) | English

This file contains the English version of the project documentation. The main README keeps Chinese as the default display language and contains the same bilingual sections.

## Overview

dsh-x-publisher is a standalone DeepSeek Harness bundle plugin that provides X account authorization, credential persistence, token refresh, and posting through the official X API.

The plugin does not call an LLM itself. A DSH Agent forms the final text from the user's requirements and calls x_post only after the user explicitly requests publication.

## Features

- OAuth 2.0 Authorization Code with PKCE using S256.
- DSH authorization flow for opening the X authorization page.
- Access tokens, refresh tokens, and limited account data stored as a DSH GrantRecord.
- Local Web routes for starting authorization and receiving a one-time OAuth callback.
- Automatic refresh-token exchange near access-token expiry.
- x_account_status and x_post tools.
- Normal posts, replies, and quoted posts through X API v2.
- No cookies, password login, scraping, or unofficial endpoints.

## Requirements

- DeepSeek Harness 0.1.6-alpha.2 or a compatible newer release.
- Node.js 20 or newer.
- A DSH Web profile with authorization, credentials, webServer, and tools services.
- An X Developer application with OAuth 2.0 User Authentication enabled.
- A Native App or Single Page App (Public Client + PKCE) with Read and write permissions.

## X Developer Portal setup

Create an application in the X Developer Portal and enable OAuth 2.0 User Authentication.

Set App type to Native App or Single Page App and App permissions to Read and write. The plugin uses this fixed local Redirect URI:

~~~text
http://127.0.0.1:3080/x-publisher/oauth/callback
~~~

Before first use, register that exact Callback URI in the X Developer Portal. The Redirect URI in the portal, generated authorization request, and X callback must match byte-for-byte. The plugin listens directly on `127.0.0.1:3080`, so random DSH Web port changes no longer affect authorization. A Public PKCE flow does not need a Client Secret. If port 3080 is occupied, the plugin reports a clear error when authorization starts.

Required scopes:

- tweet.read
- tweet.write
- users.read
- offline.access

## Installation

Install from the public GitHub repository into the DSH Web profile. No SSH key is required:

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-x-publisher
~~~

Restart DSH Web and refresh the browser after installation. The new bundle is enabled by default.

When running DSH from a source checkout, use pnpm dsh instead of dsh:

~~~powershell
pnpm dsh plugin --profile web add -w github:ToxicantX/dsh-x-publisher
~~~

The same public GitHub address can also be entered in the DSH Web Plugins page:

~~~text
github:ToxicantX/dsh-x-publisher
~~~

## Settings page configuration

X_CLIENT_ID is the public identifier of the X Developer application and must be available before the authorization request. X cannot return it after the user clicks authorize. Edit and save it directly in DSH Web:

1. Open **Settings > X Publisher**.
2. Paste the public Client ID into **X Client ID**.
3. Click **Save**.
4. Click **Open X authorization** and complete account authorization in the new tab.

The settings page displays the fixed Callback URL. Click **Copy** to copy the exact value, or click **Open X Developer Console** to configure the X application.

The plugin stores the value in the DSH credentials store, so it survives a DSH restart. The legacy X_CLIENT_ID environment variable remains available as an initial fallback, but a value saved in Settings takes precedence. Do not set X_REDIRECT_URI. The default callback is fixed at `http://127.0.0.1:3080/x-publisher/oauth/callback`. Never put access tokens, refresh tokens, or client secrets in the plugin directory, profile patch, or chat messages.

## Usage

1. Open DSH Web.
2. Install the plugin with the public GitHub command above.
3. Open **Settings > X Publisher**, save the X Client ID, and confirm that the X Developer Portal contains the fixed Callback URI shown in Settings.
4. Restart DSH Web.
5. Choose X posting account in the DSH authorization UI, or open the authorization start URL.
6. Complete X account authorization in the browser.
7. Describe the desired content, tone, language, links, and constraints to DSH.
8. Call x_post only after the user explicitly requests publication.

Authorization start URL:

~~~text
http://127.0.0.1:3080/x-publisher/oauth/start
~~~

x_post parameters:

- text: final post text, required.
- replyToTweetId: optional post ID to reply to.
- quoteTweetId: optional post ID to quote.

The tool returns only the created post ID, text, and canonical x.com URL. x_account_status never returns token fields.

## Credentials and security

- Each authorization attempt gets a new state and PKCE verifier.
- OAuth callbacks are accepted once and expire after ten minutes.
- The flow observes DSH cancellation and plugin disposal.
- Credentials are managed by the DSH credentials store, normally in .credentials.yaml under the DSH home.
- Errors are sanitized; callback query values and bearer tokens are never logged.
- Use loopback locally. Use TLS and an authenticated reverse proxy before exposing a callback beyond the local machine.
- Posting is an external side effect and remains an explicit user action.

## Local development

~~~powershell
git clone https://github.com/ToxicantX/dsh-x-publisher.git
cd dsh-x-publisher
npm test
npm run check
~~~

Tests use deterministic PKCE fixtures and never contact X. The runtime uses native Node fetch and crypto; no third-party OAuth client is bundled.

## Release management

Releases follow [Semantic Versioning](https://semver.org/) (SemVer). Record user-facing changes in [CHANGELOG.md](CHANGELOG.md) and use `vX.Y.Z` tags. After committing package.json and CHANGELOG.md, run the preflight:

~~~powershell
npm run release:check -- v0.2.7
~~~

After the preflight passes, create and push the matching tag:

~~~powershell
git tag v0.2.7
git push origin v0.2.7
~~~

Pushing a matching tag triggers GitHub Actions validation and creates a GitHub Release; npm publishing is not automatic.
