import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── Config ──────────────────────────────────────────────────────────────────
// Set this to your Railway backend URL after deploying.
// e.g. "https://skanner-backend-production.up.railway.app"
const API_BASE   = import.meta.env?.VITE_API_BASE ?? "http://localhost:3000";
const API_SECRET = import.meta.env?.VITE_API_SECRET ?? "";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0a0c10; --surface:#111318; --surface2:#181c24; --border:#1e2330;
    --accent:#00e5ff; --accent2:#ff6b35; --green:#00ff88; --yellow:#ffd700;
    --text:#e8eaf0; --muted:#4a5068;
    --font-display:'Syne',sans-serif; --font-mono:'Space Mono',monospace;
  }
  body { background:var(--bg); color:var(--text); font-family:var(--font-display); }
  .app {
    min-height:100vh; background:var(--bg);
    background-image:
      radial-gradient(ellipse 80% 40% at 50% -10%,rgba(0,229,255,.06) 0%,transparent 70%),
      repeating-linear-gradient(0deg,transparent,transparent 39px,var(--border) 39px,var(--border) 40px),
      repeating-linear-gradient(90deg,transparent,transparent 39px,var(--border) 39px,var(--border) 40px);
  }
  .header {
    border-bottom:1px solid var(--border); padding:18px 32px;
    display:flex; align-items:center; justify-content:space-between;
    background:rgba(10,12,16,.9); backdrop-filter:blur(12px);
    position:sticky; top:0; z-index:100;
  }
  .logo { display:flex; align-items:center; gap:12px; font-family:var(--font-display); font-weight:800; font-size:1.2rem; letter-spacing:-.02em; }
  .logo-icon { width:32px;height:32px;background:var(--accent);clip-path:polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%);display:flex;align-items:center;justify-content:center;font-size:14px; }
  .status-bar { display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:.7rem;color:var(--muted); }
  .pulse-dot { width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)} }
  .main { max-width:1200px;margin:0 auto;padding:32px 24px;display:grid;gap:24px; }
  .grid-2 { display:grid;grid-template-columns:1fr 1fr;gap:24px; }
  @media(max-width:768px){.grid-2{grid-template-columns:1fr}}
  .card { background:var(--surface);border:1px solid var(--border);border-radius:2px;padding:24px;position:relative;overflow:hidden; }
  .card::before { content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.4; }
  .card-label { font-family:var(--font-mono);font-size:.65rem;letter-spacing:.15em;color:var(--muted);text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px; }
  .card-label::after { content:'';flex:1;height:1px;background:var(--border); }
  .route-display { display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:2px; }
  .airport-code { font-family:var(--font-mono);font-size:2rem;font-weight:700;color:var(--accent);letter-spacing:.05em; }
  .route-arrow { flex:1;display:flex;align-items:center;gap:4px;color:var(--muted);font-size:.7rem;font-family:var(--font-mono); }
  .route-line { flex:1;height:1px;background:var(--muted); }
  .arrow-head { color:var(--accent2);font-size:1rem; }
  .form-group { margin-bottom:16px; }
  label { display:block;font-family:var(--font-mono);font-size:.65rem;letter-spacing:.1em;color:var(--muted);text-transform:uppercase;margin-bottom:6px; }
  input,select { width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:10px 14px;color:var(--text);font-family:var(--font-mono);font-size:.85rem;outline:none;transition:border-color .2s; }
  input:focus,select:focus{border-color:var(--accent)}
  select option{background:var(--surface2)}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .btn{padding:12px 24px;font-family:var(--font-display);font-weight:700;font-size:.85rem;letter-spacing:.05em;border:none;border-radius:2px;cursor:pointer;transition:all .15s;text-transform:uppercase;}
  .btn-primary{background:var(--accent);color:var(--bg);width:100%}
  .btn-primary:hover{background:#33ebff;transform:translateY(-1px)}
  .btn-primary:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .btn-outline{background:var(--surface2);color:var(--accent);border:1px solid rgba(0,229,255,.3);width:100%}
  .btn-outline:hover{background:rgba(0,229,255,.08)}
  .btn-sm{padding:6px 14px;font-size:.7rem;background:var(--surface2);color:var(--text);border:1px solid var(--border);}
  .btn-sm:hover{border-color:var(--accent);color:var(--accent)}
  .schedule-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
  .scan-time{background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:12px 8px;text-align:center;cursor:pointer;transition:all .15s;}
  .scan-time.active{border-color:var(--accent);background:rgba(0,229,255,.06)}
  .scan-time .time-label{font-family:var(--font-mono);font-size:.9rem;font-weight:700;color:var(--text);display:block}
  .scan-time .time-sub{font-family:var(--font-mono);font-size:.6rem;color:var(--muted);margin-top:2px}
  .scan-time.active .time-label{color:var(--accent)}
  .countdown{font-family:var(--font-mono);font-size:1.5rem;font-weight:700;color:var(--accent);letter-spacing:.05em;text-align:center;padding:8px 0 4px}
  .countdown-label{font-family:var(--font-mono);font-size:.6rem;color:var(--muted);text-align:center;letter-spacing:.15em;text-transform:uppercase;margin-bottom:12px}
  .stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
  .stat-box{background:var(--surface2);border:1px solid var(--border);border-radius:2px;padding:14px;text-align:center}
  .stat-value{font-family:var(--font-mono);font-size:1.4rem;font-weight:700;display:block;margin-bottom:2px}
  .stat-label{font-family:var(--font-mono);font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
  .results-table{width:100%;border-collapse:collapse}
  .results-table th{font-family:var(--font-mono);font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)}
  .results-table td{font-family:var(--font-mono);font-size:.8rem;padding:10px 12px;border-bottom:1px solid rgba(30,35,48,.5);vertical-align:middle}
  .results-table tr:hover td{background:rgba(255,255,255,.02)}
  .price-cell{font-weight:700}
  .price-low{color:var(--green)} .price-mid{color:var(--yellow)} .price-high{color:var(--accent2)}
  .badge{display:inline-block;padding:2px 8px;border-radius:2px;font-size:.6rem;font-family:var(--font-mono);letter-spacing:.08em;text-transform:uppercase;font-weight:700}
  .badge-deal{background:rgba(0,255,136,.12);color:var(--green);border:1px solid rgba(0,255,136,.25)}
  .badge-ok{background:rgba(255,215,0,.08);color:var(--yellow);border:1px solid rgba(255,215,0,.2)}
  .badge-high{background:rgba(255,107,53,.1);color:var(--accent2);border:1px solid rgba(255,107,53,.25)}
  .chart-wrapper{height:220px;margin-top:8px}
  .tooltip-box{background:var(--surface);border:1px solid var(--border);padding:10px 14px;font-family:var(--font-mono);font-size:.75rem}
  .scanning-overlay{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.15);border-radius:2px;margin-bottom:16px;font-family:var(--font-mono);font-size:.75rem;color:var(--accent)}
  .spinner{width:14px;height:14px;border:2px solid rgba(0,229,255,.2);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .empty-state{text-align:center;padding:40px 20px;color:var(--muted);font-family:var(--font-mono);font-size:.75rem}
  .empty-icon{font-size:2rem;display:block;margin-bottom:8px;opacity:.4}
  .alert-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}
  .alert-icon{width:32px;height:32px;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
  .alert-text{flex:1}
  .alert-title{font-size:.82rem;font-weight:600;margin-bottom:2px}
  .alert-sub{font-family:var(--font-mono);font-size:.65rem;color:var(--muted)}
  .toggle{width:36px;height:20px;background:var(--border);border-radius:10px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
  .toggle.on{background:var(--accent)}
  .toggle::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:white;transition:transform .2s}
  .toggle.on::after{transform:translateX(16px)}
  .threshold-input{display:flex;align-items:center;gap:8px}
  .threshold-input input{flex:1}
  .threshold-input span{font-family:var(--font-mono);font-size:.8rem;color:var(--muted);white-space:nowrap}
  .error-bar{background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.25);color:#ff5050;font-family:var(--font-mono);font-size:.72rem;padding:10px 14px;border-radius:2px;margin-bottom:16px}
  .success-bar{background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);color:var(--green);font-family:var(--font-mono);font-size:.72rem;padding:10px 14px;border-radius:2px;margin-bottom:16px}
  a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
