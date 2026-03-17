// src/flights.js
// Fetches real flight prices from SerpApi's Google Flights engine

import fetch from "node-fetch";

const SERPAPI_BASE = "https://serpapi.com/search.json";

/**
 * Search one-way or round-trip flights via SerpApi Google Flights.
 *
 * @param {object} params
 * @param {string} params.origin       - IATA code e.g. "MEX"
 * @param {string} params.dest         - IATA code e.g. "LAX"
 * @param {string} params.date         - "YYYY-MM-DD"
 * @param {string} [params.returnDate] - "YYYY-MM-DD" for round-trips
 * @param {number} [params.adults]     - default 1
 * @returns {Promise<object>}          - { flights, lowest, average, scannedAt }
 */
export async function searchFlights({ origin, dest, date, returnDate, adults = 1 }) {
  const tripType = returnDate ? 1 : 2; // 1=round-trip, 2=one-way in SerpApi

  const params = new URLSearchParams({
    engine:         "google_flights",
    departure_id:   origin,
    arrival_id:     dest,
    outbound_date:  date,
    type:           String(tripType),
    adults:         String(adults),
    currency:       "USD",
    hl:             "en",
    api_key:        process.env.SERPAPI_KEY,
  });

  if (returnDate) params.set("return_date", returnDate);

  const url = `${SERPAPI_BASE}?${params}`;
  const res  = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SerpApi error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // SerpApi returns best_flights and other_flights arrays
  const raw = [
    ...(data.best_flights  ?? []),
    ...(data.other_flights ?? []),
  ];

  if (raw.length === 0) {
    return { flights: [], lowest: null, average: null, scannedAt: new Date().toISOString() };
  }

  const flights = raw.map(f => {
    const leg   = f.flights?.[0] ?? {};
    const last  = f.flights?.[f.flights.length - 1] ?? {};
    return {
      airline:     leg.airline                     ?? "Unknown",
      flightNum:   leg.flight_number               ?? "",
      depart:      leg.departure_airport?.time     ?? "",
      arrive:      last.arrival_airport?.time      ?? "",
      duration:    formatMinutes(f.total_duration) ?? "",
      stops:       f.flights.length - 1,
      price:       f.price,
      currency:    "USD",
      bookingLink: f.booking_token ? buildBookingLink(f.booking_token) : null,
    };
  });

  const prices  = flights.map(f => f.price).filter(Boolean);
  const lowest  = prices.length ? Math.min(...prices) : null;
  const average = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;

  return { flights, lowest, average, scannedAt: new Date().toISOString() };
}

function formatMinutes(mins) {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function buildBookingLink(token) {
  // SerpApi provides a token; the booking happens on Google Flights
  return `https://www.google.com/flights?booking_token=${encodeURIComponent(token)}`;
}
