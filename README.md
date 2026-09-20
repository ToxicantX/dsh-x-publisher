# dsh-x-publisher

中文（默认） | [English](README.en.md)

一个独立的 DeepSeek Harness 插件，通过 X 官方 API 完成账户授权和发帖。

插件本身不会调用 LLM。DSH 会根据用户需求生成最终文本，然后在用户明确要求发布后调用 x_post 提交原文。

## 功能

- 使用 OAuth 2.0 Authorization Code with PKCE，采用 S256。
- 通过 DSH authorization flow 打开 X 授权页面。
- 将访问令牌和刷新令牌作为 DSH GrantRecord 保存，不写入插件目录。
- 提供本地 Web 授权开始路由和一次性 OAuth 回调路由。
- Access Token 即将过期时自动使用 Refresh Token 刷新。
- 提供 x_account_status 和 x_post 工具。
- 只使用 X API v2，不使用 Cookie、密码登录、爬虫或非官方接口。

## X Developer Portal 配置

在 X Developer Portal 创建应用并启用 OAuth 2.0 User Authentication。

使用 Public Client + PKCE，并配置精确匹配的回调地址，例如：

~~~text
http://127.0.0.1:3080/x-publisher/oauth/callback
~~~

需要申请以下 scopes：

- tweet.read
- tweet.write
- users.read
- offline.access

X Developer Portal、插件配置和授权请求中的 Redirect URI 必须逐字节一致。Public PKCE 流程不需要 Client Secret。

## 远程安装

通过 DSH 插件命令从 GitHub SSH 仓库安装：

~~~powershell
dsh plugin --profile web add "git+ssh://git@github.com/ToxicantX/dsh-x-publisher.git"
~~~

该命令会把远程 Git 地址交给当前 profile 的 pnpm。新安装的 bundle 默认会启用。安装完成后重启 DSH Web，使新的运行时模块加载生效。

也可以在 DSH Web 的 Plugins 页面中使用以下 Git SSH 地址安装：

~~~text
git+ssh://git@github.com/ToxicantX/dsh-x-publisher.git
~~~

## 启动配置

Client ID 是公开值，不是密钥。启动 DSH 前设置：

~~~powershell
$env:X_CLIENT_ID = "your-public-client-id"
$env:X_REDIRECT_URI = "http://127.0.0.1:3080/x-publisher/oauth/callback"
dsh web
~~~

也可以把这两个非敏感变量放入 DSH home 的 .env 文件。不要把 Access Token、Refresh Token 或 Client Secret 写入插件目录或 cordis.patch.yml。

目标 profile 必须提供 authorization、credentials、webServer 和 tools 服务。本插件面向 DSH Web，因为 OAuth 浏览器回调需要 Web Server。

## 授权账户

在 DSH 授权界面选择 X posting account，或者在 DSH Web 运行时打开：

~~~text
http://127.0.0.1:3080/x-publisher/oauth/start
~~~

开始路由会将浏览器重定向到 X。用户批准后，X 会重定向到精确回调地址，插件将 Access Token、Refresh Token 和有限的账户信息保存到 DSH credentials store。

凭据文件通常位于 $DSH_HOME/.credentials.yaml，由 dsh-credentials-local 管理。

## 在 DSH 中使用

授权完成后，向 DSH 描述要发布的内容、语气、语言、链接和限制条件。Agent 应先根据需求形成最终文本，只有在用户明确要求发布时才调用 x_post。

x_post 支持普通发帖，也支持通过 replyToTweetId 回复现有帖子，或通过 quoteTweetId 引用现有帖子。

工具只返回创建后的帖子 ID、文本和 x.com URL。x_account_status 不会返回任何 Token 字段。

## 检查

~~~powershell
npm test
npm run check
~~~

测试使用确定性的 PKCE fixture，不会访问 X。运行时只使用 Node 原生 fetch 和 crypto，不捆绑第三方 OAuth 客户端。

## 安全说明

- 每次授权都会生成独立的 state 和 PKCE verifier，回调只接受一次。
- 授权尝试十分钟后过期，并响应 DSH 取消和插件销毁。
- 本地开发建议只使用 loopback 地址；对外暴露回调前必须使用 TLS 和受保护的反向代理。
- 错误信息经过清理，不记录回调查询参数和 Bearer Token。
- 发帖属于外部副作用，必须保持为用户明确触发的操作。
