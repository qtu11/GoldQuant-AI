# GoldQuant AI — Risk Manager Dashboard

**GoldQuant AI** is a professional multi-account risk management dashboard for **XAUUSD / XAUUSDc** traders (prop, fund, multi-MT5).  
It combines portfolio analytics, MT5 history import, economic calendar alerts, Telegram notifications, and LLM-powered advice — built with **Next.js 16**, **React 19**, **TypeScript**, **Tailwind CSS 4**, **Zustand**, and **Firebase Firestore**.

---

## Table of contents

1. [Overview](#overview)
2. [Screenshots](#screenshots)
3. [Features](#features)
4. [Tech stack](#tech-stack)
5. [Architecture](#architecture)
6. [Project structure](#project-structure)
7. [Requirements](#requirements)
8. [Installation](#installation)
9. [Environment variables](#environment-variables)
10. [Running the app](#running-the-app)
11. [Core workflows](#core-workflows)
12. [Money & equity logic](#money--equity-logic)
13. [Economic news & Telegram](#economic-news--telegram)
14. [API routes](#api-routes)
15. [MT5 export guide](#mt5-export-guide)
16. [Design system](#design-system)
17. [Security notes](#security-notes)
18. [Troubleshooting](#troubleshooting)
19. [License](#license)

---

## Overview

| Audience | Use case |
|----------|----------|
| Multi-account gold traders | Monitor many MT5 accounts under one or more owners |
| Prop / risk managers | AI risk score, drawdown, rules, Telegram breaches |
| Operators | Weekly report, calendar alerts 5h before high-impact USD news |

**Product pillars**

- **Portfolio risk** — equity, PnL, PF, WR, max DD, Sharpe, AI risk 0–100  
- **Owner-first model** — create owners → attach MT5 accounts  
- **MT5 import** — CSV / HTML / Excel / TXT → trades + balance moves → auto equity  
- **USC / USD** — cent accounts (100 USC = 1 USD) with dual display + VND  
- **News intelligence** — Forex Factory week feed, 5h + LIVE alerts, dual US/VN time  
- **AI** — advisor chat, bot research (`.set` + daily PnL), capital scaling hints  

---

## Screenshots

### Portfolio / risk overview

Aggregated KPIs: total equity (USD), profit, PF, drawdown, trade count, VaR / Monte Carlo, owner groups, live calendar.

![Risk Dashboard Overview](./src/pic/risk_dashboard_overview_1783782099145.png)

### Account detail

AI risk breakdown, session charts, equity curve, transactions, capital moves, open positions, bot research.

![Account Detail View](./src/pic/account_detail_view_1783782109777.png)

### UI demo

Glassmorphism / neon motion (respects `prefers-reduced-motion` in design tokens).

![UI Demo](./src/pic/dashboard_upgraded_visual_1783782078001.webp)

---

## Features

### Multi-account & owners

- Register **owners**, then create **MT5 accounts** bound to an owner  
- Owners dashboard: equity, cumulative PnL, today PnL, risk, account grid  
- Portfolio filters by owner and period (`All` / `1W` / `1M` / `1Q`)  

### Analytics & risk

- **Stats:** net PnL (profit + commission + swap), WR, ROI, monthly ROI, PF, recovery, max DD, Sharpe  
- **AI Risk Score** (0–100, higher = riskier) with sub-metrics: profitability, stability, risk control, capital efficiency, consistency, recovery  
- **Sessions:** Asia / Europe / US (from open time)  
- **Equity curve** including deposits/withdrawals  
- **Risk rules** (Tools): max DD, risk score, PF, daily loss, equity halved — optional Telegram on **critical** only  
- **Quant fallback:** VaR 95%, Monte Carlo paths (Node engine if no external quant service)  

### MT5 history import

- Formats: **CSV, TSV, HTML, Excel (.xlsx/.xls), TXT** (UTF-8 / UTF-16)  
- Parses **Positions** and **Deals** (LIFO partial closes, in/out)  
- Parses **Balance / Credit** → capital moves  
- Smart merge by fingerprint (no data loss on partial re-upload)  
- After upload:  
  `Equity = initial capital + closed trade PnL + net deposits/withdrawals`  

### Currency

- Account currency: **USD** or **USC** (cent)  
- Portfolio KPIs always aggregated in **USD**  
- Dual labels: e.g. `3,322 USC · ≈ $33.22`  
- Live **USD/VND** rate (multi-source cache, fallback offline)  

### Economic calendar & news alerts

- Full-week feed (Forex Factory public JSON/CSV + disk cache + seed)  
- Dual timezone display: **🇻🇳 Asia/Ho_Chi_Minh (GMT+7)** and **🇺🇸 US Eastern (EST/EDT)**  
- Auto week rollover (`weekKey` = Monday VN) — invalidate cache, fetch new week  
- Major gold-relevant events: NFP, CPI, PPI, PCE, FOMC, claims, ISM, GDP, etc.  
- Telegram + in-app: **≤ 5 hours before** and **LIVE** window  
- Anti-spam: one send per event/phase, API rate limits, content dedup  

### AI

- **AI Advisor** — chat with portfolio context, live gold price, calendar inject  
- Providers: **xAI (Grok)** and/or **Gemini** (`AI_PROVIDER`)  
- **Bot research** (per account): upload EA `.set`, daily PnL series, suggested inputs as editable form (low token UX)  
- **Daily Brief** / capital scaling hints  

### Tools & extras

- Position size calculator (XAU)  
- Prop challenge tracker  
- Rebate calculator  
- Compare accounts, weekly HTML report  
- Auth gate (admin login/password → hashed session token)  

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js **16.2.10** (App Router) |
| UI | React **19.2.4**, TypeScript **5** |
| Styling | Tailwind CSS **4**, custom neon / glass design system |
| State | Zustand **5** |
| Persistence | Firebase Firestore + localStorage backup |
| Charts | Recharts **3.9** |
| Excel | `xlsx` **0.18** |
| Icons | Lucide React |
| Motion | Framer Motion (optional UI polish) |

---

## Architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser UI     │────▶│  Next.js App     │────▶│  Firestore      │
│  Zustand store  │◀────│  API routes      │     │  accounts/owners│
└────────┬────────┘     └────────┬─────────┘     └─────────────────┘
         │                       │
         │              ┌────────┴─────────┐
         │              │ External         │
         │              │ • Forex Factory  │
         │              │ • Gold price APIs│
         │              │ • xAI / Gemini   │
         │              │ • Telegram Bot   │
         │              └──────────────────┘
         │
         ▼
   localStorage (.data/* server cache for calendar & TG rate limits)
```

- **Client:** pages under `src/app/*`, components, Zustand stores  
- **Server:** `src/app/api/**` for auth, Telegram, calendar, AI, gold price, news alerts  
- **Domain logic:** pure utils in `src/utils/*` (analytics, parser, equity, news)  

---

## Project structure

```text
Dashbboard-Gold/
├── .env.example              # Environment template
├── design-system/MASTER.md   # UI tokens (cyberpunk neon / OLED)
├── docs/                     # Research & assets
├── public/                   # Static brand assets
├── src/
│   ├── app/
│   │   ├── page.tsx          # Portfolio overview + account detail
│   │   ├── owners/           # Owner registry & owner PnL dashboard
│   │   ├── news/             # Economic calendar + alert panel
│   │   ├── notifications/    # In-app alerts (risk + news)
│   │   ├── tools/            # Position size, prop, risk rules
│   │   ├── rebate/           # Rebate calculator
│   │   ├── admin/            # Admin view
│   │   └── api/
│   │       ├── auth/         # Login / verify token
│   │       ├── telegram/     # Send message (rate-limited)
│   │       └── quant/
│   │           ├── ai-advisor/
│   │           ├── bot-research/
│   │           ├── calendar/
│   │           ├── gold-price/
│   │           └── news-alerts/
│   ├── components/           # UI (cards, charts, panels, modals)
│   ├── store/
│   │   ├── useTradingStore.ts
│   │   ├── useAuthStore.ts
│   │   └── useToolsStore.ts
│   ├── utils/                # Domain: analytics, fileParser, news, currency…
│   └── data/                 # calendar-seed.json
├── package.json
└── README.md
```

---

## Requirements

- **Node.js** ≥ 18 (recommend 20 LTS)  
- **npm** / yarn / pnpm  
- Firebase project (Firestore) for cloud sync  
- Optional: Telegram bot, xAI and/or Gemini API keys  

---

## Installation

```bash
# Clone
git clone <your-repo-url> Dashbboard-Gold
cd Dashbboard-Gold

# Install
npm install

# Configure environment
cp .env.example .env
# Edit .env with Firebase, Telegram, AI keys (see below)
```

---

## Environment variables

Copy from `.env.example`:

### Admin auth

| Variable | Description |
|----------|-------------|
| `ADMIN_LOGIN` | Dashboard username |
| `ADMIN_PASSWORD` | Dashboard password |

### Firebase (client)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional Analytics |

Firestore collections used: **`accounts`**, **`owners`**.  
Configure security rules appropriately for production.

### Telegram

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_CHAT_ID` | Target chat / channel ID |

### AI (at least one recommended)

| Variable | Description |
|----------|-------------|
| `XAI_API_KEY` | xAI / Grok API key |
| `XAI_MODEL` | Optional model override |
| `GEMINI_API_KEY` | Google AI Studio key |
| `AI_PROVIDER` | `xai` \| `gemini` (default prefers xAI if key set) |

### Optional market data

| Variable | Description |
|----------|-------------|
| `GOLDAPI_IO_KEY` | Gold price provider |
| `METALPRICE_API_KEY` | Alternate metals API |

---

## Running the app

```bash
# Development (Turbopack)
npm run dev
# → http://localhost:3000

# Production
npm run build
npm start

# Lint
npm run lint
```

Log in with `ADMIN_LOGIN` / `ADMIN_PASSWORD`.

---

## Core workflows

### 1. Owner → MT5 account

1. Open **Owners** → create owner  
2. **Add MT5** — set ID, broker, server, symbol, type, currency (USD/USC), initial capital, leverage  
3. Cent accounts: **100 USC = 1 USD** (e.g. 2,000 USC = **$20**)  

### 2. Import history

1. Export MT5 **History → Report** (HTML or Excel preferred)  
2. Account detail → **Upload History** (or compact uploader)  
3. System merges trades + Balance/Credit lines  
4. Equity and stats recompute automatically  

### 3. Capital & open positions

- **Update Capital** — reconcile equity via synthetic capital moves  
- **Capital** tab — manual deposit/withdraw  
- **Open Positions** — manual floating PnL (XAU contract model)  

### 4. Bot research (per account)

1. Tab **Nghiên cứu bot**  
2. Upload EA `.set` + optional daily PnL series  
3. **AI phân tích** → risk + suggested params as form fields  
4. **Áp dụng gợi ý** → **Xuất .set** for MT5  

### 5. News & alerts

1. Page **News** or Home calendar panel  
2. While logged in, background poll runs news-alerts  
3. Telegram + Notifications for high-impact gold events (≤5h + LIVE)  

---

## Money & equity logic

```text
Closed equity = initialCapital
              + Σ (profit + commission + swap) over closed trades
              + Σ deposits − Σ withdrawals
```

| Concept | Notes |
|---------|--------|
| **USC** | Cent account currency; portfolio totals still shown in USD |
| **Upload merge** | Ticket + close fingerprint; partial closes preserved |
| **Period 1W/1M** | Wall-clock window (shared across accounts); demo fallback if history is old |
| **Today PnL** | Close-day key from trade string; “today” = Asia/Ho_Chi_Minh |

**Example (cent):** 8 accounts × 2,000 USC = 16,000 USC = **$160** initial.  
With cumulative profits → total equity **~$280** is correct — not $16,000.

---

## Economic news & Telegram

| Mechanism | Behavior |
|-----------|----------|
| Source | Forex Factory week JSON/CSV + cache + offline seed |
| Week key | Monday (VN) `YYYY-MM-DD`; new week → invalidate cache |
| Times | Event absolute UTC; UI shows VN + US Eastern |
| Pre-alert | Remaining time ≤ 5h and > 30m (one shot per event) |
| LIVE | −15m … +25m around release |
| Anti-spam | Per-event TG mark even on failure; API ≥40s gap; content dedup 10m; risk TG critical-only 1×/day/rule |

**Optional cron** (if the browser is closed):

```bash
curl -X POST http://localhost:3000/api/quant/news-alerts
```

Server cache files under `.data/` (gitignored): calendar cache, news-alerts dedup, Telegram rate files.

---

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth` | `login` / `verify` |
| `POST` | `/api/telegram` | Send HTML message (rate-limited) |
| `GET` | `/api/quant/calendar` | Full-week calendar (`force=1`, filters) |
| `GET/POST` | `/api/quant/news-alerts` | Check/send news alerts (`dry=1` preview) |
| `GET` | `/api/quant/gold-price` | Live XAU quote |
| `POST` | `/api/quant/ai-advisor` | Chat advisor |
| `POST` | `/api/quant/bot-research` | Structured bot param suggestions |

---

## MT5 export guide

1. Open **MetaTrader 5**  
2. **Toolbox → History**  
3. Right-click → **Report** → **HTML** or **Open XML (Excel)**  
4. Prefer a **full period** report (Positions table is best)  
5. Drag & drop into GoldQuant **Upload History**  

**Tips**

- Positions table: open/close time & prices preferred  
- Deals table: LIFO matching + Balance/Credit → capital moves  
- Re-upload merges; does not wipe unrelated tickets  

---

## Design system

- Source of truth: `design-system/MASTER.md`  
- Style: **Cyberpunk Neon + OLED Dark**, high motion density  
- Skills: UI/UX Pro Max under `.agents/skills/`  
- Respect **`prefers-reduced-motion`**  

---

## Security notes

- Change default admin credentials in production  
- Never commit `.env`  
- Restrict Firestore rules (authenticated or locked-down write paths)  
- Telegram route is unauthenticated by design for local ops — protect with network / reverse proxy in production  
- API keys for AI and gold price stay server-side only (no `NEXT_PUBLIC_` prefix)  

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Login fails | `ADMIN_LOGIN` / `ADMIN_PASSWORD`; restart after `.env` change |
| Empty accounts | Firebase config + Firestore rules; check browser console / localStorage fallback |
| Equity “too small” on cent | 100 USC = $1; 2,000 USC = $20 — confirm MT5 balance units |
| Upload 0 trades | Use full History report; Positions sheet; not only open orders |
| Telegram spam (legacy) | Restart server; dedup files in `.data/`; update to latest anti-spam build |
| Calendar stale | News refresh / `force=1`; Monday week rollover; FF 429 → wait or seed |
| AI empty / 429 | Set `XAI_API_KEY` and/or `GEMINI_API_KEY`; chain falls back to rule engine |

---

## Scripts reference

```bash
npm run dev      # Local development
npm run build    # Production build
npm start        # Serve production build
npm run lint     # ESLint
```

---

## License

Private / proprietary unless otherwise stated by the repository owner.  
Not financial advice. Trading XAU involves substantial risk of loss.

---

## Credits

- **Product:** GoldQuant AI Risk Manager  
- **Stack:** Next.js · React · Tailwind · Zustand · Firebase · Recharts  
- **Calendar data:** Forex Factory public weekly feed (third-party; subject to rate limits)  
- **Design:** OLED neon / liquid glass dashboard system  

---

**GoldQuant AI** — multi-account XAU risk, import, news, and AI in one dashboard.
