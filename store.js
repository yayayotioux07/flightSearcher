// src/store.js
// Simple in-memory store. On Railway, data lives for the lifetime of the process.
// For persistence across deploys, swap these Maps for a Postgres/Supabase table —
// the interface is the same so the rest of the code needs no changes.

/**
 * routes: Map<id, RouteConfig>
 *   RouteConfig = { id, origin, dest, date, returnDate, tripType,
 *                   alertEmail, priceThreshold, active, createdAt }
 */
export const routes = new Map();

/**
 * scanHistory: Map<routeId, ScanRecord[]>
 *   ScanRecord = { scannedAt, lowest, average, flights[] }
 */
export const scanHistory = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

export function addRoute(config) {
  routes.set(config.id, config);
  scanHistory.set(config.id, []);
}

export function updateRoute(id, patch) {
  const existing = routes.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  routes.set(id, updated);
  return updated;
}

export function deleteRoute(id) {
  routes.delete(id);
  scanHistory.delete(id);
}

export function recordScan(routeId, scanResult) {
  const history = scanHistory.get(routeId) ?? [];
  // Keep last 200 records per route
  history.unshift(scanResult);
  if (history.length > 200) history.pop();
  scanHistory.set(routeId, history);
}

export function getHistory(routeId, limit = 56) {
  return (scanHistory.get(routeId) ?? []).slice(0, limit);
}

export function allActiveRoutes() {
  return [...routes.values()].filter(r => r.active !== false);
}
