// scheduler.js
import cron from "node-cron";
import { searchFlights }                      from "./flights.js";
import { sendTelegramAlert, sendTelegramMessage } from "./telegram.js";
import { recordScan }                         from "./store.js";

// ── Config ────────────────────────────────────────────────────────────────────

const PRICE_THRESHOLD = 150;

const ROUTES = [
  { id: "mex-mad", origin: "MEX", dest: "MAD" },
  { id: "cjs-cun", origin: "CJS", dest: "CUN" },
  { id: "cjs-sjd", origin: "CJS", dest: "SJD" },
  { id: "cjs-mex", origin: "CJS", dest: "MEX" },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getDateRange() {
  const dates  = [];
  const start  = new Date();
  start.setMonth(start.getMonth() + 2);
  start.setHours(0, 0, 0, 0);

  const end = new Date(new Date().getFullYear(), 11, 31);

  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// ── Core scan ─────────────────────────────────────────────────────────────────

export async function runScan(route, date) {
  const tag = `[scanner] ${route.origin}→${route.dest} ${date}`;
  console.log(`${tag} starting…`);

  let result;
  try {
    result = await searchFlights({ origin: route.origin, dest: route.dest, date });
  } catch (err) {
    console.error(`${tag} fetch failed:`, err.message);
    return null;
  }

  const record = {
    scannedAt: result.scannedAt,
    date,
    lowest:    result.lowest,
    average:   result.average,
    flights:   result.flights,
  };

  recordScan(route.id, record);
  console.log(`${tag} done — lowest $${result.lowest ?? "N/A"}, ${result.flights.length} flights`);

  // Alert if under threshold
  if (result.lowest !== null && result.lowest < PRICE_THRESHOLD) {
    try {
      await sendTelegramAlert({
        origin:     route.origin,
        dest:       route.dest,
        date,
        lowest:     result.lowest,
        threshold:  PRICE_THRESHOLD,
        topFlights: result.flights.sort((a, b) => a.price - b.price).slice(0, 3),
      });
    } catch (err) {
      console.error(`${tag} Telegram alert failed:`, err.message);
    }
  }

  return record;
}

// ── Scan all routes × all dates ───────────────────────────────────────────────

export async function scanAll() {
  const dates = getDateRange();
  const total = ROUTES.length * dates.length;
  console.log(`\n[scheduler] Full scan — ${ROUTES.length} routes × ${dates.length} dates (${total} searches)`);

  await sendTelegramMessage(
    `🔍 Skanner starting scan\n${ROUTES.length} routes × ${dates.length} dates\n${new Date().toLocaleString("en-MX", { timeZone: "America/Mexico_City" })}`
  );

  let deals = 0;

  for (const route of ROUTES) {
    for (const date of dates) {
      const record = await runScan(route, date);
      if (record?.lowest && record.lowest < PRICE_THRESHOLD) deals++;
      await new Promise(r => setTimeout(r, 1200)); // rate limit buffer
    }
  }

  await sendTelegramMessage(
    `✅ Scan complete\nDeals found under $${PRICE_THRESHOLD}: ${deals}\n${new Date().toLocaleString("en-MX", { timeZone: "America/Mexico_City" })}`
  );

  console.log(`[scheduler] Scan complete — ${deals} deals found`);
}

// ── Cron: 6am and 6pm Mexico City time ───────────────────────────────────────

export function startScheduler() {
  cron.schedule("0 6 * * *", () => {
    console.log("\n[scheduler] ⏰ 6:00 AM triggered");
    scanAll().catch(err => console.error("[scheduler] error:", err));
  });

  cron.schedule("0 18 * * *", () => {
    console.log("\n[scheduler] ⏰ 6:00 PM triggered");
    scanAll().catch(err => console.error("[scheduler] error:", err));
  });

  console.log("[scheduler] ✓ 6:00 AM scan scheduled");
  console.log("[scheduler] ✓ 6:00 PM scan scheduled");
  console.log(`[scheduler] Routes: ${ROUTES.map(r => `${r.origin}→${r.dest}`).join(", ")}`);
  console.log(`[scheduler] Threshold: $${PRICE_THRESHOLD}\n`);

  // Send a startup message to confirm bot is working
  sendTelegramMessage(
    `✈ Skanner is online!\nMonitoring: ${ROUTES.map(r => `${r.origin}→${r.dest}`).join(", ")}\nAlert threshold: $${PRICE_THRESHOLD}\nScans at 6:00 AM and 6:00 PM (Mexico City)`
  ).catch(() => {});
}

export { ROUTES, PRICE_THRESHOLD };