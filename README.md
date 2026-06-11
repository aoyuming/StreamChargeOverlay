# StreamCharge Overlay

StreamCharge Overlay 是一个面向主播场景的 OBS 赞助展示与后台管理系统。它可以在后台录入赞助、管理房间和权限，并把今日榜单、近两月榜单、头像、充能进度条、全屏入场特效和语音播报展示到 OBS 浏览器源中。

项目原名为“赞助同步”，建议仓库名为 `stream-charge-overlay`。

## 功能亮点

- 多房间管理：内置温柔房、李永房、59 房，也可以在后台继续新增或删除房间。
- 两级权限：普通权限用于房间后台操作，超级权限用于更高权限的管理动作。
- 赞助后台：添加赞助、启动资金充能、开始点将、软移除今日榜单、重新加入今日榜单、删除和回收站恢复。
- 老板头像：支持上传、剪切板导入，并同步历史同名老板头像。
- OBS 展示页：透明背景，展示今日大哥节目榜单、近两月榜单、头像和实时赞助内容。
- 充能进度条：按进度切换冰、水、水火过渡、火、电阶段。
- 全屏入场特效：按单笔金额触发冰、水、火、电特效。
- 语音合成：播报节目和备注，小数根数只念一位，数字 2 念“两”。
- 打包部署：提供服务端打包脚本，产物为 `dist/sponsor-overlay-server-package.zip`。

## 快速开始

安装依赖：

```powershell
npm.cmd install
```

启动本地服务：

```powershell
npm.cmd run dev
```

默认服务地址：

- 展示页：http://localhost:3000/display.html
- 后台页：http://localhost:3000/admin.html
- OBS 叠加页：http://localhost:3000/overlay.html

默认端口是 `3000`。可以通过环境变量 `PORT` 修改。

## OBS 配置

在 OBS 中添加“浏览器”来源，并把 URL 设置为固定叠加页；房间在页面里选择，不需要把房间名写进链接：

```text
http://localhost:3000/overlay.html
```

建议启用透明背景，按直播画面需要设置宽高。展示页本身已经按 OBS 透明背景场景设计。

常用页面地址：

- OBS 叠加页：`/overlay.html`
- 4:3 展示页：`/display.html`
- 后台页：`/admin.html`

## 直播伴侣窗口版

如果主播不会用 OBS 网页源，可以使用桌面套壳窗口：

```powershell
npm.cmd run desktop:dev
```

窗口标题是 `DNF赞助系统`，默认加载公网叠加页：

```text
http://47.109.149.111:3000/overlay.html?desktop=1&captureBg=transparent&captureChrome=0
```

直播伴侣里优先添加“游戏进程捕获”，选择 `DNF赞助系统`。窗口默认使用无边框透明悬浮保底模式，标题栏和边框会在窗口获得焦点时显示，窗口失去焦点后自动隐藏；鼠标移到上方标题栏时不会消失。窗口默认不置顶，像普通 Windows 窗口一样显示；按 `F11` 可以临时切换置顶。按 `F6` 可切到 Windows 原生标题栏模式；按 `F9` 切换黑底保底；如果直播伴侣支持抠色，按 `F10` 切换绿幕；按 `F8` 回到透明模式，按 `F5` 刷新。

打包 Windows 便携版：

```powershell
npm.cmd run package:desktop
```

产物在：

```text
dist/DNF赞助系统.exe
dist/desktop/DNF赞助系统-win32-x64/DNF赞助系统.exe
```

发给主播时优先发 `dist/DNF赞助系统.exe` 这个单文件版。主播只需要双击它，程序会自动解压到本机用户目录并启动窗口；下面的 `dist/desktop/...` 是完整文件夹版，主要留给开发调试。

### WebView2 小体积窗口版

如果想发更小的窗口程序，可以打包 WebView2 版：

```powershell
npm.cmd run package:webview2
```

产物在：

```text
dist/DNF赞助系统-WebView2.exe
dist/webview2/DNF赞助系统-WebView2/DNF赞助系统-WebView2.exe
```