`;

// ── API client ───────────────────────────────────────────────────────────────

const headers = () => ({
  "Content-Type": "application/json",
  ...(API_SECRET ? { Authorization: `Bearer ${API_SECRET}` } : {}),
});

const api = {
  get:    url => fetch(`${API_BASE}${url}`, { headers: headers() }).then(r => r.json()),
  post:   (url, body) => fetch(`${API_BASE}${url}`, { method: "POST", headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  patch:  (url, body) => fetch(`${API_BASE}${url}`, { method: "PATCH", headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  delete: url => fetch(`${API_BASE}${url}`, { method: "DELETE", headers: headers() }).then(r => r.json()),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNextScan() {
  const now  = new Date();
  const hours = [0, 6, 12, 18];
  for (const h of hours) {
    const t = new Date(now);
    t.setHours(h, 0, 0, 0);
    if (t > now) return t;
  }
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  t.setHours(0, 0, 0, 0);
  return t;
}

function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-box">
      <div style={{ color: "#4a5068", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#00e5ff" }}>${payload[0].value}</div>
    </div>
  );
};

// ── Main App ─────────────────────────────────────────────────────────────────

export default function FlightScanner() {
  const [routes,       setRoutes]       = useState([]);
  const [activeRoute,  setActiveRoute]  = useState(null);
  const [results,      setResults]      = useState([]);
  const [history,      setHistory]      = useState([]);
  const [scanning,     setScanning]     = useState(false);
  const [countdown,    setCountdown]    = useState("");
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");

  const [draft, setDraft] = useState({
    origin: "MEX", dest: "LAX", date: "", returnDate: "",
    tripType: "one-way", alertEmail: "", priceThreshold: "",
  });

  const [alertToggles, setAlertToggles] = useState({ email: false, threshold: false });

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(getNextScan() - new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Load routes on mount ───────────────────────────────────────────────────
  useEffect(() => { loadRoutes(); }, []);

  async function loadRoutes() {
    try {
      const data = await api.get("/routes");
      setRoutes(Array.isArray(data) ? data : []);
    } catch { setError("Cannot reach backend — is it running?"); }
  }

  // ── Load history when activeRoute changes ──────────────────────────────────
  useEffect(() => {
    if (!activeRoute) return;
    api.get(`/routes/${activeRoute.id}/history?limit=56`)
      .then(data => {
        // Convert history records to chart-friendly format
        const chartData = (Array.isArray(data) ? data : [])
          .reverse()
          .map(r => ({
            label: new Date(r.scannedAt).toLocaleDateString("en", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
            price: r.lowest,
          }))
          .filter(r => r.price !== null);
        setHistory(chartData);

        // Latest results
        const latest = Array.isArray(data) && data[0]?.flights ? data[0].flights : [];
        setResults(latest);
      })
      .catch(() => {});
  }, [activeRoute]);

  // ── Save & scan ────────────────────────────────────────────────────────────
  async function handleSave() {
    setError(""); setSuccess("");
    if (!draft.origin || !draft.dest || !draft.date) {
      setError("Origin, destination, and date are required."); return;
    }
    try {
      const body = {
        ...draft,
        alertEmail:     alertToggles.email     ? draft.alertEmail     : null,
        priceThreshold: alertToggles.threshold ? draft.priceThreshold : null,
      };
      const created = await api.post("/routes", body);
      if (created.error) { setError(created.error); return; }
      setRoutes(r => [...r, created]);
      setActiveRoute(created);
      setSuccess("Route saved! Starting scan…");
      triggerScan(created);
    } catch (e) { setError(e.message); }
  }

  async function triggerScan(route) {
    setScanning(true); setError("");
    try {
      const record = await api.post(`/routes/${route.id}/scan`, {});
      if (record.error) { setError(record.error); return; }
      setResults(record.flights ?? []);
      setHistory(h => [{
        label: new Date(record.scannedAt).toLocaleTimeString(),
        price: record.lowest,
      }, ...h].slice(0, 56));
      setSuccess(`Scan complete — ${record.flights?.length ?? 0} flights found. Lowest: $${record.lowest}`);
    } catch (e) { setError(`Scan failed: ${e.message}`); }
    finally { setScanning(false); }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const prices    = results.map(r => r.price).filter(Boolean);
  const lowest    = prices.length ? Math.min(...prices) : null;
  const avg       = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const minHist   = history.length ? Math.min(...history.map(h => h.price).filter(Boolean)) : 0;

  function priceClass(p) {
    if (!lowest) return "";
    if (p <= lowest * 1.1) return "price-low";
    if (p <= lowest * 1.3) return "price-mid";
    return "price-high";
  }

  function priceBadge(p) {
    if (!lowest) return null;
    if (p <= lowest * 1.1) return <span className="badge badge-deal">Deal</span>;
    if (p <= lowest * 1.3) return <span className="badge badge-ok">Fair</span>;
    return <span className="badge badge-high">High</span>;
  }

  const SCAN_TIMES = [
    { label: "6:00",  sub: "AM", value: "6"  },
    { label: "12:00", sub: "PM", value: "12" },
    { label: "6:00",  sub: "PM", value: "18" },
    { label: "12:00", sub: "AM", value: "0"  },
  ];

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">
        <header className="header">
          <div className="logo">
            <div className="logo-icon">✈</div>
            SKANNER
          </div>
          <div className="status-bar">
            <div className="pulse-dot" />
            MONITORING ACTIVE &nbsp;|&nbsp; {routes.length} ROUTE{routes.length !== 1 ? "S" : ""}
          </div>
        </header>

        <div className="main">

          {error   && <div className="error-bar">⚠ {error}</div>}
          {success && <div className="success-bar">✓ {success}</div>}

          <div className="grid-2">

            {/* Route Config */}
            <div className="card">
              <div className="card-label">Route Configuration</div>

              <div className="route-display">
                <div>
                  <div className="airport-code">{draft.origin || "????"}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: ".6rem", color: "var(--muted)" }}>Origin</div>
                </div>
                <div className="route-arrow">
                  <div className="route-line" />
                  <div className="arrow-head">▶</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="airport-code">{draft.dest || "????"}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: ".6rem", color: "var(--muted)" }}>Destination</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Origin IATA</label>
                  <input value={draft.origin} onChange={e => setDraft(d => ({ ...d, origin: e.target.value.toUpperCase().slice(0,3) }))} placeholder="MEX" maxLength={3} />
                </div>
                <div className="form-group">
                  <label>Dest IATA</label>
                  <input value={draft.dest} onChange={e => setDraft(d => ({ ...d, dest: e.target.value.toUpperCase().slice(0,3) }))} placeholder="LAX" maxLength={3} />
                </div>
              </div>

              <div className="form-group">
                <label>Trip Type</label>
                <select value={draft.tripType} onChange={e => setDraft(d => ({ ...d, tripType: e.target.value }))}>
                  <option value="one-way">One Way</option>
                  <option value="round-trip">Round Trip</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Depart Date</label>
                  <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} />
                </div>
                {draft.tripType === "round-trip" && (
                  <div className="form-group">
                    <label>Return Date</label>
                    <input type="date" value={draft.returnDate} onChange={e => setDraft(d => ({ ...d, returnDate: e.target.value }))} />
                  </div>
                )}
              </div>

              <button className="btn btn-primary" onClick={handleSave} disabled={scanning}>
                {scanning ? "Scanning…" : "Save Route & Scan Now"}
              </button>

              {/* Existing routes */}
              {routes.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div className="card-label" style={{ marginBottom: 10 }}>Tracked Routes</div>
                  {routes.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: ".78rem", flex: 1, color: activeRoute?.id === r.id ? "var(--accent)" : "var(--text)" }}>
                        {r.origin}→{r.dest} · {r.date}
                      </span>
                      <button className="btn btn-sm" onClick={() => { setActiveRoute(r); setError(""); setSuccess(""); }}>View</button>
                      <button className="btn btn-sm" onClick={() => triggerScan(r)} disabled={scanning}>↻</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule + Stats */}
            <div className="card">
              <div className="card-label">Scan Schedule</div>
              <div className="countdown">{countdown}</div>
              <div className="countdown-label">Until Next Scan</div>

              <div className="schedule-grid">
                {SCAN_TIMES.map(t => (
                  <div key={t.value} className="scan-time active">
                    <span className="time-label">{t.label}</span>
                    <span className="time-sub">{t.sub}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: "var(--font-mono)", fontSize: ".65rem", color: "var(--muted)", textAlign: "center", marginBottom: 16 }}>
                All windows active · Managed by backend cron
              </div>

              <div className="stat-row">
                <div className="stat-box">
                  <span className="stat-value" style={{ color: "var(--green)" }}>{lowest ? `$${lowest}` : "--"}</span>
                  <span className="stat-label">Lowest</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value" style={{ color: "var(--yellow)" }}>{avg ? `$${avg}` : "--"}</span>
                  <span className="stat-label">Average</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value" style={{ color: "var(--accent)" }}>{results.length}</span>
                  <span className="stat-label">Flights</span>
                </div>
              </div>

              {/* Alert Settings */}
              <div className="card-label" style={{ marginTop: 4 }}>Alert Settings</div>

              <div className="alert-row">
                <div className="alert-icon">📧</div>
                <div className="alert-text">
                  <div className="alert-title">Email Alerts</div>
                  <div className="alert-sub">Notify on every deal found</div>
                </div>
                <div className={`toggle ${alertToggles.email ? "on" : ""}`} onClick={() => setAlertToggles(a => ({ ...a, email: !a.email }))} />
              </div>
              {alertToggles.email && (
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>Email Address</label>
                  <input type="email" value={draft.alertEmail} onChange={e => setDraft(d => ({ ...d, alertEmail: e.target.value }))} placeholder="you@email.com" />
                </div>
              )}

              <div className="alert-row">
                <div className="alert-icon">🎯</div>
                <div className="alert-text">
                  <div className="alert-title">Price Threshold</div>
                  <div className="alert-sub">Alert only below target price</div>
                </div>
                <div className={`toggle ${alertToggles.threshold ? "on" : ""}`} onClick={() => setAlertToggles(a => ({ ...a, threshold: !a.threshold }))} />
              </div>
              {alertToggles.threshold && (
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>Max Price (USD)</label>
                  <div className="threshold-input">
                    <span>$</span>
                    <input type="number" value={draft.priceThreshold} onChange={e => setDraft(d => ({ ...d, priceThreshold: e.target.value }))} placeholder="200" />
                    <span>or less</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Price History Chart */}
          <div className="card">
            <div className="card-label">
              Price History {activeRoute ? `— ${activeRoute.origin}→${activeRoute.dest}` : ""}
            </div>
            {history.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📈</span>
                Save a route and run a scan to start tracking prices
              </div>
            ) : (
              <>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,35,48,.8)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontFamily: "Space Mono", fontSize: 9, fill: "#4a5068" }} tickLine={false} axisLine={false} interval={Math.floor(history.length / 6)} />
                      <YAxis tick={{ fontFamily: "Space Mono", fontSize: 9, fill: "#4a5068" }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      {minHist > 0 && <ReferenceLine y={minHist} stroke="rgba(0,255,136,.3)" strokeDasharray="4 4" />}
                      <Line type="monotone" dataKey="price" stroke="#00e5ff" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#00e5ff", stroke: "#0a0c10", strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {minHist > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: ".65rem", color: "rgba(0,255,136,.7)" }}>
                      ── All-time low: ${minHist}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Flight Results */}
          <div className="card">
            <div className="card-label">
              Latest Results {activeRoute ? `· ${activeRoute.origin}→${activeRoute.dest} ${activeRoute.date}` : ""}
            </div>
            {scanning && (
              <div className="scanning-overlay">
                <div className="spinner" />
                Fetching live prices from Google Flights…
              </div>
            )}
            {!scanning && results.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">✈</span>
                No results yet — save a route above to begin
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Airline</th>
                      <th>Flight</th>
                      <th>Depart</th>
                      <th>Arrive</th>
                      <th>Duration</th>
                      <th>Stops</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Book</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...results].sort((a, b) => a.price - b.price).map((f, i) => (
                      <tr key={i}>
                        <td>{f.airline}</td>
                        <td style={{ color: "var(--muted)" }}>{f.flightNum}</td>
                        <td>{f.depart}</td>
                        <td>{f.arrive}</td>
                        <td style={{ color: "var(--muted)" }}>{f.duration}</td>
                        <td style={{ color: "var(--muted)", fontSize: ".72rem" }}>{f.stops === 0 ? "Nonstop" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`}</td>
                        <td className={`price-cell ${priceClass(f.price)}`}>${f.price}</td>
                        <td>{priceBadge(f.price)}</td>
                        <td>{f.bookingLink ? <a href={f.bookingLink} target="_blank" rel="noreferrer">Book →</a> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
