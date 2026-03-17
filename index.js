// src/index.js
// Express server — REST API consumed by the React frontend

import "dotenv/config";
import express   from "express";
import cors      from "cors";
import crypto    from "crypto";

import { startScheduler, runScan } from "./scheduler.js";
import {
  routes,
  addRoute,
  updateRoute,
  deleteRoute,
  getHistory,
  allActiveRoutes,
} from "./store.js";

const app  = express();
const PORT = process.env.PORT ?? 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Optional lightweight API key check
// Set API_SECRET in your Railway env vars and pass it as
// Authorization: Bearer <secret>  from the frontend.
function auth(req, res, next) {
  const secret = process.env.API_SECRET;
  if (!secret) return next(); // no secret set → open
  const header = req.headers.authorization ?? "";
  if (header === `Bearer ${secret}`) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "skanner-backend", uptime: process.uptime() });
});

// ── Routes CRUD ───────────────────────────────────────────────────────────────

// GET /routes — list all tracked routes
app.get("/routes", auth, (_req, res) => {
  res.json([...routes.values()]);
});

// POST /routes — add a new route to track
// Body: { origin, dest, date, returnDate?, tripType?, alertEmail?, priceThreshold? }
app.post("/routes", auth, (req, res) => {
  const { origin, dest, date, returnDate, tripType, alertEmail, priceThreshold } = req.body;

  if (!origin || !dest || !date) {
    return res.status(400).json({ error: "origin, dest, and date are required" });
  }

  const route = {
    id:             crypto.randomUUID(),
    origin:         origin.toUpperCase(),
    dest:           dest.toUpperCase(),
    date,
    returnDate:     returnDate ?? null,
    tripType:       tripType ?? "one-way",
    alertEmail:     alertEmail ?? null,
    priceThreshold: priceThreshold ? Number(priceThreshold) : null,
    active:         true,
    createdAt:      new Date().toISOString(),
  };

  addRoute(route);
  console.log(`[api] Route added: ${route.origin}→${route.dest} ${route.date}`);
  res.status(201).json(route);
});

// PATCH /routes/:id — update alert settings, toggle active, etc.
app.patch("/routes/:id", auth, (req, res) => {
  const updated = updateRoute(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Route not found" });
  res.json(updated);
});

// DELETE /routes/:id
app.delete("/routes/:id", auth, (req, res) => {
  if (!routes.has(req.params.id)) return res.status(404).json({ error: "Route not found" });
  deleteRoute(req.params.id);
  res.json({ deleted: true });
});

// ── Scan endpoints ────────────────────────────────────────────────────────────

// POST /routes/:id/scan — trigger an immediate manual scan for one route
app.post("/routes/:id/scan", auth, async (req, res) => {
  const route = routes.get(req.params.id);
  if (!route) return res.status(404).json({ error: "Route not found" });

  try {
    const record = await runScan(route);
    res.json(record ?? { error: "Scan returned no results" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /scan-all — trigger manual scan for every active route
app.post("/scan-all", auth, async (_req, res) => {
  const active = allActiveRoutes();
  res.json({ message: `Scanning ${active.length} route(s)…`, count: active.length });
  // Run in background
  for (const route of active) {
    runScan(route).catch(err => console.error("[api] scan-all error:", err));
  }
});

// ── History ───────────────────────────────────────────────────────────────────

// GET /routes/:id/history?limit=56
app.get("/routes/:id/history", auth, (req, res) => {
  if (!routes.has(req.params.id)) return res.status(404).json({ error: "Route not found" });
  const limit = parseInt(req.query.limit ?? "56", 10);
  res.json(getHistory(req.params.id, limit));
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n✈  Skanner backend running on port ${PORT}`);
  console.log(`   SERPAPI_KEY : ${process.env.SERPAPI_KEY ? "✓ set" : "✗ MISSING"}`);
  console.log(`   SMTP_USER   : ${process.env.SMTP_USER  ? "✓ set" : "✗ not set (email alerts disabled)"}`);
  console.log(`   API_SECRET  : ${process.env.API_SECRET ? "✓ set" : "open (no auth)"}\n`);

  startScheduler();
});
