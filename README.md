# ✈ Skanner — Backend Setup Guide

## What this does
- Scans Google Flights via SerpApi at **6 AM, 12 PM, 6 PM, and 12 AM** every day
- Stores price history per route (in memory; swap for Postgres for persistence)
- Sends **email alerts** via Gmail when deals are found
- Exposes a **REST API** consumed by the React frontend

---

## 1. Get a SerpApi key
1. Sign up at https://serpapi.com (free: 100 searches/month)
2. Copy your API key from the dashboard

---

## 2. Set up Gmail App Password (for email alerts)
1. Go to https://myaccount.google.com/apppasswords
2. Create a new App Password (select "Mail" + "Other")
3. Copy the 16-character password

---

## 3. Deploy to Railway

### Option A — From GitHub (recommended)
```bash
# Push this folder to a GitHub repo, then:
# 1. Go to railway.app → New Project → Deploy from GitHub
# 2. Select your repo
# 3. Railway auto-detects Node.js via nixpacks
```

### Option B — Railway CLI
```bash
npm install -g @railway/cli
railway login
railway init          # creates a new project
railway up            # deploys
```

---

## 4. Set environment variables on Railway

In your Railway project → Variables tab, add:

| Variable        | Value                            |
|-----------------|----------------------------------|
| `SERPAPI_KEY`   | your SerpApi key                 |
| `SMTP_USER`     | your Gmail address               |
| `SMTP_PASS`     | your Gmail App Password          |
| `API_SECRET`    | any random string (optional)     |
| `TZ`            | e.g. `America/Mexico_City`       |

> **TZ is important!** Without it, cron runs in UTC.  
> Set it to your local timezone so scans fire at 6 AM *your* time.

---

## 5. Wire the frontend

In your React app, set two environment variables:

```
VITE_API_BASE=https://your-app.up.railway.app
VITE_API_SECRET=same_value_as_API_SECRET_above
```

Then use `flight-scanner-connected.jsx` as your component.

---

## API Reference

| Method | Endpoint                  | Description                      |
|--------|---------------------------|----------------------------------|
| GET    | `/`                       | Health check                     |
| GET    | `/routes`                 | List all tracked routes          |
| POST   | `/routes`                 | Add a new route                  |
| PATCH  | `/routes/:id`             | Update a route                   |
| DELETE | `/routes/:id`             | Remove a route                   |
| POST   | `/routes/:id/scan`        | Trigger immediate scan           |
| GET    | `/routes/:id/history`     | Get price history                |
| POST   | `/scan-all`               | Scan all active routes now       |

### Example: Add a route
```bash
curl -X POST https://your-app.up.railway.app/routes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_secret" \
  -d '{
    "origin": "MEX",
    "dest": "LAX",
    "date": "2026-11-15",
    "alertEmail": "you@gmail.com",
    "priceThreshold": 200
  }'
```

---

## Scan schedule (cron)

The backend schedules 4 cron jobs:

| Window | Cron expression |
|--------|-----------------|
| 6 AM   | `0 6 * * *`     |
| 12 PM  | `0 12 * * *`    |
| 6 PM   | `0 18 * * *`    |
| 12 AM  | `0 0 * * *`     |

All times use the `TZ` env var. Set it to avoid UTC confusion.

---

## Notes on SerpApi quota
- Free tier: **100 searches/month**
- 4 scans/day × 30 days = **120 scans/month** per route
- For multiple routes or higher frequency, upgrade SerpApi or use their `$50/mo` plan (5,000 searches)

---

## Persisting data across deploys
The current store is **in-memory** — it resets on redeploy.  
You already have Supabase set up from RunUp! To persist data:
1. Create a `routes` table and `scan_history` table in Supabase
2. Replace the Map operations in `src/store.js` with Supabase client calls
3. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Railway env vars
