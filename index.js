// index.js
import "dotenv/config";
import express from "express";
import cors    from "cors";

import { startScheduler, scanAll, runScan, ROUTES, PRICE_THRESHOLD } from "./scheduler.js";
import { getHistory, scanHistory } from "./store.js";

const app  = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

// Optional API key protection
function auth(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) return next();
  if (req.headers.authorization === `Bearer ${secret}`) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({
    status:    "ok",
    service:   "skanner-backend",
    uptime:    process.uptime(),
    routes:    ROUTES.map(r => `${r.origin}→${r.dest}`),
    threshold: `$${PRICE_THRESHOLD}`,
    schedule:  "6:00 AM and 6:00 PM (America/Mexico_City)",
  });
});

// ── Routes summary ────────────────────────────────────────────────────────────

app.get("/routes", auth, (_req, res) => {
  const summary = ROUTES.map(r => {
    const history = getHistory(r.id, 999);
    const allPrices = history.flatMap(h => h.flights?.map(f => f.price) ?? []).filter(Boolean);
    return {
      ...r,
      scansRecorded: history.length,
      allTimeLow:    allPrices.length ? Math.min(...allPrices) : null,
      lastScanned:   history[0]?.scannedAt ?? null,
      lastLowest:    history[0]?.lowest ?? null,
    };
  });
  res.json(summary);
});

// ── History per route ─────────────────────────────────────────────────────────

app.get("/routes/:id/history", auth, (req, res) => {
  const route = ROUTES.find(r => r.id === req.params.id);
  if (!route) return res.status(404).json({ error: "Route not found" });
  const limit = parseInt(req.query.limit ?? "56", 10);
  res.json(getHistory(req.params.id, limit));
});

// ── Best deals across all routes ──────────────────────────────────────────────

app.get("/deals", auth, (_req, res) => {
  const deals = [];
  for (const route of ROUTES) {
    const history = getHistory(route.id, 999);
    for (const record of history) {
      if (record.lowest && record.lowest < PRICE_THRESHOLD) {
        deals.push({
          route:     `${route.origin}→${route.dest}`,
          date:      record.date,
          lowest:    record.lowest,
          scannedAt: record.scannedAt,
          flights:   record.flights?.slice(0, 3) ?? [],
        });
      }
    }
  }
  deals.sort((a, b) => a.lowest - b.lowest);
  res.json(deals);
});

// ── Telegram test ─────────────────────────────────────────────────────────────

app.post("/test-telegram", auth, async (_req, res) => {
  try {
    const { sendTelegramMessage } = await import("./telegram.js");
    await sendTelegramMessage(
      "✅ Skanner test successful!\nYour Telegram alerts are working correctly.\n\nYou'll receive deal notifications here when flights drop below $150."
    );
    res.json({ ok: true, message: "Test message sent to Telegram!" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Manual triggers ───────────────────────────────────────────────────────────

// Trigger full scan of all routes × all dates now
app.post("/scan-all", auth, (_req, res) => {
  res.json({ message: "Full scan started in background", routes: ROUTES.length });
  scanAll().catch(err => console.error("[api] scan-all error:", err));
});

// Trigger scan for one specific route + date
// POST /scan { "routeId": "cjs-cun", "date": "2026-11-15" }
app.post("/scan", auth, async (req, res) => {
  const { routeId, date } = req.body;
  const route = ROUTES.find(r => r.id === routeId);
  if (!route) return res.status(400).json({ error: `Unknown route. Valid IDs: ${ROUTES.map(r => r.id).join(", ")}` });
  if (!date)  return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
  try {
    const record = await runScan(route, date);
    res.json(record ?? { error: "No results returned" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✈  Skanner backend running on port ${PORT}`);
  console.log(`   SERPAPI_KEY  : ${process.env.SERPAPI_KEY  ? "✓ set" : "✗ MISSING"}`);
  console.log(`   SMTP_USER    : ${process.env.SMTP_USER    ? "✓ set" : "✗ not set"}`);
  console.log(`   ALERT_EMAIL  : ${process.env.ALERT_EMAIL  ? "✓ set" : "✗ not set — no emails will be sent"}`);
  console.log(`   API_SECRET   : ${process.env.API_SECRET   ? "✓ set" : "open"}`);
  console.log(`   TZ           : ${process.env.TZ           ?? "not set (defaulting to UTC)"}\n`);
  startScheduler();
});