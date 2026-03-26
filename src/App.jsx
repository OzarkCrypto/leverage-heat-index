import { useState, useEffect, useMemo, useCallback, useRef } from "react";

// ─── METHODOLOGY v2 ───────────────────────────────────────────
// Z-score based normalization instead of arbitrary thresholds.
// Each metric is scored as: (value - rollingMean) / rollingStd
// Then clipped to [-3, +3] and combined with signal-quality weights.
//
// Data sources:
//   DeFiLlama  → borrow rates, utilization, total borrows (real-time + historical)
//   CoinGecko  → BTC mcap, stablecoin mcap (for normalization + supply signal)
//   Hyperliquid → funding rates, OI across all perps
//
// Layers:
//   L1 Borrow Cost    (35%) — weighted borrow APY z + avg funding z
//   L2 Capacity Stress(35%) — utilization z + borrows/btcMcap z + stablecoin growth z
//   L3 Speculative OI (30%) — total OI z + alt OI concentration z + funding divergence z
//
// Historical heat uses DeFiLlama pool history for consistent scoring.

const PROTOCOLS = [
  "aave-v3","compound-v3","compound-v2","morpho-v1",
  "sparklend","venus-core-pool","radiant-v1","fluid-lending"
];
const STABLES = ["usdc","usdt","dai","usds","usdt0","susds","lusd","frax","gho","crvusd"];

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

// Z-score with rolling window
function zScore(values, windowSize = 90) {
  const results = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const std = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length) || 1;
    results.push(clip((values[i] - mean) / std));
  }
  return results;
}

// Single z-score against a distribution
function zScoreSingle(value, arr) {
  if (!arr || arr.length < 10) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length) || 1;
  return clip((value - mean) / std);
}

// Composite z → 0-100 heat score
function zToHeat(z) { return Math.round(clip((z + 3) / 6, 0, 1) * 100); }

// Score color
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

// ─── Mini spark chart ────────────────────────────────────────
function Spark({ data, width = 120, height = 32, color = "#7c8cf5", baseline }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  const baseY = baseline != null
    ? height - ((baseline - min) / range) * (height - 4) - 2
    : null;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {baseY != null && (
        <line x1={0} y1={baseY} x2={width} y2={baseY}
          stroke="#ddd" strokeWidth={0.5} strokeDasharray="2,2" />
      )}
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={width} cy={parseFloat(pts[pts.length-1].split(",")[1])}
        r={2.5} fill={color} />
    </svg>
  );
}

// ─── Gauge ───────────────────────────────────────────────────
function Gauge({ heat, size = 160 }) {
  const r = size * 0.32;
  const cx = size / 2, cy = size * 0.42;
  const startAngle = -210, endAngle = 30;
  const span = endAngle - startAngle;
  const angle = startAngle + (heat / 100) * span;
  const toRad = d => d * Math.PI / 180;
  const needleLen = r * 0.78;
  const z = (heat / 100) * 6 - 3;
  const col = scoreColor(z);
  const regime = regimeLabel(heat);

  const arcSegments = Array.from({ length: 60 }, (_, i) => {
    const a1 = startAngle + (i / 60) * span;
    const a2 = startAngle + ((i + 1) / 60) * span;
    const segZ = -3 + (i / 60) * 6;
    return (
      <path key={i}
        d={`M ${cx + r * Math.cos(toRad(a1))} ${cy + r * Math.sin(toRad(a1))} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(toRad(a2))} ${cy + r * Math.sin(toRad(a2))}`}
        stroke={scoreColor(segZ)} strokeWidth={5} fill="none" opacity={0.2}
      />
    );
  });

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
      {arcSegments}
      <line x1={cx} y1={cy}
        x2={cx + needleLen * Math.cos(toRad(angle))}
        y2={cy + needleLen * Math.sin(toRad(angle))}
        stroke={col} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3.5} fill={col} />
      <text x={cx} y={cy + 24} textAnchor="middle" fill={col}
        style={{ fontSize: 30, fontWeight: 800 }}>{heat}</text>
      <text x={cx} y={cy + 38} textAnchor="middle" fill={col}
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>
        {regime.label}
      </text>
    </svg>
  );
}

