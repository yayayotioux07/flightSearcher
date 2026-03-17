// telegram.js
// Sends deal alerts via Telegram Bot API.
// Setup: create a bot with @BotFather, get the token, get your chat ID.

import fetch from "node-fetch";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Send a Telegram message to the configured chat.
 * Uses MarkdownV2 formatting for rich messages.
 */
export async function sendTelegramAlert({
  origin, dest, date, lowest, threshold, topFlights,
}) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping");
    return;
  }

  const routeLabel = `${origin} ✈ ${dest}`;
  const dealIcon   = lowest < threshold * 0.8 ? "🔥" : "💸";

  // Build flight rows
  const flightLines = topFlights.slice(0, 3).map((f, i) => {
    const stops  = f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`;
    const book   = f.bookingLink ? `[Book →](${f.bookingLink})` : "";
    return `${i + 1}\\. *${f.airline}* \\| ${esc(f.depart)} → ${esc(f.arrive)} \\| ${esc(stops)} \\| *\\$${f.price}* ${book}`;
  }).join("\n");

  const text = [
    `${dealIcon} *DEAL ALERT* \\| ${esc(routeLabel)}`,
    ``,
    `📅 *Date:* ${esc(date)}`,
    `💰 *Lowest price:* *\\$${lowest}*`,
    `🎯 *Your threshold:* \\$${threshold}`,
    ``,
    `*Top flights:*`,
    flightLines,
    ``,
    `_Scanned by Skanner · ${esc(new Date().toLocaleString("en-MX", { timeZone: "America/Mexico_City" }))}_`,
  ].join("\n");

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:    process.env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "MarkdownV2",
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description}`);
  }

  console.log(`[telegram] Alert sent — ${origin}→${dest} $${lowest} on ${date}`);
}

/**
 * Send a plain text message — useful for startup confirmation.
 */
export async function sendTelegramMessage(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
    }),
  });
}

// MarkdownV2 requires escaping these characters
function esc(str) {
  return String(str).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}