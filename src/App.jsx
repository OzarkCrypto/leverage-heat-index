import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ─── LEVERAGE HEAT INDEX v2.1 ─────────────────────────────────
// Z-score based normalization. localStorage caching for historical data.
//
// Data flow:
//   /api/history  → DeFiLlama chartLendBorrow (borrow rate, util, borrows) + CoinGecko BTC + HL funding
//   /api/dune     → On-chain borrow/repay txn volumes (B/R ratio)
//   Real-time     → DeFiLlama poolsBorrow + Hyperliquid + CoinGecko + Stablecoins
//
// Caching:
//   localStorage stores historical data with timestamps.
//   Only re-fetches if >6 hours stale. Shows cached data immediately on load.

const PROTOCOLS = [
  "aave-v3","compound-v3","compound-v2","morpho-v1",
  "sparklend","venus-core-pool","radiant-v1","fluid-lending"
];
const STABLES = ["usdc","usdt","dai","usds","usdt0","susds","lusd","frax","gho","crvusd"];
const CACHE_TTL = 6 * 3600 * 1000; // 6 hours
const CACHE_KEY_HIST = "LHI_HIST_V2";
const CACHE_KEY_DUNE = "LHI_DUNE_V2";

// ─── Cache helpers ───────────────────────────────────────────
function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — silently fail */ }
}
function cacheIsStale(key) {
  const c = cacheGet(key);
  if (!c || !c.ts) return true;
  return Date.now() - c.ts > CACHE_TTL;
}

// ─── Utility ─────────────────────────────────────────────────
const fmt = (v, d = 1) => {
  if (v == null || isNaN(v)) return "—";
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(d) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(d) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(d) + "K";
  return v.toFixed(d);
};
const pct = (v, d = 2) => v == null || isNaN(v) ? "—" : v.toFixed(d) + "%";
const clip = (v, lo = -3, hi = 3) => Math.max(lo, Math.min(hi, v));

function zScore(values, windowSize = 90) {
  const results = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const win = values.slice(start, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / win.length;
    const std = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length) || 1;
    results.push(clip((values[i] - mean) / std));
  }
  return results;
}

function zScoreSingle(value, arr) {
  if (!arr || arr.length < 10) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length) || 1;
  return clip((value - mean) / std);
}

function zToHeat(z) { return Math.round(clip((z + 3) / 6, 0, 1) * 100); }

function scoreColor(z) {
  if (z <= -1.5) return "#00b386";
  if (z <= -0.5) return "#4da87a";
  if (z <= 0.5)  return "#8898aa";
  if (z <= 1.5)  return "#e6922e";
  if (z <= 2.2)  return "#e05538";
  return "#d4163c";
}

function regimeLabel(heat) {
  if (heat >= 83) return { label: "EXTREME", color: "#d4163c", icon: "🔥" };
  if (heat >= 67) return { label: "LEVERAGING UP", color: "#e05538", icon: "⚠️" };
  if (heat >= 55) return { label: "WARMING", color: "#e6922e", icon: "📈" };
  if (heat >= 45) return { label: "NEUTRAL", color: "#8898aa", icon: "—" };
  if (heat >= 33) return { label: "COOLING", color: "#4da87a", icon: "📉" };
  return { label: "DELEVERAGED", color: "#00b386", icon: "❄️" };
}

// ─── Spark ───────────────────────────────────────────────────
function Spark({ data, width = 120, height = 32, color = "#7c8cf5", baseline }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const baseY = baseline != null ? height - ((baseline - min) / range) * (height - 4) - 2 : null;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {baseY != null && <line x1={0} y1={baseY} x2={width} y2={baseY} stroke="#ddd" strokeWidth={0.5} strokeDasharray="2,2" />}
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={width} cy={parseFloat(pts[pts.length-1].split(",")[1])} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Gauge ───────────────────────────────────────────────────
function Gauge({ heat, size = 160 }) {
  const r = size * 0.32, cx = size / 2, cy = size * 0.42;
  const sa = -210, ea = 30, span = ea - sa;
  const angle = sa + (heat / 100) * span;
  const toRad = d => d * Math.PI / 180;
  const nl = r * 0.78;
  const z = (heat / 100) * 6 - 3;
  const col = scoreColor(z);
  const reg = regimeLabel(heat);
  const arcs = Array.from({ length: 60 }, (_, i) => {
    const a1 = sa + (i / 60) * span, a2 = sa + ((i + 1) / 60) * span;
    return (
      <path key={i}
        d={`M ${cx + r * Math.cos(toRad(a1))} ${cy + r * Math.sin(toRad(a1))} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(toRad(a2))} ${cy + r * Math.sin(toRad(a2))}`}
        stroke={scoreColor(-3 + (i / 60) * 6)} strokeWidth={5} fill="none" opacity={0.2} />
    );
  });
  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
      {arcs}
      <line x1={cx} y1={cy} x2={cx + nl * Math.cos(toRad(angle))} y2={cy + nl * Math.sin(toRad(angle))}
        stroke={col} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3.5} fill={col} />
      <text x={cx} y={cy + 24} textAnchor="middle" fill={col} style={{ fontSize: 30, fontWeight: 800 }}>{heat}</text>
      <text x={cx} y={cy + 38} textAnchor="middle" fill={col} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>{reg.label}</text>
    </svg>
  );
}