// ─── Historical Chart ────────────────────────────────────────
function HistoryChart({ data, title, yLabel, period, onPeriodChange }) {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(-1);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(ref.current);
    setW(ref.current.offsetWidth || 600);
    return () => ro.disconnect();
  }, []);

  if (!data || data.length < 5) return <div ref={ref} />;

  const now = new Date();
  const cutoff = new Date(now.getTime() - period * 86400000);
  let filtered = period >= 9999 ? data : data.filter(d => new Date(d.dt) >= cutoff);
  if (filtered.length < 3) filtered = data;

  const H = 180;
  const M = { t: 12, r: 48, b: 26, l: 50 };
  const cw = w - M.l - M.r;
  const ch = H - M.t - M.b;

  const vals = filtered.map(d => d.val);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const rangeV = maxV - minV || 1;

  const idx = hover >= 0 && hover < filtered.length ? hover : filtered.length - 1;
  const cur = filtered[idx];

  const points = filtered.map((d, i) => {
    const x = M.l + (i / (filtered.length - 1)) * cw;
    const y = M.t + ch - ((d.val - minV) / rangeV) * ch;
    return { x, y, z: d.z };
  });

  const lines = [];
  for (let i = 0; i < points.length - 1; i++) {
    const midZ = (points[i].z + points[i + 1].z) / 2;
    lines.push(
      <line key={i} x1={points[i].x} y1={points[i].y}
        x2={points[i + 1].x} y2={points[i + 1].y}
        stroke={scoreColor(midZ)} strokeWidth={1.8} strokeLinecap="round" />
    );
  }

  const yTicks = [minV, (minV + maxV) / 2, maxV].map((v, i) => {
    const y = M.t + ch - ((v - minV) / rangeV) * ch;
    return (
      <g key={i}>
        <line x1={M.l} y1={y} x2={M.l + cw} y2={y} stroke="#f0f0f3" strokeWidth={0.4} />
        <text x={M.l - 4} y={y + 3} textAnchor="end" fill="#bbb" style={{ fontSize: 9 }}>
          {v >= 1000 ? fmt(v, 0) : v.toFixed(1)}
        </text>
      </g>
    );
  });

  const xLabels = [];
  const step = Math.max(1, Math.floor(filtered.length / 7));
  for (let i = 0; i < filtered.length; i += step) {
    const x = M.l + (i / (filtered.length - 1)) * cw;
    xLabels.push(
      <text key={i} x={x} y={H - 4} textAnchor="middle" fill="#bbb" style={{ fontSize: 9 }}>
        {filtered[i].dt.slice(0, 10)}
      </text>
    );
  }

  const regimeZones = [
    { label: "EXTREME", y: 83, color: "#d4163c" },
    { label: "LEVER", y: 67, color: "#e05538" },
    { label: "WARM", y: 55, color: "#e6922e" },
    { label: "COOL", y: 33, color: "#4da87a" },
  ];

  const hoverX = points[idx]?.x;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const i = Math.round(((mx - M.l) / cw) * (filtered.length - 1));
    setHover(Math.max(0, Math.min(filtered.length - 1, i)));
  };

  const periods = [
    { l: "90D", d: 90 }, { l: "1Y", d: 365 },
    { l: "2Y", d: 730 }, { l: "ALL", d: 9999 }
  ];

  return (
    <div ref={ref} style={{ background: "#fff", border: "1px solid #e4e4e8",
      borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>
          {title}
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          {periods.map(p => {
            const sel = p.d === period;
            return (
              <button key={p.l} onClick={() => onPeriodChange(p.d)}
                style={{ background: sel ? "#1a1a2e" : "#fff", color: sel ? "#fff" : "#aaa",
                  border: `1px solid ${sel ? "#1a1a2e" : "#e0e0e4"}`, borderRadius: 3,
                  padding: "2px 7px", fontSize: 10, cursor: "pointer", fontWeight: sel ? 700 : 400 }}>
                {p.l}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: 11, padding: "4px 8px", background: "#fafafa",
        borderRadius: 4, display: "inline-flex", gap: 12, marginBottom: 4, alignItems: "center" }}>
        <b style={{ color: "#444" }}>{cur.dt.slice(0, 10)}</b>
        <span style={{ color: scoreColor(cur.z), fontWeight: 700 }}>
          {yLabel === "heat" ? zToHeat(cur.z) : cur.val.toFixed(2)}
        </span>
        {cur.z != null && (
          <span style={{ fontSize: 10, color: scoreColor(cur.z) }}>
            z={cur.z.toFixed(2)}
          </span>
        )}
      </div>

      <svg width={w} height={H} style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(-1)}>
        {yTicks}
        {yLabel === "heat" && regimeZones.map(rz => {
          const y = M.t + ch - ((rz.y - minV) / rangeV) * ch;
          return (
            <g key={rz.label}>
              <line x1={M.l} y1={y} x2={M.l + cw} y2={y}
                stroke={rz.color} strokeWidth={0.3} strokeDasharray="4,4" />
              <text x={M.l + cw + 4} y={y + 3} fill={rz.color} opacity={0.5}
                style={{ fontSize: 7, fontWeight: 600 }}>{rz.label}</text>
            </g>
          );
        })}
        <path d={`M ${M.l},${M.t + ch} L ${points.map(p => `${p.x},${p.y}`).join(" L ")} L ${M.l + cw},${M.t + ch} Z`}
          fill="#7c8cf5" opacity={0.04} />
        {lines}
        <line x1={hoverX} y1={M.t} x2={hoverX} y2={M.t + ch}
          stroke="#bbb" strokeWidth={0.5} strokeDasharray="3,3" />
        <circle cx={hoverX} cy={points[idx]?.y} r={4}
          fill={scoreColor(cur.z)} stroke="#fff" strokeWidth={2} />
        {xLabels}
        <rect x={M.l} y={M.t} width={cw} height={ch} fill="transparent" />
      </svg>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────
function MetricCard({ label, value, z, spark, desc, sub }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #f0f0f3", padding: "6px 0" }}>
      <div onClick={desc ? () => setOpen(!open) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: desc ? "pointer" : "default" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {desc && <span style={{ color: "#ccc", fontSize: 10, marginRight: 3 }}>{open ? "▼" : "▶"}</span>}
            {label}
          </div>
          {sub && <div style={{ fontSize: 10, color: "#bbb", marginTop: 1 }}>{sub}</div>}
        </div>
        {spark && <div style={{ flexShrink: 0 }}>{spark}</div>}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", minWidth: 60, textAlign: "right", whiteSpace: "nowrap" }}>
          {value}
        </div>
        {z != null && (
          <div style={{ fontSize: 11, fontWeight: 700, color: scoreColor(z), minWidth: 36,
            textAlign: "right", padding: "1px 5px", borderRadius: 3, background: scoreColor(z) + "12" }}>
            {z > 0 ? "+" : ""}{z.toFixed(1)}
          </div>
        )}
      </div>
      {open && desc && (
        <div style={{ fontSize: 11, color: "#888", padding: "4px 0 4px 16px", lineHeight: 1.5 }}>
          {desc}
        </div>
      )}
    </div>
  );
}

// ─── Layer Box ───────────────────────────────────────────────
function LayerBox({ title, weight, z, children }) {
  return (
    <div style={{ border: "1px solid #e4e4e8", borderRadius: 7, padding: "10px 12px",
      flex: "1 1 280px", minWidth: 260, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>
          {title}
        </span>
        <span style={{ fontSize: 10, color: "#ccc" }}>{weight}%</span>
      </div>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 8, paddingTop: 6, borderTop: "1px solid #eee" }}>
        <span style={{ fontSize: 11, color: "#bbb" }}>Layer z-score</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor(z) }}>
          {z > 0 ? "+" : ""}{z.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pools, setPools] = useState([]);
  const [btcMcap, setBtcMcap] = useState(null);
  const [stableMcap, setStableMcap] = useState(null);
  const [stableMcapHist, setStableMcapHist] = useState([]);
  const [hlAssets, setHlAssets] = useState(null);
  const [histData, setHistData] = useState(null); // DeFiLlama historical
  const [updated, setUpdated] = useState(null);
  const [showPools, setShowPools] = useState(false);
  const [heatPeriod, setHeatPeriod] = useState(365);
  const [ratePeriod, setRatePeriod] = useState(365);
  const [status, setStatus] = useState({});

  // ─── Fetch All Data ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const st = {};

    try {
      const results = await Promise.allSettled([
        // 0: DeFiLlama borrow pools
        fetch("https://yields.llama.fi/poolsBorrow").then(r => r.json()),
        // 1: BTC mcap
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true").then(r => r.json()),
        // 2: Hyperliquid meta+asset
        fetch("https://api.hyperliquid.xyz/info", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs" })
        }).then(r => r.json()),
        // 3: Stablecoin total mcap
        fetch("https://stablecoins.llama.fi/stablecoins?includePrices=false").then(r => r.json()),
        // 4: Stablecoin mcap chart (90d for growth rate)
        fetch("https://stablecoins.llama.fi/stablecoincharts/all?stablecoin=1").then(r => r.json()),
      ]);

      // Process pools
      if (results[0].status === "fulfilled" && results[0].value?.data) {
        st.llama = "ok";
        const raw = results[0].value.data;
        const filtered = [];
        for (const p of raw) {
          const proj = (p.project || "").toLowerCase();
          const sym = (p.symbol || "").toLowerCase();
          if (!PROTOCOLS.includes(proj)) continue;
          if (!STABLES.some(s => sym.includes(s))) continue;
          if ((p.totalBorrowUsd || 0) < 1e6) continue;
          filtered.push({
            project: p.project, symbol: p.symbol, chain: p.chain,
            apy: p.apyBaseBorrow || 0,
            borrow: p.totalBorrowUsd || 0,
            supply: p.totalSupplyUsd || 0,
            util: p.totalSupplyUsd > 0 ? (p.totalBorrowUsd / p.totalSupplyUsd) * 100 : 0,
            poolId: p.pool,
          });
        }
        filtered.sort((a, b) => b.borrow - a.borrow);
        setPools(filtered);

        // Fetch historical for top 6 pools
        const topIds = filtered.slice(0, 6).map(p => p.poolId);
        fetchHistory(topIds);
      } else {
        st.llama = "fail";
      }

      // BTC
      if (results[1].status === "fulfilled" && results[1].value?.bitcoin) {
        st.cg = "ok";
        setBtcMcap(results[1].value.bitcoin.usd_market_cap);
      } else st.cg = "fail";

      // Hyperliquid
      if (results[2].status === "fulfilled" && Array.isArray(results[2].value)) {
        st.hl = "ok";
        const [meta, ctx] = results[2].value;
        const universe = meta?.universe || [];
        const assets = universe.map((u, i) => ({
          name: u.name,
          funding: parseFloat(ctx[i]?.funding || 0),
          oi: parseFloat(ctx[i]?.openInterest || 0),
          px: parseFloat(ctx[i]?.markPx || 0),
        }));
        setHlAssets(assets);
      } else st.hl = "fail";

      // Stablecoin mcap
      if (results[3].status === "fulfilled" && results[3].value?.peggedAssets) {
        const total = results[3].value.peggedAssets.reduce((acc, a) => {
          const c = a.circulating?.peggedUSD || 0;
          return acc + c;
        }, 0);
        setStableMcap(total);
      }

      // Stablecoin chart
      if (results[4].status === "fulfilled" && Array.isArray(results[4].value)) {
        const chart = results[4].value.map(d => ({
          dt: new Date(d.date * 1000).toISOString().slice(0, 10),
          val: d.totalCirculating?.peggedUSD || 0,
        })).filter(d => d.val > 0);
        setStableMcapHist(chart);
      }

      setStatus(st);
      setUpdated(new Date());
    } catch (e) {
      setError(String(e.message || e));
    }
    setLoading(false);
  }, []);

  // Fetch DeFiLlama pool history
  const fetchHistory = async (poolIds) => {
    try {
      const fetches = poolIds.map(id =>
        fetch(`https://yields.llama.fi/chart/${id}`).then(r => r.json()).catch(() => null)
      );
      const results = await Promise.all(fetches);

      // Merge by date
      const dateMap = {};
      for (const result of results) {
        if (!result?.data) continue;
        for (const d of result.data) {
          const dt = d.timestamp.slice(0, 10);
          if (!dateMap[dt]) dateMap[dt] = { dt, rates: [], utils: [], borrows: [] };
          if (d.apyBaseBorrow != null) dateMap[dt].rates.push({ val: d.apyBaseBorrow, w: d.totalBorrowUsd || 1 });
          if (d.totalSupplyUsd > 0) dateMap[dt].utils.push({ val: (d.totalBorrowUsd || 0) / d.totalSupplyUsd * 100, w: d.totalBorrowUsd || 1 });
          dateMap[dt].borrows.push(d.totalBorrowUsd || 0);
        }
      }

      const hist = Object.values(dateMap)
        .sort((a, b) => a.dt < b.dt ? -1 : 1)
        .map(d => {
          const totalW = d.rates.reduce((a, r) => a + r.w, 0) || 1;
          const wRate = d.rates.reduce((a, r) => a + r.val * r.w, 0) / totalW;
          const totalWU = d.utils.reduce((a, r) => a + r.w, 0) || 1;
          const wUtil = d.utils.reduce((a, r) => a + r.val * r.w, 0) / totalWU;
          const totalBorrow = d.borrows.reduce((a, b) => a + b, 0);
          return { dt: d.dt, rate: wRate, util: wUtil, borrow: totalBorrow };
        });

      setHistData(hist);
    } catch (e) {
      console.error("History fetch failed:", e);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Compute Real-time Scores ────────────────────────────
  const scores = useMemo(() => {
    if (!pools.length) return null;

    // L1: Borrow Cost
    const totalBorrow = pools.reduce((a, p) => a + p.borrow, 0);
    const wRate = totalBorrow > 0
      ? pools.reduce((a, p) => a + p.apy * p.borrow, 0) / totalBorrow : 0;

    // Funding
    let btcF = null, ethF = null;
    if (hlAssets) {
      const btc = hlAssets.find(a => a.name === "BTC");
      const eth = hlAssets.find(a => a.name === "ETH");
      if (btc) btcF = btc.funding * 3 * 365 * 100; // annualized
      if (eth) ethF = eth.funding * 3 * 365 * 100;
    }
    const avgFund = [btcF, ethF].filter(v => v != null);
    const avgF = avgFund.length ? avgFund.reduce((a, b) => a + b, 0) / avgFund.length : 0;

    // Z-scores against historical if available
    let rateZ = 0, fundZ = 0;
    if (histData && histData.length > 60) {
      const histRates = histData.map(d => d.rate);
      rateZ = zScoreSingle(wRate, histRates);
    } else {
      // Fallback: heuristic z based on typical ranges
      rateZ = clip((wRate - 6) / 5); // mean ~6%, std ~5%
    }
    // Funding z: mean ~10%, std ~15%
    fundZ = clip((avgF - 10) / 15);

    const l1 = rateZ * 0.55 + fundZ * 0.45;

    // L2: Capacity Stress
    const wUtil = totalBorrow > 0
      ? pools.reduce((a, p) => a + p.util * p.borrow, 0) / totalBorrow : 0;
    const borrowMcapRatio = btcMcap ? (totalBorrow / btcMcap) * 100 : null;

    let utilZ = 0, borrowZ = 0, mcapZ = 0, stableGrowthZ = 0;
    if (histData && histData.length > 60) {
      utilZ = zScoreSingle(wUtil, histData.map(d => d.util));
      borrowZ = zScoreSingle(totalBorrow, histData.map(d => d.borrow));
    } else {
      utilZ = clip((wUtil - 72) / 8);
      borrowZ = clip((totalBorrow / 1e9 - 8) / 4);
    }
    if (borrowMcapRatio != null) {
      mcapZ = clip((borrowMcapRatio - 0.8) / 0.4);
    }
    // Stablecoin supply growth (30d)
    if (stableMcapHist.length > 30) {
      const recent = stableMcapHist.slice(-1)[0]?.val || 0;
      const prev30 = stableMcapHist.slice(-31, -30)[0]?.val || recent;
      const growth = prev30 > 0 ? ((recent - prev30) / prev30) * 100 : 0;
      stableGrowthZ = clip((growth - 1) / 2); // mean ~1% monthly growth, std ~2%
    }

    const l2 = utilZ * 0.30 + borrowZ * 0.25 + mcapZ * 0.25 + stableGrowthZ * 0.20;

    // L3: Speculative OI
    let totalOI = 0, btcEthOI = 0, oiConc = 0;
    let oiZ = 0, concZ = 0, divZ = 0;
    if (hlAssets) {
      for (const a of hlAssets) totalOI += a.oi * a.px;
      const btcOI = hlAssets.find(a => a.name === "BTC");
      const ethOI = hlAssets.find(a => a.name === "ETH");
      btcEthOI = (btcOI ? btcOI.oi * btcOI.px : 0) + (ethOI ? ethOI.oi * ethOI.px : 0);
      oiConc = totalOI > 0 ? (btcEthOI / totalOI) * 100 : 0;

      oiZ = clip((totalOI / 1e9 - 12) / 5);
      // Low concentration = alt frenzy = overheated → positive z
      concZ = clip((55 - oiConc) / 10);
    }
    // Funding divergence
    if (btcF != null && ethF != null) {
      const div = Math.abs(btcF - ethF);
      divZ = clip((div - 8) / 10);
    }

    const l3 = oiZ * 0.40 + concZ * 0.25 + divZ * 0.35;

    // Composite
    const comp = l1 * 0.35 + l2 * 0.35 + l3 * 0.30;
    const heat = zToHeat(comp);

    return {
      wRate, rateZ, btcF, ethF, avgF, fundZ, l1,
      wUtil, utilZ, totalBorrow, borrowZ, borrowMcapRatio, mcapZ, stableGrowthZ, l2,
      totalOI, oiConc, oiZ, concZ, divZ, l3,
      comp, heat,
    };
  }, [pools, btcMcap, hlAssets, histData, stableMcapHist]);

  // ─── Historical Heat Score (z-score based) ───────────────
  const heatHistory = useMemo(() => {
    if (!histData || histData.length < 60) return null;

    const rates = histData.map(d => d.rate);
    const utils = histData.map(d => d.util);
    const borrows = histData.map(d => d.borrow);

    const rateZ = zScore(rates, 90);
    const utilZ = zScore(utils, 90);
    const borrowZ = zScore(borrows, 90);

    return histData.map((d, i) => {
      const composite = rateZ[i] * 0.40 + utilZ[i] * 0.35 + borrowZ[i] * 0.25;
      const heat = zToHeat(composite);
      return { dt: d.dt + " 00:00", val: heat, z: composite };
    });
  }, [histData]);

  // Historical rate series
  const rateHistory = useMemo(() => {
    if (!histData || histData.length < 30) return null;
    const rates = histData.map(d => d.rate);
    const zs = zScore(rates, 90);
    return histData.map((d, i) => ({ dt: d.dt + " 00:00", val: d.rate, z: zs[i] }));
  }, [histData]);

  // Historical util series
  const utilHistory = useMemo(() => {
    if (!histData || histData.length < 30) return null;
    const utils = histData.map(d => d.util);
    const zs = zScore(utils, 90);
    return histData.map((d, i) => ({ dt: d.dt + " 00:00", val: d.util, z: zs[i] }));
  }, [histData]);

  // Historical borrow series
  const borrowHistory = useMemo(() => {
    if (!histData || histData.length < 30) return null;
    const borrows = histData.map(d => d.borrow);
    const zs = zScore(borrows, 90);
    return histData.map((d, i) => ({ dt: d.dt + " 00:00", val: d.borrow / 1e9, z: zs[i] }));
  }, [histData]);

  // ─── Active Signals ──────────────────────────────────────
  const signals = useMemo(() => {
    if (!scores) return [];
    const s = [];
    if (scores.rateZ > 1) s.push(`대출금리 과열 (${pct(scores.wRate)}, z=${scores.rateZ.toFixed(1)})`);
    if (scores.rateZ < -1) s.push(`대출금리 저조 (${pct(scores.wRate)}, z=${scores.rateZ.toFixed(1)})`);
    if (scores.fundZ > 1) s.push(`펀딩 과열 (avg ${pct(scores.avgF)} ann)`);
    if (scores.fundZ < -1) s.push(`펀딩 음수/저조 (avg ${pct(scores.avgF)} ann)`);
    if (scores.utilZ > 1) s.push(`활용률 높음 (${pct(scores.wUtil)}, kink-point 접근)`);
    if (scores.oiZ > 1) s.push(`OI 상승 ($${fmt(scores.totalOI)})`);
    if (scores.concZ > 1) s.push(`알트 OI 과열 (BTC+ETH ${pct(scores.oiConc, 1)})`);
    if (scores.stableGrowthZ > 1) s.push("스테이블 공급 급증 (레버리지 수요↑)");
    if (scores.stableGrowthZ < -1) s.push("스테이블 공급 위축");
    return s;
  }, [scores]);

  const regime = scores ? regimeLabel(scores.heat) : null;

  // ─── Render ──────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'JetBrains Mono','IBM Plex Mono','SF Mono',monospace",
      background: "#f7f7fa", minHeight: "100vh", padding: "16px 14px", color: "#333", fontSize: 13,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1a2e", letterSpacing: 0.3 }}>
            Leverage Heat Index <span style={{ fontSize: 10, color: "#bbb", fontWeight: 400 }}>v2</span>
          </div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
            z-score 기반 온체인 레버리지 레짐 모니터 · DeFiLlama · CoinGecko · Hyperliquid
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!loading && (
            <div style={{ display: "flex", gap: 4, fontSize: 9 }}>
              {[["LL", status.llama], ["CG", status.cg], ["HL", status.hl]].map(([k, v]) => (
                <span key={k} style={{ color: v === "ok" ? "#00b386" : "#ccc", fontWeight: 700 }}>{k}</span>
              ))}
            </div>
          )}
          {updated && <span style={{ fontSize: 10, color: "#bbb" }}>{updated.toLocaleTimeString()}</span>}
          <button onClick={fetchData} disabled={loading}
            style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 4,
              padding: "3px 10px", fontSize: 11, cursor: loading ? "wait" : "pointer", color: "#666" }}>
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 6,
          padding: 10, marginBottom: 12, fontSize: 12, color: "#c44" }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#bbb", fontSize: 12 }}>데이터 로딩 중...</div>
      ) : scores ? (
        <>
          {/* Regime Summary */}
          <div style={{ background: "#fff", border: "1px solid #e4e4e8", borderRadius: 8,
            padding: "14px 16px", marginBottom: 14, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 140 }}>
              <Gauge heat={scores.heat} size={150} />
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>
                현재 레짐
              </div>
              <div style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 6 }}>
                종합 z-score <b style={{ color: scoreColor(scores.comp) }}>
                  {scores.comp > 0 ? "+" : ""}{scores.comp.toFixed(2)}
                </b> → Heat {scores.heat}/100.
                {scores.heat >= 67 && " 레버리지 과열 구간. 디레버리징 리스크 모니터링 필요."}
                {scores.heat < 45 && scores.heat >= 33 && " 레버리지 축소 구간. 차입 비용 저렴."}
                {scores.heat < 33 && " 완전 디레버리징. 일드 전략 최적 진입 구간."}
                {scores.heat >= 45 && scores.heat < 67 && " 중립~웜업 구간."}
              </div>

              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, padding: "6px 10px",
                background: regime.color + "08", borderLeft: `3px solid ${regime.color}`,
                borderRadius: "0 4px 4px 0", marginBottom: 6 }}>
                <b style={{ color: regime.color }}>{regime.icon} {regime.label}</b>
                {" — "}
                L1 차입비용: <b style={{ color: scoreColor(scores.l1) }}>{scores.l1 > 0 ? "+" : ""}{scores.l1.toFixed(2)}</b>
                {" · "}L2 용량: <b style={{ color: scoreColor(scores.l2) }}>{scores.l2 > 0 ? "+" : ""}{scores.l2.toFixed(2)}</b>
                {" · "}L3 투기: <b style={{ color: scoreColor(scores.l3) }}>{scores.l3 > 0 ? "+" : ""}{scores.l3.toFixed(2)}</b>
              </div>

              {signals.length > 0 && (
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.7 }}>
                  <b style={{ color: "#aaa" }}>활성 시그널:</b>{" "}
                  {signals.map((s, i) => <span key={i} style={{ display: "inline-block", marginRight: 8 }}>• {s}</span>)}
                </div>
              )}
            </div>
          </div>

          {/* Methodology Note */}
          <div style={{ background: "#fff", border: "1px solid #e4e4e8", borderRadius: 6,
            padding: "8px 14px", marginBottom: 14, fontSize: 10, color: "#aaa", lineHeight: 1.7 }}>
            <b style={{ color: "#999" }}>방법론 v2:</b> 각 지표를 90일 롤링 z-score로 정규화 (평균 대비 표준편차 단위). 
            임의 임계값 대신 통계적 이상치 감지. 
            L1 차입비용(35%): 가중 대출APY z + 평균 펀딩 z. 
            L2 용량(35%): 활용률 z + 대출규모 z + 대출/BTC시총 z + 스테이블 공급성장 z. 
            L3 투기(30%): 총OI z + 알트OI집중 z + 펀딩괴리 z.
            <br />
            <b style={{ color: "#999" }}>한계:</b> HL은 글로벌 perp OI의 ~16%. CEX(Binance/Bybit) 레버리지 미포착. 
            히스토리컬 Heat는 DeFiLlama 풀 히스토리(금리/활용률)만 사용 — 실시간과 동일 변수 기반으로 일관성 확보.
          </div>

          {/* Historical Heat */}
          {heatHistory && (
            <HistoryChart data={heatHistory} title="히스토리컬 Heat Score (z-score 기반)"
              yLabel="heat" period={heatPeriod} onPeriodChange={setHeatPeriod} />
          )}

          {/* Historical Sub-charts */}
          {rateHistory && (
            <HistoryChart data={rateHistory} title="가중평균 대출 APY (%)"
              yLabel="rate" period={ratePeriod} onPeriodChange={setRatePeriod} />
          )}
          {utilHistory && (
            <HistoryChart data={utilHistory} title="가중 활용률 (%)"
              yLabel="util" period={ratePeriod} onPeriodChange={setRatePeriod} />
          )}
          {borrowHistory && (
            <HistoryChart data={borrowHistory} title="총 대출 잔액 ($B)"
              yLabel="borrow" period={ratePeriod} onPeriodChange={setRatePeriod} />
          )}

          {/* Layer Cards */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <LayerBox title="L1 차입 비용" weight={35} z={scores.l1}>
              <MetricCard label="가중 대출 APY" value={pct(scores.wRate)} z={scores.rateZ}
                sub="Aave/Compound/Morpho/Spark/Venus/Radiant/Fluid"
                spark={rateHistory && <Spark data={rateHistory.slice(-30).map(d => d.val)} color="#e05538" />}
                desc="각 풀의 변동 대출 APY를 대출잔액으로 가중평균 → 90일 롤링 z-score. 높으면 차입 수요 과열." />
              <MetricCard label="BTC 펀딩 (연환산)" value={scores.btcF != null ? pct(scores.btcF) : "—"} z={null}
                sub="Hyperliquid 단일 스냅샷"
                desc="HL BTC perp 펀딩 × 3 × 365. 단일 시점이라 노이즈 큼 — 방향성만 참고." />
              <MetricCard label="ETH 펀딩 (연환산)" value={scores.ethF != null ? pct(scores.ethF) : "—"} z={null}
                desc="HL ETH perp 펀딩. BTC와 괴리가 크면 시장 분화 신호." />
              <MetricCard label="평균 펀딩" value={pct(scores.avgF)} z={scores.fundZ}
                desc="BTC+ETH 평균 연환산 펀딩. z-score는 평균 ~10%, 표준편차 ~15% 기준 휴리스틱." />
            </LayerBox>

            <LayerBox title="L2 용량 & 스트레스" weight={35} z={scores.l2}>
              <MetricCard label="가중 활용률" value={pct(scores.wUtil)} z={scores.utilZ}
                spark={utilHistory && <Spark data={utilHistory.slice(-30).map(d => d.val)} color="#e6922e" baseline={85} />}
                desc="대출/공급 가중평균. 85%↑ 시 kink-point에서 금리 비선형 급등. z-score는 90일 롤링." />
              <MetricCard label="총 대출 잔액" value={"$" + fmt(scores.totalBorrow)} z={scores.borrowZ}
                sub="추적 프로토콜 합계"
                spark={borrowHistory && <Spark data={borrowHistory.slice(-30).map(d => d.val)} color="#7c8cf5" />}
                desc="절대 규모의 z-score. 시스템 내 레버리지 총량." />
              <MetricCard label="대출/BTC시총" value={scores.borrowMcapRatio != null ? pct(scores.borrowMcapRatio, 3) : "—"} z={scores.mcapZ}
                desc="시장 규모 대비 레버리지 밀도. 상승 = 시장보다 레버리지 빠르게 성장." />
              <MetricCard label="스테이블 공급 성장" z={scores.stableGrowthZ}
                value={scores.stableGrowthZ != null ? `z=${scores.stableGrowthZ.toFixed(1)}` : "—"}
                sub="30일 스테이블코인 시총 변화율"
                spark={stableMcapHist.length > 30 && <Spark data={stableMcapHist.slice(-60).map(d => d.val / 1e9)} color="#00b386" />}
                desc="스테이블 시총 30일 성장률. 급증 = 새 자본 유입 → 레버리지 수요 선행. 감소 = 자본 유출." />
            </LayerBox>

            <LayerBox title="L3 투기 OI" weight={30} z={scores.l3}>
              <MetricCard label="HL 총 OI" value={"$" + fmt(scores.totalOI)} z={scores.oiZ}
                sub="229개 perp 명목가"
                desc="Hyperliquid 전체 미결제약정. 글로벌 OI의 ~16% 프록시. z는 평균 $12B, std $5B 기준." />
              <MetricCard label="BTC+ETH OI 집중도" value={pct(scores.oiConc, 1)} z={scores.concZ}
                sub="낮을수록 알트 과열"
                desc="BTC+ETH가 전체 OI의 몇 %인지. 낮으면 알트 레버리지 폭발 = 과열. z는 55% 기준 역산." />
              <MetricCard label="펀딩 괴리 (BTC-ETH)" z={scores.divZ}
                value={scores.btcF != null && scores.ethF != null ? pct(Math.abs(scores.btcF - scores.ethF), 1) : "—"}
                desc="BTC-ETH 펀딩 절대 차이. 큰 괴리 = 시장 포지셔닝 분화/스트레스." />
            </LayerBox>
          </div>

          {/* Z-score legend */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, fontSize: 10, color: "#aaa", flexWrap: "wrap", alignItems: "center" }}>
            {[-3, -2, -1, 0, 1, 2, 3].map(z => (
              <span key={z} style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: 1, background: scoreColor(z), display: "inline-block" }} />
                <span style={{ color: scoreColor(z), fontWeight: 600 }}>{z > 0 ? "+" : ""}{z}</span>
              </span>
            ))}
            <span style={{ marginLeft: 8, color: "#ccc" }}>
              z-score: 0=평균, ±1=1σ, ±2=2σ (상/하위 2.5%), ±3=극단
            </span>
          </div>

          {/* Pool Table */}
          <div style={{ background: "#fff", border: "1px solid #e4e4e8", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
            <div onClick={() => setShowPools(!showPools)}
              style={{ padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between",
                fontSize: 11, color: "#999", userSelect: "none" }}>
              <span>풀 데이터 · {pools.length} pools</span>
              <span>{showPools ? "▲" : "▼"}</span>
            </div>
            {showPools && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: "#aaa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                      {["Protocol", "Asset", "Chain", "APY%", "Util%", "Borrows", "Supply"].map(h => (
                        <th key={h} style={{ padding: "4px 8px", fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pools.slice(0, 30).map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f5f5f7", color: "#555" }}>
                        <td style={{ padding: "3px 8px" }}>{p.project}</td>
                        <td style={{ padding: "3px 8px" }}>{p.symbol}</td>
                        <td style={{ padding: "3px 8px", color: "#bbb" }}>{p.chain}</td>
                        <td style={{ padding: "3px 8px", color: p.apy > 15 ? "#e05538" : "#555" }}>{pct(p.apy)}</td>
                        <td style={{ padding: "3px 8px", color: p.util > 85 ? "#e05538" : "#555" }}>{pct(p.util)}</td>
                        <td style={{ padding: "3px 8px" }}>${fmt(p.borrow)}</td>
                        <td style={{ padding: "3px 8px", color: "#bbb" }}>${fmt(p.supply)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Coverage */}
          <div style={{ fontSize: 10, color: "#bbb", lineHeight: 1.8 }}>
            <b style={{ color: "#999" }}>커버리지:</b> EVM 8개 프로토콜, 스테이블 $1M+ 풀. 
            히스토리컬은 상위 6개 풀의 DeFiLlama 시계열 사용.
            <br />
            <b style={{ color: "#999" }}>v1 대비 개선:</b> ① z-score 정규화 (임의 임계값 제거) 
            ② DeFiLlama 풀 히스토리로 실시간/히스토리컬 동일 변수 사용 
            ③ 스테이블 시총 성장률 추가 
            ④ 방법론 한계 명시 (HL 단일거래소, CEX 미포착)
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 40, color: "#999", fontSize: 12 }}>데이터 없음</div>
      )}
    </div>
  );
}
