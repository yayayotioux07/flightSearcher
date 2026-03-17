// src/scheduler.js
// Uses node-cron to fire scans at 6 AM, 12 PM, 6 PM, and 12 AM (server time).
// Also exports runScan() so the API can trigger manual scans.

import cron from "node-cron";
import { searchFlights } from "./flights.js";
import { sendDealAlert }  from "./mailer.js";
import { allActiveRoutes, recordScan } from "./store.js";

// ── Core scan function ────────────────────────────────────────────────────────

export async function runScan(route) {
  const tag = `[scanner] ${route.origin}→${route.dest} ${route.date}`;
  console.log(`${tag} starting…`);

  let result;
  try {
    result = await searchFlights({
      origin:     route.origin,
      dest:       route.dest,
      date:       route.date,
      returnDate: route.returnDate,
    });
  } catch (err) {
    console.error(`${tag} fetch failed:`, err.message);
    return null;
  }

  const record = {
    scannedAt: result.scannedAt,
    lowest:    result.lowest,
    average:   result.average,
    flights:   result.flights,
  };

  recordScan(route.id, record);
  console.log(`${tag} done — lowest $${result.lowest ?? "N/A"}, ${result.flights.length} flights`);

  // ── Alert logic ───────────────────────────────────────────────────────────
  const shouldAlert =
    route.alertEmail &&
    result.lowest !== null &&
    (route.priceThreshold === null || result.lowest <= route.priceThreshold);

  if (shouldAlert) {
    try {
      await sendDealAlert({
        to:         route.alertEmail,
        origin:     route.origin,
        dest:       route.dest,
        date:       route.date,
        lowest:     result.lowest,
        threshold:  route.priceThreshold ?? null,
        topFlights: result.flights.sort((a, b) => a.price - b.price).slice(0, 3),
      });
    } catch (err) {
      console.error(`${tag} email failed:`, err.message);
    }
  }

  return record;
}

// ── Scan all active routes ────────────────────────────────────────────────────

async function scanAll() {
  const active = allActiveRoutes();
  console.log(`[scheduler] Firing scan window — ${active.length} route(s)`);
  for (const route of active) {
    await runScan(route);
  }
}

// ── Schedule: 6 AM, 12 PM, 6 PM, 12 AM ──────────────────────────────────────
//   Cron format: second minute hour day month weekday
//   Railway server runs UTC — adjust the hour values if you want local time.
//   To convert: if you're in UTC-6 (CST), add 6 to each hour.
//   6 AM CST  = 12:00 UTC → "0 12 * * *"
//   12 PM CST = 18:00 UTC → "0 18 * * *"
//   6 PM CST  = 00:00 UTC → "0 0 * * *"
//   12 AM CST = 06:00 UTC → "0 6 * * *"
//
//   Default below uses UTC directly. Set TZ env var on Railway to auto-convert.

export function startScheduler() {
  const jobs = [
    { label: "06:00", expr: "0 6 * * *"  },
    { label: "12:00", expr: "0 12 * * *" },
    { label: "18:00", expr: "0 18 * * *" },
    { label: "00:00", expr: "0 0 * * *"  },
  ];

  for (const job of jobs) {
    cron.schedule(job.expr, () => {
      console.log(`[scheduler] ${job.label} window triggered`);
      scanAll().catch(err => console.error("[scheduler] error:", err));
    });
    console.log(`[scheduler] Registered ${job.label} cron`);
  }

  console.log("[scheduler] All scan windows active ✓");
}