// ─── History Chart ───────────────────────────────────────────
function HistoryChart({ data, title, yLabel, period, onPeriodChange }) {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(-1);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(ref.current); setW(ref.current.offsetWidth || 600);
    return () => ro.disconnect();
  }, []);
  if (!data || data.length < 5) return <div ref={ref} />;
  const now = new Date(), cutoff = new Date(now.getTime() - period * 86400000);
  let filtered = period >= 9999 ? data : data.filter(d => new Date(d.dt) >= cutoff);
  if (filtered.length < 3) filtered = data;
  const H = 180, M = { t: 12, r: 48, b: 26, l: 50 };
  const cw = w - M.l - M.r, ch = H - M.t - M.b;
  const vals = filtered.map(d => d.val);
  const minV = Math.min(...vals), maxV = Math.max(...vals), rangeV = maxV - minV || 1;
  const idx = hover >= 0 && hover < filtered.length ? hover : filtered.length - 1;
  const cur = filtered[idx];
  const points = filtered.map((d, i) => ({
    x: M.l + (i / (filtered.length - 1)) * cw,
    y: M.t + ch - ((d.val - minV) / rangeV) * ch, z: d.z
  }));
  const lines = [];
  for (let i = 0; i < points.length - 1; i++) {
    lines.push(<line key={i} x1={points[i].x} y1={points[i].y} x2={points[i+1].x} y2={points[i+1].y}
      stroke={scoreColor((points[i].z + points[i+1].z) / 2)} strokeWidth={1.8} strokeLinecap="round" />);
  }
  const yTicks = [minV, (minV + maxV) / 2, maxV].map((v, i) => {
    const y = M.t + ch - ((v - minV) / rangeV) * ch;
    return (<g key={i}><line x1={M.l} y1={y} x2={M.l + cw} y2={y} stroke="#f0f0f3" strokeWidth={0.4} />
      <text x={M.l - 4} y={y + 3} textAnchor="end" fill="#bbb" style={{ fontSize: 9 }}>{v >= 1000 ? fmt(v, 0) : v.toFixed(1)}</text></g>);
  });
  const xLabels = [], step = Math.max(1, Math.floor(filtered.length / 7));
  for (let i = 0; i < filtered.length; i += step)
    xLabels.push(<text key={i} x={M.l + (i / (filtered.length - 1)) * cw} y={H - 4} textAnchor="middle" fill="#bbb" style={{ fontSize: 9 }}>{filtered[i].dt.slice(0, 10)}</text>);
  const regZones = yLabel === "heat" ? [
    { label: "EXTREME", y: 83, color: "#d4163c" }, { label: "LEVER", y: 67, color: "#e05538" },
    { label: "WARM", y: 55, color: "#e6922e" }, { label: "COOL", y: 33, color: "#4da87a" },
  ] : [];
  const hx = points[idx]?.x;
  const periods = [{ l: "90D", d: 90 }, { l: "1Y", d: 365 }, { l: "2Y", d: 730 }, { l: "ALL", d: 9999 }];
  return (
    <div ref={ref} style={{ background: "#fff", border: "1px solid #e4e4e8", borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
        <div style={{ display: "flex", gap: 2 }}>
          {periods.map(p => (<button key={p.l} onClick={() => onPeriodChange(p.d)}
            style={{ background: p.d === period ? "#1a1a2e" : "#fff", color: p.d === period ? "#fff" : "#aaa",
              border: `1px solid ${p.d === period ? "#1a1a2e" : "#e0e0e4"}`, borderRadius: 3, padding: "2px 7px", fontSize: 10, cursor: "pointer", fontWeight: p.d === period ? 700 : 400 }}>{p.l}</button>))}
        </div>
      </div>
      <div style={{ fontSize: 11, padding: "4px 8px", background: "#fafafa", borderRadius: 4, display: "inline-flex", gap: 12, marginBottom: 4, alignItems: "center" }}>
        <b style={{ color: "#444" }}>{cur.dt.slice(0, 10)}</b>
        <span style={{ color: scoreColor(cur.z), fontWeight: 700 }}>{yLabel === "heat" ? zToHeat(cur.z) : cur.val.toFixed(2)}</span>
        {cur.z != null && <span style={{ fontSize: 10, color: scoreColor(cur.z) }}>z={cur.z.toFixed(2)}</span>}
      </div>
      <svg width={w} height={H} style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(filtered.length - 1, Math.round(((e.clientX - r.left) - M.l) / cw * (filtered.length - 1))))); }}
        onMouseLeave={() => setHover(-1)}>
        {yTicks}
        {regZones.map(rz => { const y = M.t + ch - ((rz.y - minV) / rangeV) * ch; return (
          <g key={rz.label}><line x1={M.l} y1={y} x2={M.l + cw} y2={y} stroke={rz.color} strokeWidth={0.3} strokeDasharray="4,4" />
            <text x={M.l + cw + 4} y={y + 3} fill={rz.color} opacity={0.5} style={{ fontSize: 7, fontWeight: 600 }}>{rz.label}</text></g>); })}
        <path d={`M ${M.l},${M.t + ch} L ${points.map(p => `${p.x},${p.y}`).join(" L ")} L ${M.l + cw},${M.t + ch} Z`} fill="#7c8cf5" opacity={0.04} />
        {lines}
        <line x1={hx} y1={M.t} x2={hx} y2={M.t + ch} stroke="#bbb" strokeWidth={0.5} strokeDasharray="3,3" />
        <circle cx={hx} cy={points[idx]?.y} r={4} fill={scoreColor(cur.z)} stroke="#fff" strokeWidth={2} />
        {xLabels}
        <rect x={M.l} y={M.t} width={cw} height={ch} fill="transparent" />
      </svg>
    </div>
  );
}

