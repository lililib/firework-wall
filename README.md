<div align="center">

# 🎆 Firework Wall · 烟花寄语墙

**实时全网投屏的寄语烟花墙 · 输入文字 · 绽放烟花 · 与所有在线访客同框**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github)](https://lililib.github.io/firework-wall/)
[![No Backend](https://img.shields.io/badge/Backend-None-blueviolet)](#-架构)

[🌐 在线体验](https://lililib.github.io/firework-wall/) · [📖 部署指南](#-部署到自己的-github-pages) · [💡 设计文档](#-架构)

</div>

---

## ✨ 特性

- 🎆 **文字烟花** — 输入文字，浏览器实时绽放成同形烟花（Canvas2D 像素粒子提取算法）
- 🌐 **全网投屏** — 任何在线访客发的烟花，所有人**实时**同步看到
- 🔐 **GitHub OAuth 一键登录** — 无密码、无注册、无验证码
- 💾 **登录即持久化** — 输入即保存，输入即广播，**真无感**
- 🔁 **历史回放** — 重放所有人的烟花 / 仅重放自己发过的
- 📜 **留言墙** — 抽屉式查看完整寄语列表
- 👥 **在线人数实时统计** — 谁在线一目了然
- 🚫 **完全无后端** — 零自建服务器、零运维、零账单（Supabase 免费额度内）

---

## 🌟 演示

> 在线体验：**https://lililib.github.io/firework-wall/**

![Demo GIF placeholder](https://via.placeholder.com/800x450.png?text=Demo+GIF+%E5%BE%85%E6%9B%BF%E6%8D%A2)

> *演示 GIF 待录制 — 欢迎 PR 替换*

---

## 🏗️ 架构

```
┌──────────────────────────────────────────────────────────┐
│  浏览器（GitHub Pages 静态托管）                          │
│                                                          │
│  Vanilla JS · Canvas2D · ES Modules · No Build           │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase 一站式（一个账号搞定所有后端能力）              │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ Auth       │  │ PostgreSQL │  │ Realtime           │ │
│  │ GitHub     │  │ + RLS      │  │ Postgres Changes   │ │
│  │ OAuth      │  │ 安全策略   │  │ + Presence         │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

| 能力 | 由谁提供 | 实现细节 |
|------|---------|---------|
| 用户登录 | Supabase Auth | GitHub OAuth Provider，弹窗一键登录 |
| 数据持久化 | Supabase Postgres | 单表 `fireworks` + 6 行 RLS 策略 |
| 实时广播 | Supabase Realtime | `postgres_changes` 监听 INSERT 事件 |
| 在线人数 | Supabase Presence | 频道成员自动统计 |
| 未登录广播 | Supabase Broadcast | 临时 Pub/Sub，不入库 |
| 安全防护 | RLS + CHECK 约束 | 用户只能写自己数据，数据库层强制 |

**核心代码量**：< 1000 行（含注释和样式）

---

## 🚀 一键部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Flililib%2Ffirework-wall)

> 部署后还需要配置 Supabase（详见下方"自部署完整指南"）

---

## 📖 部署到自己的 GitHub Pages

### 1️⃣ Fork 本仓库

点击右上角 **Fork** 按钮 → 复制到你的账号下

### 2️⃣ 创建 Supabase 项目（5 分钟）

1. 访问 [supabase.com](https://supabase.com) → Sign up（推荐用 GitHub 登录）
2. 点 **New Project**：
   - Name：随意（如 `firework-wall`）
   - Region：选离用户最近的（亚洲选 Singapore）
   - 等 ~2 分钟项目就绪
3. 进入项目 → 左侧 **Project Settings** → **API**
   - 复制 `Project URL`
   - 复制 `Publishable key`（不是 secret key！）

### 3️⃣ 创建 GitHub OAuth App（5 分钟）

1. 访问 [github.com/settings/applications/new](https://github.com/settings/applications/new)
2. 填写：
   - **Application name**：随意
   - **Homepage URL**：`https://你的用户名.github.io/firework-wall/`
   - **Authorization callback URL**：`https://你的项目ref.supabase.co/auth/v1/callback`
3. 创建后复制 **Client ID** + 生成 **Client Secret**

### 4️⃣ 在 Supabase 启用 GitHub OAuth

Supabase → **Authentication** → **Providers** → **GitHub** → 启用 → 填入上一步的 Client ID + Secret → Save

### 5️⃣ 执行建表 SQL

Supabase → **SQL Editor** → 粘贴 [`supabase-schema.sql`](./supabase-schema.sql) 全部内容 → 点 Run

### 6️⃣ 填入凭据

打开 `supabase-client.js`，替换两行：

```js
export const SUPABASE_URL = '<YOUR_SUPABASE_PROJECT_URL>';
export const SUPABASE_ANON_KEY = '<YOUR_PUBLISHABLE_KEY>';
```

> ⚠️ **注意**：填的是 **Publishable key**（前端公开安全），**不是** Secret key！

### 7️⃣ 部署 GitHub Pages

仓库 **Settings** → **Pages** → **Source: Deploy from a branch** → **Branch: main / Folder: / (root)** → Save

等 1-2 分钟 → 访问 `https://你的用户名.github.io/firework-wall/`

---

## 🛠️ 本地开发

无需任何构建工具，纯 ES Modules：

```bash
git clone https://github.com/lililib/firework-wall.git
cd firework-wall

# 任选一种本地服务器
python3 -m http.server 8080
# 或
npx serve .
# 或
npx http-server .
```

访问 `http://localhost:8080`

> ⚠️ 不能直接 `open index.html`（`file://` 协议不支持 ES Modules import）

---

## 📂 项目结构

```
firework-wall/
├── index.html              # 入口 HTML
├── style.css               # 全部样式
├── supabase-client.js      # ⚠️ 配置区（填你的 Supabase 凭据）
├── auth.js                 # 登录态管理
├── realtime.js             # 实时通信（订阅 + Presence）
├── firework-engine.js      # 烟花动画引擎（Canvas2D + 文字粒子提取）
├── replay.js               # 历史回放 + 留言墙数据获取
├── main.js                 # 主入口（编排所有模块）
├── supabase-schema.sql     # 数据库 schema（fork 后一次性执行）
├── LICENSE                 # MIT
└── README.md               # 本文档
```

---

## 🔬 技术亮点

### 1. 文字粒子提取算法
利用离屏 Canvas 绘制文字 → 像素采样（每 4px 取一个 alpha > 128 的点）→ 作为粒子目标坐标。粒子从爆炸中心运动到目标，**形成与文字同形的烟花**。

### 2. 三阶段粒子状态机
`explode` → `form` → `fade` —— 粒子先随机爆开，再聚合成文字，最后飘落消散。每阶段独立的物理模拟（摩擦、重力、随机扰动）。

### 3. 双通道架构
- **登录用户**：写库 → Realtime 自动广播（持久化）
- **未登录用户**：临时 Broadcast（不入库，仅同时在线可见）
- 实现"鼓励登录但不强制"的友好 UX

### 4. RLS 安全策略
前端用 publishable key 直连数据库，安全完全由数据库 RLS 兜底：
- 任何人可读
- 仅登录用户可写，且 `user_id` 必须等于 `auth.uid()`（防止冒充）
- CHECK 约束限制消息长度（10 字符）

### 5. 自循环防御
Realtime 的 `postgres_changes` 会回声给发送者自己，通过 `payload.user_id === currentUser.id` 判断跳过，避免双倍渲染。

---

## 🎯 适用场景

- 婚礼现场互动大屏 · 跨年活动 · 演唱会应援
- 节日主题站点（春节/七夕/520/告白墙）
- 公司年会互动 · 活动留言墙
- 个人博客互动小组件
- 学习 Supabase 全栈实时通信的最佳实践案例

---

## 🤝 贡献

欢迎 PR / Issue / Star ⭐

待办（欢迎认领）：
- [ ] Google / Apple OAuth Provider
- [ ] 烟花特效更多形态（心形、爱心爆炸）
- [ ] 国际化（i18n）— 英文 README + UI
- [ ] 演示 GIF / 截图
- [ ] PWA 支持（离线访问历史）
- [ ] 暗黑模式开关

---

## 📜 License

MIT © 2026 [lililib](https://github.com/lililib)

---

<div align="center">

**喜欢这个项目？给个 ⭐ Star 鼓励一下！**

</div>
