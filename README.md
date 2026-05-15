<div align="center">
<img src="docs/logo.gif" width="160" height="160" alt="瞾 — Shuo Zhao" style="border-radius:50%;"/>


# InsDowload

A lightweight Edge/Chrome extension to download Instagram photos, videos, Reels, and Stories — no limits, no external servers, no login required beyond your existing Instagram session.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)

[English](#english) | [中文](#中文)

---

<a id="english"></a>

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## English

### Features

| Feature | Status |
|---------|--------|
| Single post download (photo/video) | ✅ |
| Carousel posts (all slides) | ✅ |
| Reels download | ✅ |
| Batch download entire profile | ✅ |
| Download by type (Posts / Reels / Tagged) | ✅ |
| Custom filename format | ✅ |
| Per-user subfolder organization | ✅ |
| No download limits | ✅ |
| No external server dependency | ✅ |

### Installation

1. Download or clone this repository
2. Open `edge://extensions` (Edge) or `chrome://extensions` (Chrome)
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select this folder
5. The InsDowload icon appears in your toolbar

### Usage

#### Single Post Download

1. Navigate to any Instagram post (`/p/XXX/`) or Reel (`/reel/XXX/`)
2. A floating download button appears at the bottom-right corner
3. Click to download all media in the post (including all carousel slides)

#### Feed Download

- Download buttons are injected next to each post in your feed
- Click the button on any post to download its media

#### Batch Profile Download

1. Click the extension icon to open the popup
2. Enter a username (auto-filled when on a profile page)
3. Select type: **Posts**, **Reels**, or **Tagged**
4. Click **Start Download**
5. Progress bar shows download status

#### Popup Quick Download

When viewing a single post page, the popup shows a **"Download Current Post"** button at the top for one-click download.

### Settings

In the popup's Settings tab:

| Setting | Description |
|---------|-------------|
| Save Folder | Relative to browser download directory (e.g., `Instagram`) |
| Create subfolder per user | Organizes files into `Instagram/username/` |
| Concurrent Downloads | 1-5 simultaneous downloads for batch mode |

> **Note**: `chrome.downloads.download` only supports relative paths. Set your browser's default download location to your preferred root (e.g., `D:\ADownload`), then use relative folder names in the extension.

### Filename Format

Default naming rule:

```
{post_title}_{original_filename}_{date}_{author}.{ext}
```

If no title is available, falls back to:

```
{original_filename}_{date}_{author}.{ext}
```

- Title: First 50 characters of the post caption
- Original filename: Extracted from Instagram CDN URL
- Date: Post publish date (YYYY-MM-DD)
- Author: Instagram username

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Read session from cookies                                │
│    csrftoken → API authentication                           │
│    ds_user_id → current user identification                 │
├─────────────────────────────────────────────────────────────┤
│ 2. Extract post shortcode from URL/DOM                      │
│    /p/ABC123/ → shortcode "ABC123"                          │
│    shortcode → numeric media ID (base64 decode)             │
├─────────────────────────────────────────────────────────────┤
│ 3. Fetch media info via Instagram API                       │
│    Primary: /api/v1/media/{id}/info/                        │
│    Fallback: GraphQL query_hash by shortcode                │
├─────────────────────────────────────────────────────────────┤
│ 4. Extract highest quality URLs                             │
│    Videos: video_versions[0].url                            │
│    Images: image_versions2.candidates[0].url                │
│    Carousel: carousel_media[].video_versions/image_versions │
├─────────────────────────────────────────────────────────────┤
│ 5. Download via chrome.downloads.download                   │
│    Files saved to configured folder with formatted name     │
└─────────────────────────────────────────────────────────────┘
```

#### Batch Download Flow

For profile batch downloads, the extension uses Instagram's Relay API:

1. Captures `docId` from Instagram's own Relay requests (via `injected.js` fetch interception)
2. Constructs paginated POST requests to `/graphql/query` with `fb_dtsg` + `doc_id`
3. Iterates through all pages until `has_next_page = false`
4. Falls back to legacy GraphQL `query_hash` if Relay fails

### File Structure

```
InsDowload/
├── manifest.json      # MV3 extension manifest
├── background.js      # Service worker: API calls, download queue, batch logic
├── content.js         # Content script: button injection, shortcode extraction
├── content.css        # Download button styles (feed + floating)
├── injected.js        # Page-context script: extract fb_dtsg, intercept fetch for docIds
├── popup.html         # Popup UI: batch download + settings
├── popup.js           # Popup logic: current post download, batch control
├── popup.css          # Popup styles
├── icons/             # Extension icons (16/48/128px)
├── README.md
├── LICENSE
└── .gitignore
```

### Permissions Explained

| Permission | Why |
|-----------|-----|
| `downloads` | Save media files to disk |
| `cookies` | Read Instagram session tokens (csrftoken, ds_user_id) |
| `storage` | Persist user settings |

### Troubleshooting

| Problem | Solution |
|---------|----------|
| No download button on post page | Refresh the page after installing the extension |
| API returns 401/403 | Make sure you're logged into Instagram |
| Only 2 images download from carousel | API may have changed — check Service Worker console for errors |
| Batch download stops | Instagram rate limiting — wait a few minutes and retry |
| "No media found" error | The post may be from a private account you don't follow |

### Legal and Responsible Use

This project is provided for educational and technical research purposes only. It must not be used for commercial activities, copyright infringement, unauthorized redistribution, piracy, or downloading resources without permission from the rights holder. Users are responsible for complying with Instagram's terms of service, applicable laws, and the rights of content creators.

### Limitations

- Requires an active Instagram login session
- Instagram rate-limits API requests — batch downloads include delays
- Private accounts' content is only accessible if you follow them
- Instagram frequently changes internal APIs — updates may be needed
- `chrome.downloads` cannot specify absolute paths (use browser download settings)

### License

MIT — see [LICENSE](LICENSE)

---

<a id="中文"></a>

## 中文

一个轻量级的 Edge/Chrome 浏览器扩展，无限制下载 Instagram 的照片、视频、Reels 和 Stories。无需外部服务器，无需额外登录，使用你现有的 Instagram 会话即可。

### 功能

| 功能 | 状态 |
|------|------|
| 单帖下载（照片/视频） | ✅ |
| 轮播帖（所有图片/视频） | ✅ |
| Reels 下载 | ✅ |
| 批量下载整个用户主页 | ✅ |
| 按类型下载（帖子/Reels/被标记） | ✅ |
| 自定义文件命名格式 | ✅ |
| 按用户名建子文件夹 | ✅ |
| 无下载数量限制 | ✅ |
| 无外部服务器依赖 | ✅ |

### 安装

1. 下载或克隆本仓库
2. 打开 `edge://extensions`（Edge）或 `chrome://extensions`（Chrome）
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择本文件夹
5. 工具栏出现 InsDowload 图标

### 使用方法

#### 单帖下载

1. 打开任意 Instagram 帖子页面（`/p/XXX/`）或 Reel（`/reel/XXX/`）
2. 右下角出现浮动下载按钮
3. 点击即可下载帖子中的所有媒体（包括轮播的所有图片）

#### 信息流下载

- 浏览 Feed 时，每个帖子旁会注入下载按钮
- 点击按钮即可下载该帖子的媒体

#### 批量下载用户主页

1. 点击扩展图标打开弹窗
2. 输入用户名（在用户主页时会自动填充）
3. 选择类型：**Posts**（帖子）、**Reels**、**Tagged**（被标记）
4. 点击 **Start Download**
5. 进度条显示下载状态

#### 弹窗快速下载

在单帖页面时，弹窗顶部会显示 **"Download Current Post"** 按钮，一键下载当前帖子。

### 设置

在弹窗的 Settings 标签页中：

| 设置项 | 说明 |
|--------|------|
| Save Folder | 保存文件夹（相对于浏览器下载目录，如 `Instagram`） |
| Create subfolder per user | 按用户名建子文件夹（`Instagram/用户名/`） |
| Concurrent Downloads | 批量下载时的并发数（1-5） |

> **注意**：`chrome.downloads.download` 只支持相对路径。请在浏览器设置中将默认下载位置设为你想要的根目录（如 `D:\ADownload`），然后在扩展中使用相对文件夹名。

### 文件命名规则

默认命名格式：

```
{帖子标题}_{原始文件名}_{日期}_{作者}.{扩展名}
```

如果没有标题，降级为：

```
{原始文件名}_{日期}_{作者}.{扩展名}
```

- 标题：帖子描述的前 50 个字符
- 原始文件名：从 Instagram CDN URL 中提取
- 日期：发布日期（YYYY-MM-DD）
- 作者：Instagram 用户名

### 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 从 Cookie 读取会话信息                                     │
│    csrftoken → API 认证                                      │
│    ds_user_id → 当前用户标识                                  │
├─────────────────────────────────────────────────────────────┤
│ 2. 从 URL/DOM 提取帖子 shortcode                              │
│    /p/ABC123/ → shortcode "ABC123"                           │
│    shortcode → 数字 media ID（base64 解码）                   │
├─────────────────────────────────────────────────────────────┤
│ 3. 通过 Instagram API 获取媒体信息                             │
│    主要：/api/v1/media/{id}/info/                             │
│    备用：GraphQL query_hash 按 shortcode 查询                 │
├─────────────────────────────────────────────────────────────┤
│ 4. 提取最高画质 URL                                           │
│    视频：video_versions[0].url                                │
│    图片：image_versions2.candidates[0].url                    │
│    轮播：carousel_media[].video_versions/image_versions       │
├─────────────────────────────────────────────────────────────┤
│ 5. 通过 chrome.downloads.download 下载                        │
│    文件保存到配置的文件夹，使用格式化的文件名                     │
└─────────────────────────────────────────────────────────────┘
```

#### 批量下载流程

批量下载使用 Instagram 的 Relay API：

1. 通过 `injected.js` 拦截 Instagram 的 Relay 请求，捕获 `docId`
2. 构造分页 POST 请求到 `/graphql/query`（使用 `fb_dtsg` + `doc_id`）
3. 循环翻页直到 `has_next_page = false`
4. 如果 Relay 失败，降级到传统 GraphQL `query_hash` 方式

### 文件结构

```
InsDowload/
├── manifest.json      # MV3 扩展清单
├── background.js      # Service Worker：API 调用、下载队列、批量逻辑
├── content.js         # 内容脚本：按钮注入、shortcode 提取
├── content.css        # 下载按钮样式（Feed + 浮动按钮）
├── injected.js        # 页面上下文脚本：提取 fb_dtsg、拦截 fetch 获取 docId
├── popup.html         # 弹窗界面：批量下载 + 设置
├── popup.js           # 弹窗逻辑：当前帖子下载、批量控制
├── popup.css          # 弹窗样式
├── icons/             # 扩展图标（16/48/128px）
├── README.md
├── LICENSE
└── .gitignore
```

### 权限说明

| 权限 | 用途 |
|------|------|
| `downloads` | 保存媒体文件到磁盘 |
| `cookies` | 读取 Instagram 会话令牌（csrftoken、ds_user_id） |
| `storage` | 保存用户设置 |

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| 帖子页面没有下载按钮 | 安装扩展后刷新页面 |
| API 返回 401/403 | 确保已登录 Instagram |
| 轮播帖只下载了 2 张 | API 可能已变更，检查 Service Worker 控制台错误 |
| 批量下载中途停止 | Instagram 限流，等几分钟后重试 |
| 提示"No media found" | 帖子可能来自你未关注的私密账号 |

### 合规使用声明

本项目仅用于教学、学习和技术研究用途。不得用于任何商业活动，不得用于侵犯版权、未经授权的传播、盗版资源获取，或在未获得权利人许可的情况下下载和分发内容。使用者应自行遵守 Instagram 服务条款、所在地法律法规以及内容创作者的合法权益。

### 限制

- 需要已登录的 Instagram 会话
- Instagram 会限制 API 请求频率，批量下载包含延迟
- 私密账号的内容只有在你关注时才能访问
- Instagram 经常更改内部 API，可能需要更新
- `chrome.downloads` 不能指定绝对路径（请使用浏览器下载设置）

### 许可证

MIT — 见 [LICENSE](LICENSE)
