// src/mailer.js
// Sends email alerts via Gmail SMTP when deals are found

import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Send a deal alert email.
 *
 * @param {object} opts
 * @param {string}   opts.to           - recipient email
 * @param {string}   opts.origin       - e.g. "MEX"
 * @param {string}   opts.dest         - e.g. "LAX"
 * @param {string}   opts.date         - travel date
 * @param {number}   opts.lowest       - lowest price found
 * @param {number}   opts.threshold    - user's target price (null if no threshold)
 * @param {object[]} opts.topFlights   - top 3 cheapest flights
 */
export async function sendDealAlert({ to, origin, dest, date, lowest, threshold, topFlights }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[mailer] SMTP not configured — skipping email");
    return;
  }

  const subject = `✈ Deal Found: ${origin}→${dest} from $${lowest} on ${date}`;

  const flightRows = topFlights.slice(0, 3).map(f => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2330;">${f.airline} ${f.flightNum}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2330;">${f.depart} → ${f.arrive}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2330;">${f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #1e2330;color:#00ff88;font-weight:700;">$${f.price}</td>
      ${f.bookingLink ? `<td style="padding:8px 12px;border-bottom:1px solid #1e2330;"><a href="${f.bookingLink}" style="color:#00e5ff;">Book →</a></td>` : "<td></td>"}
    </tr>
  `).join("");

  const thresholdNote = threshold
    ? `<p style="color:#ffd700;font-family:monospace;font-size:13px;">⚡ Price dropped below your $${threshold} target!</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#0a0c10;color:#e8eaf0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;margin:0;padding:32px;">
      <div style="max-width:600px;margin:0 auto;">

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
          <div style="background:#00e5ff;width:32px;height:32px;clip-path:polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%);display:inline-block;"></div>
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">SKANNER</span>
        </div>

        <div style="background:#111318;border:1px solid #1e2330;border-radius:2px;padding:24px;margin-bottom:20px;">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.15em;color:#4a5068;text-transform:uppercase;margin-bottom:8px;">Deal Alert</p>
          <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.02em;margin:0 0 4px;">
            ${origin} <span style="color:#4a5068;">→</span> ${dest}
          </h1>
          <p style="font-family:monospace;color:#4a5068;font-size:13px;margin:0;">Travel date: ${date}</p>
        </div>

        <div style="background:#111318;border:1px solid #1e2330;border-radius:2px;padding:20px;margin-bottom:20px;text-align:center;">
          <p style="font-family:monospace;font-size:11px;letter-spacing:0.15em;color:#4a5068;text-transform:uppercase;margin-bottom:8px;">Lowest Price Found</p>
          <p style="font-size:48px;font-weight:800;color:#00ff88;margin:0;font-family:monospace;">$${lowest}</p>
          ${thresholdNote}
        </div>

        <div style="background:#111318;border:1px solid #1e2330;border-radius:2px;overflow:hidden;margin-bottom:20px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#181c24;">
                <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;letter-spacing:0.12em;color:#4a5068;text-transform:uppercase;">Airline</th>
                <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;letter-spacing:0.12em;color:#4a5068;text-transform:uppercase;">Times</th>
                <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;letter-spacing:0.12em;color:#4a5068;text-transform:uppercase;">Stops</th>
                <th style="padding:10px 12px;text-align:left;font-family:monospace;font-size:10px;letter-spacing:0.12em;color:#4a5068;text-transform:uppercase;">Price</th>
                <th style="padding:10px 12px;"></th>
              </tr>
            </thead>
            <tbody>${flightRows}</tbody>
          </table>
        </div>

        <p style="font-family:monospace;font-size:11px;color:#4a5068;text-align:center;">
          Scanned by Skanner · ${new Date().toLocaleString()}
        </p>

      </div>
    </body>
    </html>
  `;

  await getTransporter().sendMail({
    from:    `"Skanner ✈" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });

  console.log(`[mailer] Alert sent to ${to} — lowest $${lowest}`);
}