WebView2 版保留同一套叠加页功能，默认加载公网 `http://47.109.149.111:3000/overlay.html?desktop=1&captureBg=transparent&captureChrome=0`。为了避免直播伴侣把原生标题栏和边框捕获进去，WebView2 版默认是无边框透明窗口；鼠标悬浮在窗口内时会显示临时标题栏和边框，鼠标离开窗口后自动隐藏。鼠标贴近窗口边缘可以拖拽缩放，鼠标在窗口顶部标题栏区域可以拖动窗口。快捷键仍是 `F5` 刷新、`F6` 临时切换原生标题栏/无边框、`F8` 透明、`F9` 黑底、`F10` 绿幕、`F11` 置顶。直播时建议保持无边框模式，原生标题栏模式主要用于临时调试。它不内置完整浏览器内核，依赖系统 Microsoft Edge WebView2 Runtime；如果主播电脑没装，程序会提示并使用微软在线安装器安装。

## 后台使用

后台地址：

```text
http://localhost:3000/admin.html
```

默认普通权限密码：

```text
add1234
```

默认超级权限密码：

```text
super1234
```

生产环境请务必通过环境变量改掉默认密码。

后台可以完成：

- 选择和管理房间。
- 为每个房间设置普通权限密码。
- 添加赞助记录，设置老板名、金额、节目、备注和头像。
- 控制记录是否计入充能。
- 启动资金充能和开始点将。
- 管理今日榜单显示状态。
- 删除记录，并从回收站恢复。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 服务端口 |
| `DATA_DIR` | `data` | 数据目录 |
| `DATABASE_PATH` | `data/app.sqlite` | SQLite 数据库路径 |
| `DEFAULT_ROOM_SLUG` | `default` | 默认兼容房间 |
| `ADMIN_VIEWER_PASSWORD` | `add1234` | 默认普通权限密码 |
| `ADMIN_SUPER_PASSWORD` | `super1234` | 超级权限密码 |
| `SESSION_SECRET` | `local-session-secret` | 登录会话密钥 |
| `NODE_ENV` | 空 | 设置为 `production` 时使用生产静态文件 |

示例：

```powershell
$env:PORT = "3000"
$env:ADMIN_VIEWER_PASSWORD = "your-viewer-password"
$env:ADMIN_SUPER_PASSWORD = "your-super-password"
$env:SESSION_SECRET = "a-long-random-string"
npm.cmd run dev
```

## 打包部署

生成服务端部署包：

```powershell
npm.cmd run package:server
```

打包产物：

```text
dist/sponsor-overlay-server-package.zip
```

部署包会包含服务端代码、共享代码、生产前端文件、`package.json`、`package-lock.json`、`tsconfig.json` 和空的 `data` 目录。上传到服务器后，在解压目录中执行：

```powershell
npm.cmd ci --omit=dev
```

然后用生产环境变量启动：

```powershell
$env:NODE_ENV = "production"
$env:PORT = "3000"
$env:ADMIN_VIEWER_PASSWORD = "viewer-password"
$env:ADMIN_SUPER_PASSWORD = "admin-password"
$env:SESSION_SECRET = "a-long-random-string"
npm.cmd start
```

更新服务器文件前，请先备份 `data` 目录。

## 数据目录

默认运行时数据在 `data/` 下：

- `data/app.sqlite`：主要 SQLite 数据库。
- `data/avatars/`：老板头像文件，已加入 `.gitignore`。
- `data/speech/`：语音合成文件，已加入 `.gitignore`。
- `data/demo-state.json`：旧版兼容和本地测试数据，不建议作为正式数据提交。

当前仓库中 `data/demo-state.json` 主要用于本地测试。

## 开发命令

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run test
npm.cmd run typecheck
npm.cmd run package:server
npm.cmd run desktop:dev
npm.cmd run package:desktop
```

说明：

- `dev` / `start`：启动本地服务。
- `build`：类型检查并构建前端。
- `test`：运行 Vitest 测试。
- `typecheck`：仅运行 TypeScript 类型检查。
- `package:server`：构建并生成服务端部署压缩包。
- `desktop:dev`：启动直播伴侣窗口版。
- `package:desktop`：生成 Windows 桌面便携版。

## 技术栈

- TypeScript
- Express
- Socket.IO
- Vite
- better-sqlite3
- Vitest