// ─── Metric / Layer ──────────────────────────────────────────
function MetricCard({ label, value, z, spark, desc, sub }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #f0f0f3", padding: "6px 0" }}>
      <div onClick={desc ? () => setOpen(!open) : undefined} style={{ display: "flex", alignItems: "center", gap: 8, cursor: desc ? "pointer" : "default" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {desc && <span style={{ color: "#ccc", fontSize: 10, marginRight: 3 }}>{open ? "▼" : "▶"}</span>}{label}
          </div>
          {sub && <div style={{ fontSize: 10, color: "#bbb", marginTop: 1 }}>{sub}</div>}
        </div>
        {spark && <div style={{ flexShrink: 0 }}>{spark}</div>}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", minWidth: 60, textAlign: "right", whiteSpace: "nowrap" }}>{value}</div>
        {z != null && <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(z), minWidth: 36, textAlign: "right", padding: "1px 5px", borderRadius: 3, background: scoreColor(z) + "12" }}>{z > 0 ? "+" : ""}{z.toFixed(1)}</div>}
      </div>
      {open && desc && <div style={{ fontSize: 11, color: "#888", padding: "4px 0 4px 16px", lineHeight: 1.5 }}>{desc}</div>}
    </div>
  );
}

function LayerBox({ title, weight, z, children }) {
  return (
    <div style={{ border: "1px solid #e4e4e8", borderRadius: 7, padding: "10px 12px", flex: "1 1 280px", minWidth: 260, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
        <span style={{ fontSize: 10, color: "#ccc" }}>{weight}%</span>
      </div>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px solid #eee" }}>
        <span style={{ fontSize: 11, color: "#bbb" }}>Layer z-score</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor(z) }}>{z > 0 ? "+" : ""}{z.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState([]);
  const [btcMcap, setBtcMcap] = useState(null);
  const [stableMcapHist, setStableMcapHist] = useState([]);
  const [hlAssets, setHlAssets] = useState(null);
  const [histData, setHistData] = useState(null);     // from /api/history
  const [duneData, setDuneData] = useState(null);      // from /api/dune
  const [updated, setUpdated] = useState(null);
  const [showPools, setShowPools] = useState(false);
  const [heatPeriod, setHeatPeriod] = useState(365);
  const [ratePeriod, setRatePeriod] = useState(365);
  const [status, setStatus] = useState({});
  const [error, setError] = useState(null);

  // ─── Load cached data immediately on mount ───────────────
  useEffect(() => {
    const cachedHist = cacheGet(CACHE_KEY_HIST);
    if (cachedHist?.data) setHistData(cachedHist.data);
    const cachedDune = cacheGet(CACHE_KEY_DUNE);
    if (cachedDune?.data) setDuneData(cachedDune.data);
  }, []);

  // ─── Fetch historical (with cache check) ─────────────────
  const fetchHistorical = useCallback(async (force = false) => {
    const st = {};

    // /api/history — only if stale or forced
    if (force || cacheIsStale(CACHE_KEY_HIST)) {
      try {
        const r = await fetch("/api/history");
        const d = await r.json();
        if (d.history && d.history.length > 0) {
          setHistData(d.history);
          cacheSet(CACHE_KEY_HIST, d.history);
          st.hist = "ok (" + d.history.length + " days)";
        } else {
          st.hist = "empty";
        }
      } catch (e) {
        st.hist = "fail";
        // keep cached data if fetch failed
      }
    } else {
      st.hist = "cached";
    }

    // /api/dune — only if stale or forced
    if (force || cacheIsStale(CACHE_KEY_DUNE)) {
      try {
        const r = await fetch("/api/dune");
        const d = await r.json();
        if (d.rows && d.rows.length > 0) {
          // Aggregate by date
          const byDate = {};
          for (const row of d.rows) {
            const dt = (row.dt || "").split(" ")[0];
            if (!dt) continue;
            if (!byDate[dt]) byDate[dt] = { dt, borrow: 0, repay: 0 };
            byDate[dt].borrow += row.daily_borrow_usd || 0;
            byDate[dt].repay += row.daily_repay_usd || 0;
          }
          const sorted = Object.values(byDate).sort((a, b) => a.dt < b.dt ? -1 : 1);
          setDuneData(sorted);
          cacheSet(CACHE_KEY_DUNE, sorted);
          st.dune = "ok (" + sorted.length + " days)";
        } else {
          st.dune = "empty";
        }
      } catch (e) {
        st.dune = "fail";
      }
    } else {
      st.dune = "cached";
    }

    return st;
  }, []);

  // ─── Fetch real-time ─────────────────────────────────────
  const fetchRealtime = useCallback(async () => {
    const st = {};
    const results = await Promise.allSettled([
      fetch("https://yields.llama.fi/poolsBorrow").then(r => r.json()),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true").then(r => r.json()),
      fetch("https://api.hyperliquid.xyz/info", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" })
      }).then(r => r.json()),
      fetch("https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=1").then(r => r.json()),
    ]);

    if (results[0].status === "fulfilled" && results[0].value?.data) {
      st.ll = "ok";
      const filtered = results[0].value.data.filter(p => {
        const proj = (p.project || "").toLowerCase();
        const sym = (p.symbol || "").toLowerCase();
        return PROTOCOLS.includes(proj) && STABLES.some(s => sym.includes(s)) && (p.totalBorrowUsd || 0) > 1e6;
      }).map(p => ({
        project: p.project, symbol: p.symbol, chain: p.chain,
        apy: p.apyBaseBorrow || 0, borrow: p.totalBorrowUsd || 0,
        supply: p.totalSupplyUsd || 0,
        util: p.totalSupplyUsd > 0 ? (p.totalBorrowUsd / p.totalSupplyUsd) * 100 : 0,
      })).sort((a, b) => b.borrow - a.borrow);
      setPools(filtered);
    } else st.ll = "fail";

    if (results[1].status === "fulfilled" && results[1].value?.bitcoin) {
      st.cg = "ok"; setBtcMcap(results[1].value.bitcoin.usd_market_cap);
    } else st.cg = "fail";

    if (results[2].status === "fulfilled" && Array.isArray(results[2].value)) {
      st.hl = "ok";
      const [meta, ctx] = results[2].value;
      setHlAssets((meta?.universe || []).map((u, i) => ({
        name: u.name, funding: parseFloat(ctx[i]?.funding || 0),
        oi: parseFloat(ctx[i]?.openInterest || 0), px: parseFloat(ctx[i]?.markPx || 0),
      })));
    } else st.hl = "fail";

    if (results[3].status === "fulfilled" && Array.isArray(results[3].value)) {
      setStableMcapHist(results[3].value.map(d => ({
        dt: new Date(d.date * 1000).toISOString().slice(0, 10),
        val: d.totalCirculating?.peggedUSD || 0,
      })).filter(d => d.val > 0));
    }

    return st;
  }, []);

  // ─── Master fetch ────────────────────────────────────────
  const fetchAll = useCallback(async (force = false) => {
    setLoading(true); setError(null);
    try {
      const [histSt, rtSt] = await Promise.all([fetchHistorical(force), fetchRealtime()]);
      setStatus({ ...histSt, ...rtSt });
      setUpdated(new Date());
    } catch (e) { setError(String(e.message || e)); }
    setLoading(false);
  }, [fetchHistorical, fetchRealtime]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Dune-derived metrics ────────────────────────────────
  const duneMetrics = useMemo(() => {
    if (!duneData || duneData.length < 7) return null;
    const last7 = duneData.slice(-7);
    const prev7 = duneData.slice(-14, -7);
    let b7 = 0, r7 = 0;
    for (const d of last7) { b7 += d.borrow; r7 += d.repay; }
    let bPrev = 0;
    for (const d of prev7) bPrev += d.borrow;
    const avg7 = b7 / 7, avgPrev = prev7.length ? bPrev / prev7.length : avg7;
    return {
      brRatio: r7 > 0 ? b7 / r7 : 1,
      volChange: avgPrev > 0 ? ((avg7 - avgPrev) / avgPrev) * 100 : 0,
      avg7, netFlow7: b7 - r7,
    };
  }, [duneData]);

  // ─── Real-time scores ────────────────────────────────────
  const scores = useMemo(() => {
    if (!pools.length) return null;
    const totalBorrow = pools.reduce((a, p) => a + p.borrow, 0);
    const wRate = totalBorrow > 0 ? pools.reduce((a, p) => a + p.apy * p.borrow, 0) / totalBorrow : 0;

    let btcF = null, ethF = null;
    if (hlAssets) {
      const btc = hlAssets.find(a => a.name === "BTC");
      const eth = hlAssets.find(a => a.name === "ETH");
      if (btc) btcF = btc.funding * 3 * 365 * 100;
      if (eth) ethF = eth.funding * 3 * 365 * 100;
    }
    const avgFund = [btcF, ethF].filter(v => v != null);
    const avgF = avgFund.length ? avgFund.reduce((a, b) => a + b, 0) / avgFund.length : 0;

    let rateZ = 0, fundZ = 0;
    if (histData && histData.length > 60) {
      rateZ = zScoreSingle(wRate, histData.map(d => d.borrowRate));
    } else {
      rateZ = clip((wRate - 6) / 5);
    }
    fundZ = clip((avgF - 10) / 15);
    const l1 = rateZ * 0.55 + fundZ * 0.45;

    const wUtil = totalBorrow > 0 ? pools.reduce((a, p) => a + p.util * p.borrow, 0) / totalBorrow : 0;
    const borrowMcapRatio = btcMcap ? (totalBorrow / btcMcap) * 100 : null;

    let utilZ = 0, borrowZ = 0, mcapZ = 0, stableGrowthZ = 0, brZ = 0;
    if (histData && histData.length > 60) {
      utilZ = zScoreSingle(wUtil, histData.filter(d => d.utilization > 0).map(d => d.utilization));
      borrowZ = zScoreSingle(totalBorrow, histData.filter(d => d.totalBorrow > 0).map(d => d.totalBorrow));
    } else {
      utilZ = clip((wUtil - 72) / 8);
      borrowZ = clip((totalBorrow / 1e9 - 8) / 4);
    }
    if (borrowMcapRatio != null && histData) {
      const histRatios = histData.filter(d => d.borrowMcapRatio != null).map(d => d.borrowMcapRatio);
      mcapZ = histRatios.length > 30 ? zScoreSingle(borrowMcapRatio, histRatios) : clip((borrowMcapRatio - 0.8) / 0.4);
    }
    if (stableMcapHist.length > 30) {
      const recent = stableMcapHist.slice(-1)[0]?.val || 0;
      const prev30 = stableMcapHist.slice(-31, -30)[0]?.val || recent;
      const growth = prev30 > 0 ? ((recent - prev30) / prev30) * 100 : 0;
      stableGrowthZ = clip((growth - 1) / 2);
    }
    // B/R ratio from Dune
    if (duneMetrics) {
      brZ = clip((duneMetrics.brRatio - 1) / 0.15); // mean=1, std=0.15
    }

    const l2 = utilZ * 0.20 + borrowZ * 0.20 + mcapZ * 0.15 + stableGrowthZ * 0.15 + brZ * 0.30;

    let totalOI = 0, oiConc = 0, oiZ = 0, concZ = 0, divZ = 0;
    if (hlAssets) {
      for (const a of hlAssets) totalOI += a.oi * a.px;
      const btcOI = hlAssets.find(a => a.name === "BTC");
      const ethOI = hlAssets.find(a => a.name === "ETH");
      const btcEthOI = (btcOI ? btcOI.oi * btcOI.px : 0) + (ethOI ? ethOI.oi * ethOI.px : 0);
      oiConc = totalOI > 0 ? (btcEthOI / totalOI) * 100 : 0;
      oiZ = clip((totalOI / 1e9 - 12) / 5);
      concZ = clip((55 - oiConc) / 10);
    }
    if (btcF != null && ethF != null) divZ = clip((Math.abs(btcF - ethF) - 8) / 10);
    const l3 = oiZ * 0.40 + concZ * 0.25 + divZ * 0.35;

    const comp = l1 * 0.30 + l2 * 0.40 + l3 * 0.30;
    const heat = zToHeat(comp);

    return { wRate, rateZ, btcF, ethF, avgF, fundZ, l1, wUtil, utilZ, totalBorrow, borrowZ, borrowMcapRatio, mcapZ, stableGrowthZ, brZ, l2, totalOI, oiConc, oiZ, concZ, divZ, l3, comp, heat };
  }, [pools, btcMcap, hlAssets, histData, stableMcapHist, duneMetrics]);

  // ─── Historical time series for charts ───────────────────
  const heatHistory = useMemo(() => {
    if (!histData || histData.length < 60) return null;
    const rates = histData.map(d => d.borrowRate || 0);
    const utils = histData.map(d => d.utilization || 0);
    const borrows = histData.map(d => d.totalBorrow || 0);
    const rZ = zScore(rates, 90), uZ = zScore(utils, 90), bZ = zScore(borrows, 90);

    // If we have Dune data, merge B/R ratio into composite
    const duneMap = {};
    if (duneData) for (const d of duneData) duneMap[d.dt] = d;

    return histData.map((d, i) => {
      let composite = rZ[i] * 0.35 + uZ[i] * 0.30 + bZ[i] * 0.20;
      // Add B/R if available for this date
      const dd = duneMap[d.dt];
      if (dd && dd.repay > 0) {
        const br = dd.borrow / dd.repay;
        const brScore = clip((br - 1) / 0.15);
        composite = composite * (0.85 / 1.0) + brScore * 0.15;
      }
      return { dt: d.dt, val: zToHeat(composite), z: composite };
    });
  }, [histData, duneData]);

  const rateHistory = useMemo(() => {
    if (!histData || histData.length < 30) return null;
    const rates = histData.map(d => d.borrowRate || 0);
    const zs = zScore(rates, 90);
    return histData.map((d, i) => ({ dt: d.dt, val: d.borrowRate || 0, z: zs[i] }));
  }, [histData]);

  const utilHistory = useMemo(() => {
    if (!histData || histData.length < 30) return null;
    const utils = histData.map(d => d.utilization || 0);
    const zs = zScore(utils, 90);
    return histData.map((d, i) => ({ dt: d.dt, val: d.utilization || 0, z: zs[i] }));
  }, [histData]);

  const borrowHistory = useMemo(() => {
    if (!histData || histData.length < 30) return null;
    const borrows = histData.map(d => (d.totalBorrow || 0));
    const zs = zScore(borrows, 90);
    return histData.map((d, i) => ({ dt: d.dt, val: (d.totalBorrow || 0) / 1e9, z: zs[i] }));
  }, [histData]);

  // Dune B/R ratio series
  const brHistory = useMemo(() => {
    if (!duneData || duneData.length < 14) return null;
    const brs = [];
    for (let i = 6; i < duneData.length; i++) {
      let b = 0, r = 0;
      for (let j = i - 6; j <= i; j++) { b += duneData[j].borrow; r += duneData[j].repay; }
      brs.push({ dt: duneData[i].dt, val: r > 0 ? b / r : 1 });
    }
    const vals = brs.map(d => d.val);
    const zs = zScore(vals, 90);
    return brs.map((d, i) => ({ ...d, z: zs[i] }));
  }, [duneData]);

  const signals = useMemo(() => {
    if (!scores) return [];
    const s = [];
    if (scores.rateZ > 1) s.push(`대출금리 과열 (${pct(scores.wRate)}, z=${scores.rateZ.toFixed(1)})`);
    if (scores.rateZ < -1) s.push(`대출금리 저조 (${pct(scores.wRate)})`);
    if (scores.fundZ > 1) s.push(`펀딩 과열 (avg ${pct(scores.avgF)} ann)`);
    if (scores.fundZ < -1) s.push(`펀딩 음수 (avg ${pct(scores.avgF)} ann)`);
    if (scores.utilZ > 1) s.push(`활용률 높음 (${pct(scores.wUtil)})`);
    if (scores.brZ > 1 && duneMetrics) s.push(`순 레버리지 확대 (B/R ${duneMetrics.brRatio.toFixed(2)}x)`);
    if (scores.brZ < -1 && duneMetrics) s.push(`디레버리징 (B/R ${duneMetrics.brRatio.toFixed(2)}x)`);
    if (scores.oiZ > 1) s.push(`OI 상승 ($${fmt(scores.totalOI)})`);
    if (scores.concZ > 1) s.push(`알트 OI 과열 (BTC+ETH ${pct(scores.oiConc, 1)})`);
    if (scores.stableGrowthZ > 1) s.push("스테이블 공급 급증");
    return s;
  }, [scores, duneMetrics]);

  const regime = scores ? regimeLabel(scores.heat) : null;

  // Cache status display
  const cacheInfo = useMemo(() => {
    const h = cacheGet(CACHE_KEY_HIST);
    const d = cacheGet(CACHE_KEY_DUNE);
    const parts = [];
    if (h?.ts) parts.push(`Hist: ${new Date(h.ts).toLocaleTimeString()}`);
    if (d?.ts) parts.push(`Dune: ${new Date(d.ts).toLocaleTimeString()}`);
    return parts.join(" · ");
  }, [updated]);

  return (
    <div style={{ fontFamily: "'JetBrains Mono','IBM Plex Mono','SF Mono',monospace", background: "#f7f7fa", minHeight: "100vh", padding: "16px 14px", color: "#333", fontSize: 13 }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1a2e", letterSpacing: 0.3 }}>
            Leverage Heat Index <span style={{ fontSize: 10, color: "#bbb", fontWeight: 400 }}>v2.1</span>
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>z-score 기반 · DeFiLlama · CoinGecko · Hyperliquid · Dune</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!loading && <div style={{ display: "flex", gap: 4, fontSize: 9 }}>
            {[["LL", status.ll], ["CG", status.cg], ["HL", status.hl], ["HI", status.hist], ["DN", status.dune]].map(([k, v]) => (
              <span key={k} style={{ color: v?.startsWith("ok") || v === "cached" ? "#00b386" : "#ccc", fontWeight: 700 }} title={v}>{k}</span>
            ))}
          </div>}
          {cacheInfo && <span style={{ fontSize: 9, color: "#ccc" }}>{cacheInfo}</span>}
          <button onClick={() => fetchAll(true)} disabled={loading}
            style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: loading ? "wait" : "pointer", color: "#666" }}>
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      {error && <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 12, color: "#c44" }}>{error}</div>}

      {loading && !histData && !scores ? (
        <div style={{ textAlign: "center", padding: 60, color: "#bbb", fontSize: 12 }}>데이터 로딩 중...</div>
      ) : scores ? (
        <>
          {/* Regime */}
          <div style={{ background: "#fff", border: "1px solid #e4e4e8", borderRadius: 8, padding: "14px 16px", marginBottom: 14, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 140 }}>
              <Gauge heat={scores.heat} size={150} />
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>현재 레짐</div>
              <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 6 }}>
                종합 z-score <b style={{ color: scoreColor(scores.comp) }}>{scores.comp > 0 ? "+" : ""}{scores.comp.toFixed(2)}</b> → Heat {scores.heat}/100.
                {scores.heat >= 67 && " 레버리지 과열. 디레버리징 리스크 모니터링."}
                {scores.heat < 45 && scores.heat >= 33 && " 레버리지 축소. 차입 비용 저렴."}
                {scores.heat < 33 && " 완전 디레버리징. 일드 전략 최적 진입."}
                {scores.heat >= 45 && scores.heat < 67 && " 중립~웜업 구간."}
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, padding: "6px 10px", background: regime.color + "08", borderLeft: `3px solid ${regime.color}`, borderRadius: "0 4px 4px 0", marginBottom: 6 }}>
                <b style={{ color: regime.color }}>{regime.icon} {regime.label}</b>
                {" — L1 차입: "}<b style={{ color: scoreColor(scores.l1) }}>{scores.l1 > 0 ? "+" : ""}{scores.l1.toFixed(2)}</b>
                {" · L2 용량: "}<b style={{ color: scoreColor(scores.l2) }}>{scores.l2 > 0 ? "+" : ""}{scores.l2.toFixed(2)}</b>
                {" · L3 투기: "}<b style={{ color: scoreColor(scores.l3) }}>{scores.l3 > 0 ? "+" : ""}{scores.l3.toFixed(2)}</b>
              </div>
              {signals.length > 0 && <div style={{ fontSize: 11, color: "#888", lineHeight: 1.7 }}>
                <b style={{ color: "#aaa" }}>시그널:</b> {signals.map((s, i) => <span key={i} style={{ marginRight: 8 }}>• {s}</span>)}
              </div>}
            </div>
          </div>

          {/* Method note */}
          <div style={{ background: "#fff", border: "1px solid #e4e4e8", borderRadius: 6, padding: "8px 14px", marginBottom: 14, fontSize: 10, color: "#aaa", lineHeight: 1.7 }}>
            <b style={{ color: "#999" }}>v2.1:</b> z-score 정규화 + localStorage 캐싱 (6시간 TTL). 
            히스토리컬: /api/history (DeFiLlama chartLendBorrow — 실제 대출금리/활용률/잔액) + /api/dune (온체인 대출/상환 B/R).
            L1 차입(30%): 대출APY z + 펀딩 z. L2 용량(40%): 활용률 z + 대출규모 z + BTC시총비 z + 스테이블성장 z + <b>B/R비율 z</b>. L3 투기(30%): OI z + 알트집중 z + 펀딩괴리 z.
            <br /><b style={{ color: "#999" }}>캐싱:</b> 히스토리컬/Dune 데이터는 한번 받으면 localStorage에 저장. 6시간 내 재방문 시 캐시 사용 (API 호출 없음). ↻ 버튼으로 강제 새로고침.
          </div>

          {/* Charts */}
          {heatHistory && <HistoryChart data={heatHistory} title="히스토리컬 Heat Score" yLabel="heat" period={heatPeriod} onPeriodChange={setHeatPeriod} />}
          {rateHistory && <HistoryChart data={rateHistory} title="가중평균 대출 APY (%)" yLabel="rate" period={ratePeriod} onPeriodChange={setRatePeriod} />}
          {utilHistory && <HistoryChart data={utilHistory} title="가중 활용률 (%)" yLabel="util" period={ratePeriod} onPeriodChange={setRatePeriod} />}
          {borrowHistory && <HistoryChart data={borrowHistory} title="총 대출 잔액 ($B)" yLabel="borrow" period={ratePeriod} onPeriodChange={setRatePeriod} />}
          {brHistory && <HistoryChart data={brHistory} title="7일 B/R 비율 (Dune 온체인)" yLabel="br" period={ratePeriod} onPeriodChange={setRatePeriod} />}

          {/* Layers */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <LayerBox title="L1 차입 비용" weight={30} z={scores.l1}>
              <MetricCard label="가중 대출 APY" value={pct(scores.wRate)} z={scores.rateZ}
                sub="Aave/Compound/Morpho/Spark/Venus/Radiant/Fluid"
                spark={rateHistory && <Spark data={rateHistory.slice(-30).map(d => d.val)} color="#e05538" />}
                desc="각 풀의 변동 대출 APY를 대출잔액으로 가중평균. 히스토리컬 z-score 사용." />
              <MetricCard label="BTC 펀딩 (연환산)" value={scores.btcF != null ? pct(scores.btcF) : "—"} z={null} sub="Hyperliquid" desc="HL BTC perp 펀딩 × 3 × 365." />
              <MetricCard label="ETH 펀딩 (연환산)" value={scores.ethF != null ? pct(scores.ethF) : "—"} z={null} desc="HL ETH perp 펀딩." />
              <MetricCard label="평균 펀딩" value={pct(scores.avgF)} z={scores.fundZ} desc="BTC+ETH 평균 연환산 펀딩." />
            </LayerBox>

            <LayerBox title="L2 용량 & 흐름" weight={40} z={scores.l2}>
              <MetricCard label="가중 활용률" value={pct(scores.wUtil)} z={scores.utilZ}
                spark={utilHistory && <Spark data={utilHistory.slice(-30).map(d => d.val)} color="#e6922e" baseline={85} />}
                desc="대출/공급 가중평균. 85%↑ 시 kink-point 금리 급등." />
              <MetricCard label="총 대출 잔액" value={"$" + fmt(scores.totalBorrow)} z={scores.borrowZ}
                spark={borrowHistory && <Spark data={borrowHistory.slice(-30).map(d => d.val)} color="#7c8cf5" />}
                desc="시스템 내 레버리지 총량. 히스토리컬 z-score." />
              <MetricCard label="대출/BTC시총" value={scores.borrowMcapRatio != null ? pct(scores.borrowMcapRatio, 3) : "—"} z={scores.mcapZ}
                desc="시장 대비 레버리지 밀도." />
              {duneMetrics && <MetricCard label="B/R 비율 (Dune)" value={duneMetrics.brRatio.toFixed(2) + "x"} z={scores.brZ}
                sub={`7d avg: $${fmt(duneMetrics.avg7)}/day`}
                spark={brHistory && <Spark data={brHistory.slice(-30).map(d => d.val)} color="#00b386" baseline={1} />}
                desc=">1 = 순 레버리지 확대. <1 = 디레버리징. Dune 온체인 대출/상환 트랜잭션." />}
              <MetricCard label="스테이블 공급 성장" z={scores.stableGrowthZ}
                value={scores.stableGrowthZ != null ? `z=${scores.stableGrowthZ.toFixed(1)}` : "—"}
                sub="30일 스테이블 시총 변화"
                spark={stableMcapHist.length > 30 && <Spark data={stableMcapHist.slice(-60).map(d => d.val / 1e9)} color="#00b386" />}
                desc="스테이블 시총 30일 성장률. 급증 = 레버리지 수요 선행." />
            </LayerBox>

            <LayerBox title="L3 투기 OI" weight={30} z={scores.l3}>
              <MetricCard label="HL 총 OI" value={"$" + fmt(scores.totalOI)} z={scores.oiZ} sub="229개 perp" desc="Hyperliquid 전체 미결제약정. 글로벌 ~16% 프록시." />
              <MetricCard label="BTC+ETH OI 집중" value={pct(scores.oiConc, 1)} z={scores.concZ} sub="낮을수록 알트 과열" desc="낮으면 알트 레버리지 폭발 = 과열." />
              <MetricCard label="펀딩 괴리" z={scores.divZ}
                value={scores.btcF != null && scores.ethF != null ? pct(Math.abs(scores.btcF - scores.ethF), 1) : "—"}
                desc="BTC-ETH 펀딩 절대 차이. 큰 괴리 = 시장 스트레스." />
            </LayerBox>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, fontSize: 10, color: "#aaa", flexWrap: "wrap", alignItems: "center" }}>
            {[-3, -2, -1, 0, 1, 2, 3].map(z => (
              <span key={z} style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: 1, background: scoreColor(z) }} />
                <span style={{ color: scoreColor(z), fontWeight: 600 }}>{z > 0 ? "+" : ""}{z}</span>
              </span>
            ))}
            <span style={{ marginLeft: 8, color: "#ccc" }}>z: 0=평균, ±1=1σ, ±2=2σ, ±3=극단</span>
          </div>

          {/* Pool table */}
          <div style={{ background: "#fff", border: "1px solid #e4e4e8", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
            <div onClick={() => setShowPools(!showPools)} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#999", userSelect: "none" }}>
              <span>풀 데이터 · {pools.length} pools</span><span>{showPools ? "▲" : "▼"}</span>
            </div>
            {showPools && <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead><tr style={{ color: "#aaa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                  {["Protocol", "Asset", "Chain", "APY%", "Util%", "Borrows", "Supply"].map(h => <th key={h} style={{ padding: "4px 8px", fontWeight: 500 }}>{h}</th>)}
                </tr></thead>
                <tbody>{pools.slice(0, 30).map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f5f5f7", color: "#555" }}>
                    <td style={{ padding: "3px 8px" }}>{p.project}</td>
                    <td style={{ padding: "3px 8px" }}>{p.symbol}</td>
                    <td style={{ padding: "3px 8px", color: "#bbb" }}>{p.chain}</td>
                    <td style={{ padding: "3px 8px", color: p.apy > 15 ? "#e05538" : "#555" }}>{pct(p.apy)}</td>
                    <td style={{ padding: "3px 8px", color: p.util > 85 ? "#e05538" : "#555" }}>{pct(p.util)}</td>
                    <td style={{ padding: "3px 8px" }}>${fmt(p.borrow)}</td>
                    <td style={{ padding: "3px 8px", color: "#bbb" }}>${fmt(p.supply)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
          </div>

          <div style={{ fontSize: 10, color: "#bbb", lineHeight: 1.8 }}>
            <b style={{ color: "#999" }}>데이터 현황:</b> 히스토리컬 {histData ? histData.length + "일" : "없음"} · Dune {duneData ? duneData.length + "일" : "없음"} · 풀 {pools.length}개
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "#999", fontSize: 12 }}>데이터 없음. ↻ 클릭.</div>
      )}
    </div>
  );
}
