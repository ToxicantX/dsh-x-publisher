# dsh-x-publisher

通过 X 官方 API 为 DeepSeek Harness 提供账户授权和发帖能力。

[![Stars](https://img.shields.io/github/stars/ToxicantX/dsh-x-publisher?label=stars)](https://github.com/ToxicantX/dsh-x-publisher/stargazers)
[![Issues](https://img.shields.io/github/issues/ToxicantX/dsh-x-publisher)](https://github.com/ToxicantX/dsh-x-publisher/issues)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](./package.json)
[![DSH](https://img.shields.io/badge/dsh-0.1.6--alpha.2-4c8bf5)](https://github.com/deepseek-ai/deepseek-harness)

[中文](#中文) | [English](#english)

## 中文

### 项目介绍

dsh-x-publisher 是一个独立的 DSH bundle 插件。它通过 X 官方 API 完成账户授权、Token 持久化、Token 刷新和发帖。

插件不会自行调用 LLM。DSH Agent 根据用户需求形成最终文本，只有在用户明确要求发布时才调用 x_post 提交内容。

### 功能特性

- 使用 OAuth 2.0 Authorization Code with PKCE，采用 S256。
- 通过 DSH authorization flow 打开 X 授权页面。
- 将 Access Token、Refresh Token 和有限账户信息保存为 DSH GrantRecord。
- 提供本地 Web 授权开始路由和一次性 OAuth 回调路由。
- Access Token 临近过期时自动使用 Refresh Token 刷新。
- 提供 x_account_status 和 x_post 工具。
- 支持普通发帖、回复帖子和引用帖子。
- 只使用 X API v2，不使用 Cookie、密码登录、爬虫或非官方接口。
- 所有外部发帖操作都明确标记为副作用。

### 环境要求

- DeepSeek Harness 0.1.6-alpha.2 或兼容的新版本。
- Node.js 20 或更高版本。
- DSH Web profile 提供 authorization、credentials、webServer 和 tools 服务。
- 一个启用了 OAuth 2.0 User Authentication 的 X Developer 应用。
- X 应用使用 Public Client + PKCE，并拥有 tweet.write、users.read 和 offline.access scopes。

### X Developer Portal 配置

在 X Developer Portal 创建应用并启用 OAuth 2.0 User Authentication。

配置 Public Client + PKCE。插件会根据 DSH Web Server 当前监听地址和 callbackPath 自动生成 Redirect URI，例如：

~~~text
http://127.0.0.1:3080/x-publisher/oauth/callback
~~~

首次启用前，仍需在 X Developer Portal 登记这个精确的 Callback URI。Redirect URI 在 X Developer Portal、插件生成的授权请求和 X 回调中必须逐字节一致。用户不需要设置 X_REDIRECT_URI；如果 DSH Web 端口发生变化，需要同步更新 X Developer Portal 中的 Callback URI。Public PKCE 流程不需要 Client Secret。

需要的 scopes：

- tweet.read
- tweet.write
- users.read
- offline.access

### 安装

从公开 GitHub 仓库安装到 DSH Web profile，不需要 SSH Key：

~~~powershell
dsh plugin --profile web add -w github:ToxicantX/dsh-x-publisher
~~~

安装完成后重启 DSH Web，并刷新浏览器。新的 bundle 默认会被启用。

如果从 DSH 源码仓库运行，将命令中的 dsh 替换为 pnpm dsh：

~~~powershell
pnpm dsh plugin --profile web add -w github:ToxicantX/dsh-x-publisher
~~~

也可以在 DSH Web 的 Plugins 页面中输入以下公开 GitHub 地址安装：

~~~text
github:ToxicantX/dsh-x-publisher
~~~

### 启动配置

X_CLIENT_ID 是 X Developer 应用的公开标识，必须在授权请求发出前提供。它不能在用户点击授权后由 X 自动返回；如果项目方提供了自己的公开 Client ID，可以把它内置到插件配置中，普通用户就无需填写。当前版本使用环境变量配置：

~~~powershell
$env:X_CLIENT_ID = "your-public-client-id"
dsh web
~~~

不要设置 X_REDIRECT_URI。插件会在授权开始时根据当前 DSH Web Server 自动生成回调地址。不要把 Access Token、Refresh Token 或 Client Secret 写入插件目录、profile patch 或聊天内容。

### 使用方法

1. 打开 DSH Web。
2. 使用上面的公开 GitHub 命令安装插件。
3. 配置 X Client ID，并确认 X Developer Portal 已登记当前 DSH Web 自动生成的 Callback URI。
4. 重启 DSH Web。
5. 在 DSH 授权界面选择 X posting account，或打开授权开始地址。
6. 在浏览器中完成 X 账户授权。
7. 向 DSH 描述要发布的内容、语气、语言、链接和限制条件。
8. 只有在用户明确要求发布时，才调用 x_post。

授权开始地址：

~~~text
http://127.0.0.1:3080/x-publisher/oauth/start
~~~

x_post 参数：

- text：要发布的最终文本，必填。
- replyToTweetId：可选，要回复的帖子 ID。
- quoteTweetId：可选，要引用的帖子 ID。

工具返回创建后的帖子 ID、文本和 x.com URL。x_account_status 不会返回任何 Token 字段。

### 凭据和安全

- 每次授权都会生成新的 state 和 PKCE verifier。
- OAuth 回调只接受一次，授权尝试十分钟后过期。
- 授权流程响应 DSH 取消和插件销毁。
- 凭据由 DSH credentials store 管理，通常位于 DSH home 的 .credentials.yaml。
- 错误信息经过清理，不记录回调查询参数和 Bearer Token。
- 本地开发建议使用 loopback 地址；对外暴露回调前必须使用 TLS 和受保护的反向代理。
- 发帖是外部副作用，必须保持为用户明确触发的操作。

### 本地开发

~~~powershell
git clone https://github.com/ToxicantX/dsh-x-publisher.git
cd dsh-x-publisher
npm test
npm run check
~~~

测试使用确定性的 PKCE fixture，不会访问 X。运行时使用 Node 原生 fetch 和 crypto，不捆绑第三方 OAuth 客户端。

## English

### Overview

dsh-x-publisher is a standalone DSH bundle plugin that provides X account authorization, credential persistence, token refresh, and posting through the official X API.

The plugin does not call an LLM itself. A DSH Agent forms the final text from the user's requirements and calls x_post only after the user explicitly requests publication.

### Features

- OAuth 2.0 Authorization Code with PKCE using S256.
- A DSH authorization flow that opens the X authorization page.
- Access tokens, refresh tokens, and limited account data stored as a DSH GrantRecord.
- Local Web routes for starting authorization and receiving a one-time OAuth callback.
- Automatic refresh-token exchange near access-token expiry.
- x_account_status and x_post tools.
- Normal posts, replies, and quoted posts.
- X API v2 only: no cookies, password login, scraping, or unofficial endpoints.
- External posting is explicitly marked as a side effect.

### Requirements

- DeepSeek Harness 0.1.6-alpha.2 or a compatible newer release.
- Node.js 20 or newer.
- A DSH Web profile with authorization, credentials, webServer, and tools services.
- An X Developer application with OAuth 2.0 User Authentication enabled.
- A Public Client using PKCE with tweet.write, users.read, and offline.access scopes.

### X Developer Portal setup

Create an application in the X Developer Portal and enable OAuth 2.0 User Authentication.

Use Public Client + PKCE. The plugin automatically derives the Redirect URI from the current DSH Web Server address and callback path, for example:

~~~text
http://127.0.0.1:3080/x-publisher/oauth/callback
~~~

Before first use, register that exact Callback URI in the X Developer Portal. The Redirect URI in the portal, generated authorization request, and X callback must match byte-for-byte. Users do not need to set X_REDIRECT_URI; if the DSH Web port changes, update the Callback URI in the X Developer Portal. A Public PKCE flow does not need a Client Secret.

Required scopes:

- tweet.read
- tweet.write
- users.read
- offline.access

### Installation

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

### Startup configuration

X_CLIENT_ID is the public identifier of the X Developer application and must be available before the authorization request. X cannot return it after the user clicks authorize. If the project provides its own public Client ID, it can be built into the plugin so ordinary users do not need to enter it. The current version reads it from the environment:

~~~powershell
$env:X_CLIENT_ID = "your-public-client-id"
dsh web
~~~

Do not set X_REDIRECT_URI. The plugin derives the callback URI from the current DSH Web Server when authorization starts. Never put access tokens, refresh tokens, or client secrets in the plugin directory, profile patch, or chat messages.

### Usage

1. Open DSH Web.
2. Install the plugin with the public GitHub command above.
3. Configure the X Client ID and confirm that the X Developer Portal contains the Callback URI generated by the current DSH Web Server.
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

### Credentials and security

- Each authorization attempt gets a new state and PKCE verifier.
- OAuth callbacks are accepted once and expire after ten minutes.
- The flow observes DSH cancellation and plugin disposal.
- Credentials are managed by the DSH credentials store, normally in .credentials.yaml under the DSH home.
- Errors are sanitized; callback query values and bearer tokens are never logged.
- Use loopback locally. Use TLS and an authenticated reverse proxy before exposing a callback beyond the local machine.
- Posting is an external side effect and remains an explicit user action.

### Local development

~~~powershell
git clone https://github.com/ToxicantX/dsh-x-publisher.git
cd dsh-x-publisher
npm test
npm run check
~~~

Tests use deterministic PKCE fixtures and never contact X. The runtime uses native Node fetch and crypto; no third-party OAuth client is bundled.
