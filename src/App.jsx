import { useState, useEffect, useCallback, useMemo } from "react";

var PROTOCOLS = ["aave-v3", "compound-v3", "compound-v2", "morpho-v1", "sparklend"];
var STABLES = ["usdc", "usdt", "dai", "usds", "usdt0", "susds"];

function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }
function scoreLinear(v, cold, neut, hot, ext) {
  if (v <= cold) return -2;
  if (v <= neut) return lerp(-2, 0, (v - cold) / (neut - cold));
  if (v <= hot) return lerp(0, 2, (v - neut) / (hot - neut));
  if (v <= ext) return lerp(2, 3, (v - hot) / (ext - hot));
  return 3;
}
function sColor(s) {
  if (s <= -1.5) return "#0ea371";
  if (s <= -0.5) return "#4da87a";
  if (s <= 0.5) return "#888";
  if (s <= 1.5) return "#c47a20";
  if (s <= 2.2) return "#d4522a";
  return "#c41830";
}
function sLabel(s) {
  if (s <= -2) return "FROZEN"; if (s <= -1) return "COLD"; if (s <= -0.3) return "COOL";
  if (s <= 0.3) return "NEUTRAL"; if (s <= 1) return "WARM"; if (s <= 2) return "HOT"; return "EXTREME";
}
function fmt(n, d) {
  if (d === undefined) d = 1;
  if (n == null || isNaN(n)) return "\u2014";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d) + "K";
  return n.toFixed(d);
}
function pct(n, d) {
  if (d === undefined) d = 2;
  if (n == null || isNaN(n)) return "\u2014";
  return n.toFixed(d) + "%";
}

// ── Gauge ──
function Gauge({ score, size }) {
  if (!size) size = 150;
  var r = size * 0.36, cx = size / 2, cy = size * 0.5;
  var sA = -210, eA = 30, range = eA - sA;
  var t = (score + 3) / 6, nA = sA + range * t;
  var toR = function(a) { return (a * Math.PI) / 180; };
  var arc = function(a1, a2) {
    var s = toR(a1), e = toR(a2);
    return "M " + (cx + r * Math.cos(s)) + " " + (cy + r * Math.sin(s)) + " A " + r + " " + r + " 0 " + (a2 - a1 > 180 ? 1 : 0) + " 1 " + (cx + r * Math.cos(e)) + " " + (cy + r * Math.sin(e));
  };
  var arcPaths = Array.from({ length: 60 }, function(_, i) {
    var f = i / 60, a1 = sA + range * f, a2 = sA + range * (f + 1 / 60);
    return <path key={i} d={arc(a1, a2)} stroke={sColor(-3 + 6 * f)} strokeWidth={5} fill="none" opacity={0.25} />;
  });
  var nd = toR(nA), nl = r * 0.75;
  return (
    <svg width={size} height={size * 0.56} viewBox={"0 0 " + size + " " + (size * 0.56)}>
      {arcPaths}
      <line x1={cx} y1={cy} x2={cx + nl * Math.cos(nd)} y2={cy + nl * Math.sin(nd)} stroke={sColor(score)} strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3} fill={sColor(score)} />
      <text x={cx} y={cy + 20} textAnchor="middle" fill={sColor(score)} style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--f)" }}>{score > 0 ? "+" : ""}{score.toFixed(2)}</text>
      <text x={cx} y={cy + 33} textAnchor="middle" fill={sColor(score)} style={{ fontSize: 9, fontWeight: 600, fontFamily: "var(--f)", letterSpacing: 1.5 }}>{sLabel(score)}</text>
    </svg>
  );
}

// ── Borrow Volume Chart (SVG) ──
function BorrowChart({ data }) {
  if (!data || data.length < 3) return null;
  var W = 680, H = 160, pad = { t: 10, r: 10, b: 28, l: 50 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var maxB = 0, maxNet = 0, minNet = 0;
  for (var i = 0; i < data.length; i++) {
    if (data[i].borrow > maxB) maxB = data[i].borrow;
    var net = data[i].borrow - data[i].repay;
    if (net > maxNet) maxNet = net;
    if (net < minNet) minNet = net;
  }
  maxB = maxB * 1.1 || 1;
  var netAbs = Math.max(Math.abs(maxNet), Math.abs(minNet)) * 1.2 || 1;

  var borrowPts = [], netPts = [];
  for (var i = 0; i < data.length; i++) {
    var x = pad.l + (i / (data.length - 1)) * cW;
    borrowPts.push(x + "," + (pad.t + cH - (data[i].borrow / maxB) * cH));
    var netVal = data[i].borrow - data[i].repay;
    netPts.push({ x: x, y: pad.t + cH / 2 - (netVal / netAbs) * (cH / 2), val: netVal });
  }

  var borrowArea = "M " + pad.l + "," + (pad.t + cH) + " L " + borrowPts.join(" L ") + " L " + (pad.l + cW) + "," + (pad.t + cH) + " Z";
  var borrowLine = "M " + borrowPts.join(" L ");

  // net flow bars
  var barW = Math.max(2, cW / data.length - 1);
  var netBars = netPts.map(function(p, i) {
    var baseY = pad.t + cH / 2;
    var h = Math.abs(baseY - p.y);
    return <rect key={i} x={p.x - barW / 2} y={p.val >= 0 ? p.y : baseY} width={barW} height={h || 0.5}
      fill={p.val >= 0 ? "#0ea37140" : "#d4522a40"} />;
  });

  // x-axis labels
  var labels = [];
  var step = Math.max(1, Math.floor(data.length / 6));
  for (var i = 0; i < data.length; i += step) {
    var x = pad.l + (i / (data.length - 1)) * cW;
    var d = data[i].dt.split(" ")[0].slice(5);
    labels.push(<text key={i} x={x} y={H - 4} textAnchor="middle" fill="#aaa" style={{ fontSize: 9 }}>{d}</text>);
  }

  // y-axis labels
  var yLabels = [0, maxB / 2, maxB].map(function(v, i) {
    var y = pad.t + cH - (v / maxB) * cH;
    return <text key={i} x={pad.l - 4} y={y + 3} textAnchor="end" fill="#bbb" style={{ fontSize: 9 }}>${fmt(v, 0)}</text>;
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} viewBox={"0 0 " + W + " " + H} style={{ display: "block", maxWidth: "100%" }}>
        <path d={borrowArea} fill="#7c8cf520" />
        <path d={borrowLine} stroke="#7c8cf5" strokeWidth={1.5} fill="none" />
        {netBars}
        <line x1={pad.l} y1={pad.t + cH} x2={pad.l + cW} y2={pad.t + cH} stroke="#e0e0e4" strokeWidth={0.5} />
        {labels}{yLabels}
      </svg>
    </div>
  );
}

function Row({ label, val, score, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "5px 0", gap: 6, borderBottom: "1px solid #f0f0f2" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#222", minWidth: 65, textAlign: "right", whiteSpace: "nowrap" }}>{val}</div>
      {score != null && (
        <div style={{ fontSize: 10, fontWeight: 700, color: sColor(score), minWidth: 36, textAlign: "right", padding: "1px 5px", borderRadius: 3, background: sColor(score) + "12" }}>
          {score > 0 ? "+" : ""}{score.toFixed(1)}
        </div>
      )}
    </div>
  );
}

function Layer({ title, wt, score, children }) {
  return (
    <div style={{ border: "1px solid #e8e8ec", borderRadius: 6, padding: "10px 12px", flex: "1 1 220px", minWidth: 220, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
        <span style={{ fontSize: 9, color: "#bbb" }}>{wt}%</span>
      </div>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px solid #eee" }}>
        <span style={{ fontSize: 10, color: "#aaa" }}>Layer</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: sColor(score) }}>{score > 0 ? "+" : ""}{score.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ═══════════════ MAIN ═══════════════
export default function App() {
  var _s = useState(true), loading = _s[0], setLoading = _s[1];
  var _e = useState(null), error = _e[0], setError = _e[1];
  var _a = useState({}), apiStatus = _a[0], setApiStatus = _a[1];
  var _p = useState([]), pools = _p[0], setPools = _p[1];
  var _b = useState(null), btcMcap = _b[0], setBtcMcap = _b[1];
  var _h = useState(null), hlData = _h[0], setHlData = _h[1];
  var _t = useState(null), ts = _t[0], setTs = _t[1];
  var _r = useState(false), showRaw = _r[0], setShowRaw = _r[1];
  var _d = useState(null), duneData = _d[0], setDuneData = _d[1];
  var _dl = useState(false), duneLoading = _dl[0], setDuneLoading = _dl[1];

  var fetchAll = useCallback(function() {
    setLoading(true); setError(null);
    var status = {};
    Promise.allSettled([
      fetch("https://yields.llama.fi/poolsBorrow").then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true").then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "metaAndAssetCtxs" }) }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
    ]).then(function(results) {
      var pR = results[0], bR = results[1], hR = results[2];
      if (pR.status === "fulfilled") {
        status.llama = "ok";
        var d = (pR.value && pR.value.data) ? pR.value.data : [];
        var filtered = [];
        for (var i = 0; i < d.length; i++) {
          var p = d[i], proj = (p.project || "").toLowerCase(), sym = (p.symbol || "").toLowerCase();
          var matchP = PROTOCOLS.indexOf(proj) !== -1, matchS = false;
          for (var j = 0; j < STABLES.length; j++) { if (sym.indexOf(STABLES[j]) !== -1) { matchS = true; break; } }
          if (matchP && matchS && (p.totalBorrowUsd || 0) > 1000000) {
            filtered.push({ project: p.project, symbol: p.symbol, chain: p.chain, tvlUsd: p.tvlUsd || 0, apyBorrow: p.apyBaseBorrow || 0, totalBorrowUsd: p.totalBorrowUsd || 0, totalSupplyUsd: p.totalSupplyUsd || 0, utilization: (p.totalSupplyUsd > 0) ? (p.totalBorrowUsd / p.totalSupplyUsd) * 100 : 0 });
          }
        }
        filtered.sort(function(a, b) { return b.totalBorrowUsd - a.totalBorrowUsd; });
        setPools(filtered);
      } else { status.llama = String((pR.reason && pR.reason.message) || "failed"); }
      if (bR.status === "fulfilled" && bR.value && bR.value.bitcoin) { status.coingecko = "ok"; setBtcMcap(bR.value.bitcoin.usd_market_cap); }
      else { status.coingecko = bR.status === "rejected" ? String((bR.reason && bR.reason.message) || "failed") : "no data"; }
      if (hR.status === "fulfilled" && Array.isArray(hR.value)) {
        status.hyperliquid = "ok";
        var meta = hR.value[0], ctx = hR.value[1], universe = (meta && meta.universe) ? meta.universe : [], mapped = [];
        for (var k = 0; k < universe.length; k++) { mapped.push({ name: universe[k].name, funding: parseFloat((ctx[k] && ctx[k].funding) || 0), openInterest: parseFloat((ctx[k] && ctx[k].openInterest) || 0), markPx: parseFloat((ctx[k] && ctx[k].markPx) || 0) }); }
        setHlData(mapped);
      } else { status.hyperliquid = hR.status === "rejected" ? String((hR.reason && hR.reason.message) || "failed") : "no data"; }
      setApiStatus(status); setTs(new Date()); setLoading(false);
    }).catch(function(e) { setError(String(e.message || e)); setLoading(false); });
  }, []);

  // Fetch Dune historical data
  var fetchDune = useCallback(function() {
    setDuneLoading(true);
    fetch("/api/dune").then(function(r) { return r.json(); }).then(function(data) {
      if (data.rows) {
        // Aggregate by date
        var byDate = {};
        for (var i = 0; i < data.rows.length; i++) {
          var row = data.rows[i];
          var dt = row.dt.split(" ")[0];
          if (!byDate[dt]) byDate[dt] = { dt: row.dt, borrow: 0, repay: 0, count: 0 };
          byDate[dt].borrow += row.daily_borrow_usd || 0;
          byDate[dt].repay += row.daily_repay_usd || 0;
          byDate[dt].count += row.borrow_count || 0;
        }
        var arr = Object.values(byDate);
        arr.sort(function(a, b) { return a.dt < b.dt ? -1 : 1; });
        setDuneData(arr);
      }
      setDuneLoading(false);
    }).catch(function() { setDuneLoading(false); });
  }, []);

  useEffect(function() { fetchAll(); fetchDune(); }, [fetchAll, fetchDune]);

  // ── Compute Dune metrics ──
  var duneMetrics = useMemo(function() {
    if (!duneData || duneData.length < 7) return null;
    var last7 = duneData.slice(-7);
    var prev7 = duneData.slice(-14, -7);
    var sumB7 = 0, sumR7 = 0, sumBP = 0, sumRP = 0;
    for (var i = 0; i < last7.length; i++) { sumB7 += last7[i].borrow; sumR7 += last7[i].repay; }
    for (var i = 0; i < prev7.length; i++) { sumBP += prev7[i].borrow; sumRP += prev7[i].repay; }
    var avgB7 = sumB7 / 7, avgR7 = sumR7 / 7;
    var avgBP = prev7.length ? sumBP / prev7.length : avgB7;
    var brRatio = sumR7 > 0 ? sumB7 / sumR7 : 1;
    var volChange = avgBP > 0 ? ((avgB7 - avgBP) / avgBP) * 100 : 0;
    var netFlow7 = sumB7 - sumR7;
    return { avgB7: avgB7, avgR7: avgR7, brRatio: brRatio, volChange: volChange, netFlow7: netFlow7 };
  }, [duneData]);

  var m = useMemo(function() {
    if (!pools.length) return null;
    var totalW = 0;
    for (var i = 0; i < pools.length; i++) totalW += pools[i].totalBorrowUsd;
    var wBR = 0;
    if (totalW > 0) { var sumBR = 0; for (var i = 0; i < pools.length; i++) sumBR += pools[i].apyBorrow * pools[i].totalBorrowUsd; wBR = sumBR / totalW; }
    var brS = scoreLinear(wBR, 3, 7, 20, 45);
    var btcF = null, ethF = null;
    if (hlData) { for (var i = 0; i < hlData.length; i++) { if (hlData[i].name === "BTC") btcF = hlData[i]; if (hlData[i].name === "ETH") ethF = hlData[i]; } }
    var btcFA = btcF ? btcF.funding * 3 * 365 * 100 : null;
    var ethFA = ethF ? ethF.funding * 3 * 365 * 100 : null;
    var fArr = []; if (btcFA != null) fArr.push(btcFA); if (ethFA != null) fArr.push(ethFA);
    var fAvg = fArr.length ? fArr.reduce(function(a, b) { return a + b; }, 0) / fArr.length : 0;
    var fS = scoreLinear(fAvg, -5, 5, 25, 70);
    var l1 = brS * 0.55 + fS * 0.45;

    var wU = 0;
    if (totalW > 0) { var sumU = 0; for (var i = 0; i < pools.length; i++) sumU += pools[i].utilization * pools[i].totalBorrowUsd; wU = sumU / totalW; }
    var uS = scoreLinear(wU, 55, 72, 87, 95);
    var tB = totalW;
    var bMR = btcMcap ? (tB / btcMcap) * 100 : null;
    var bMS = bMR != null ? scoreLinear(bMR, 0.2, 0.5, 1.2, 2.5) : 0;
    var bAS = scoreLinear(tB / 1e9, 2, 6, 15, 30);

    // Dune: borrow volume momentum
    var volMomS = 0;
    if (duneMetrics) {
      volMomS = scoreLinear(duneMetrics.volChange, -30, 0, 30, 80);
    }
    var l2 = uS * 0.25 + bMS * 0.25 + bAS * 0.3 + volMomS * 0.2;

    var tOI = 0;
    if (hlData) { for (var i = 0; i < hlData.length; i++) tOI += hlData[i].openInterest * hlData[i].markPx; }
    var btcOI = btcF ? btcF.openInterest * btcF.markPx : 0;
    var ethOI = ethF ? ethF.openInterest * ethF.markPx : 0;
    var conc = tOI > 0 ? ((btcOI + ethOI) / tOI) * 100 : 0;
    var cS = tOI > 0 ? scoreLinear(100 - conc, 20, 35, 55, 75) : 0;
    var oiS = tOI > 0 ? scoreLinear(tOI / 1e9, 3, 8, 20, 40) : 0;
    var fDiv = (btcFA != null && ethFA != null) ? Math.abs(btcFA - ethFA) : 0;
    var dS = scoreLinear(fDiv, 2, 8, 25, 60);

    // Dune: net leverage flow ratio
    var netFlowS = 0;
    if (duneMetrics) {
      // brRatio > 1 = more borrow than repay = leverage expanding
      netFlowS = scoreLinear(duneMetrics.brRatio, 0.7, 0.95, 1.15, 1.5);
    }
    var l3 = oiS * 0.35 + cS * 0.2 + dS * 0.2 + netFlowS * 0.25;

    var comp = l1 * 0.4 + l2 * 0.35 + l3 * 0.25;

    return { wBR: wBR, brS: brS, btcFA: btcFA, ethFA: ethFA, fAvg: fAvg, fS: fS, l1: l1, wU: wU, uS: uS, tB: tB, bMR: bMR, bMS: bMS, bAS: bAS, volMomS: volMomS, l2: l2, tOI: tOI, conc: conc, cS: cS, oiS: oiS, fDiv: fDiv, dS: dS, netFlowS: netFlowS, l3: l3, comp: comp };
  }, [pools, btcMcap, hlData, duneMetrics]);

  var f = "'IBM Plex Mono', 'SF Mono', 'Menlo', monospace";

  return (
    <div style={{ "--f": f, fontFamily: f, background: "#fafafa", minHeight: "100vh", padding: "16px 14px", color: "#333", fontSize: 12 }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", letterSpacing: 0.3 }}>Leverage Heat Index</div>
          <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>DeFiLlama &middot; CoinGecko &middot; Hyperliquid &middot; Dune</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ts && <span style={{ fontSize: 9, color: "#bbb" }}>{ts.toLocaleTimeString()}</span>}
          <button onClick={function() { fetchAll(); fetchDune(); }} disabled={loading} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 4, padding: "3px 10px", fontSize: 10, fontFamily: f, cursor: loading ? "wait" : "pointer", color: "#666" }}>{loading ? "..." : "\u21bb"}</button>
        </div>
      </div>

      {!loading && Object.keys(apiStatus).length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 9 }}>
          {[["DeFiLlama", apiStatus.llama], ["CoinGecko", apiStatus.coingecko], ["Hyperliquid", apiStatus.hyperliquid], ["Dune", duneData ? "ok" : duneLoading ? "loading" : "pending"]].map(function(item) {
            var name = item[0], st = item[1];
            return (<span key={name} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: st === "ok" ? "#0ea371" : st === "loading" || st === "pending" ? "#c47a20" : st ? "#d4522a" : "#ccc", display: "inline-block" }} />
              <span style={{ color: st === "ok" ? "#888" : "#999" }}>{name}</span>
            </span>);
          })}
        </div>
      )}

      {error && <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 11, color: "#c44" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#bbb", fontSize: 11 }}>Fetching data...</div>
      ) : !m ? (
        <div style={{ textAlign: "center", padding: 40, color: "#999", fontSize: 11 }}>
          <div style={{ marginBottom: 8 }}>No lending pool data loaded.</div>
          <div style={{ color: "#bbb", fontSize: 10 }}>API may be temporarily unavailable. Click refresh to retry.</div>
        </div>
      ) : (
        <>
          {/* Composite */}
          <div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "12px 16px 4px", marginBottom: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Gauge score={m.comp} size={150} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, letterSpacing: 1, fontWeight: 600 }}>LAYER BREAKDOWN</div>
              {[["L1 Borrow Cost", 40, m.l1], ["L2 Util / Capacity", 35, m.l2], ["L3 OI / Stress", 25, m.l3]].map(function(item) {
                var n = item[0], w = item[1], s = item[2];
                return (<div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#888", width: 130 }}>{n} <span style={{ color: "#ccc" }}>({w}%)</span></span>
                  <div style={{ flex: 1, height: 4, background: "#f0f0f2", borderRadius: 2, position: "relative", maxWidth: 120 }}>
                    <div style={{ position: "absolute", right: s < 0 ? "50%" : undefined, left: s >= 0 ? "50%" : undefined, width: (Math.abs(s) / 3) * 50 + "%", borderRadius: s < 0 ? "2px 0 0 2px" : "0 2px 2px 0", height: "100%", background: sColor(s) }} />
                    <div style={{ position: "absolute", left: "50%", top: -1, width: 1, height: 6, background: "#ddd" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sColor(s), minWidth: 36, textAlign: "right" }}>{s > 0 ? "+" : ""}{s.toFixed(2)}</span>
                </div>);
              })}
            </div>
          </div>

          {/* Historical Borrow Volume Chart */}
          {duneData && duneData.length > 3 && (
            <div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>90D Stablecoin Borrow Volume (Dune)</span>
                {duneMetrics && <span style={{ fontSize: 9, color: "#888" }}>7d avg: ${fmt(duneMetrics.avgB7)}/day</span>}
              </div>
              <BorrowChart data={duneData} />
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10, color: "#888", flexWrap: "wrap" }}>
                <span><span style={{ display: "inline-block", width: 10, height: 3, background: "#7c8cf5", borderRadius: 1, marginRight: 4 }}></span>Borrow Vol</span>
                <span><span style={{ display: "inline-block", width: 10, height: 8, background: "#0ea37140", borderRadius: 1, marginRight: 4 }}></span>Net Inflow</span>
                <span><span style={{ display: "inline-block", width: 10, height: 8, background: "#d4522a40", borderRadius: 1, marginRight: 4 }}></span>Net Outflow</span>
                {duneMetrics && <>
                  <span>B/R Ratio: <b style={{ color: sColor(m.netFlowS) }}>{duneMetrics.brRatio.toFixed(2)}</b></span>
                  <span>7d Vol \u0394: <b style={{ color: sColor(m.volMomS) }}>{duneMetrics.volChange > 0 ? "+" : ""}{duneMetrics.volChange.toFixed(1)}%</b></span>
                  <span>Net 7d: <b style={{ color: duneMetrics.netFlow7 >= 0 ? "#0ea371" : "#d4522a" }}>${fmt(duneMetrics.netFlow7)}</b></span>
                </>}
              </div>
            </div>
          )}

          {/* 3 Layers */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <Layer title="L1 &middot; Borrow Cost" wt={40} score={m.l1}>
              <Row label="Wtd Borrow Rate" val={pct(m.wBR)} score={m.brS} sub="Aave/Compound/Morpho/Spark" />
              <Row label="BTC Funding (ann)" val={m.btcFA != null ? pct(m.btcFA) : "\u2014"} score={null} sub="Hyperliquid" />
              <Row label="ETH Funding (ann)" val={m.ethFA != null ? pct(m.ethFA) : "\u2014"} score={null} />
              <Row label="Avg Funding" val={pct(m.fAvg)} score={m.fS} />
            </Layer>
            <Layer title="L2 &middot; Util &amp; Cap" wt={35} score={m.l2}>
              <Row label="Wtd Utilization" val={pct(m.wU)} score={m.uS} />
              <Row label="Total Borrows" val={"$" + fmt(m.tB)} score={m.bAS} sub="absolute size" />
              <Row label="Borrows / BTC Mcap" val={m.bMR != null ? pct(m.bMR, 3) : "\u2014"} score={m.bMS} sub={btcMcap ? "mcap $" + fmt(btcMcap) : ""} />
              {duneMetrics && <Row label="7d Vol Momentum" val={(duneMetrics.volChange > 0 ? "+" : "") + duneMetrics.volChange.toFixed(1) + "%"} score={m.volMomS} sub="Dune: borrow vol vs prev 7d" />}
            </Layer>
            <Layer title="L3 &middot; OI &amp; Stress" wt={25} score={m.l3}>
              <Row label="HL Total OI" val={"$" + fmt(m.tOI)} score={m.oiS} sub="notional all pairs" />
              <Row label="BTC+ETH OI %" val={pct(m.conc, 1)} score={m.cS} sub="low = alt frenzy" />
              <Row label="BTC-ETH Fund. Div" val={pct(m.fDiv, 1)} score={m.dS} />
              {duneMetrics && <Row label="Net Leverage Flow" val={duneMetrics.brRatio.toFixed(2) + "x"} score={m.netFlowS} sub="Dune: 7d borrow/repay ratio" />}
            </Layer>
          </div>

          {/* Scale */}
          <div style={{ display: "flex", gap: 2, marginBottom: 10, alignItems: "center", fontSize: 9, color: "#aaa", flexWrap: "wrap" }}>
            {[[-3, "FROZEN"], [-2, "COLD"], [-1, "COOL"], [0, "NEUT"], [1, "WARM"], [2, "HOT"], [3, "EXTR"]].map(function(item) {
              return (<span key={item[0]} style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 1, background: sColor(item[0]), display: "inline-block" }} />
                <span style={{ color: sColor(item[0]), fontWeight: 600 }}>{item[0] > 0 ? "+" : ""}{item[0]}</span>
                <span>{item[1]}</span>
              </span>);
            })}
          </div>

          {/* Raw Pool Data */}
          <div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 6, overflow: "hidden" }}>
            <div onClick={function() { setShowRaw(!showRaw); }} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#999", userSelect: "none" }}>
              <span>Pool Data &middot; {pools.length} pools</span>
              <span>{showRaw ? "\u25b2" : "\u25bc"}</span>
            </div>
            {showRaw && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead><tr style={{ color: "#aaa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                    {["Protocol", "Asset", "Chain", "Borrow%", "Util%", "Borrows", "Supply"].map(function(h) { return <th key={h} style={{ padding: "5px 8px", fontWeight: 500 }}>{h}</th>; })}
                  </tr></thead>
                  <tbody>{pools.slice(0, 30).map(function(p, i) {
                    return (<tr key={i} style={{ borderBottom: "1px solid #f5f5f7", color: "#555" }}>
                      <td style={{ padding: "4px 8px" }}>{p.project}</td>
                      <td style={{ padding: "4px 8px" }}>{p.symbol}</td>
                      <td style={{ padding: "4px 8px", color: "#aaa" }}>{p.chain}</td>
                      <td style={{ padding: "4px 8px", color: p.apyBorrow > 15 ? "#d4522a" : "#555" }}>{pct(p.apyBorrow)}</td>
                      <td style={{ padding: "4px 8px", color: p.utilization > 85 ? "#d4522a" : "#555" }}>{pct(p.utilization)}</td>
                      <td style={{ padding: "4px 8px" }}>{"$" + fmt(p.totalBorrowUsd)}</td>
                      <td style={{ padding: "4px 8px", color: "#aaa" }}>{"$" + fmt(p.totalSupplyUsd)}</td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 8.5, color: "#bbb", lineHeight: 1.6 }}>
            L1(40%): TVL weighted borrow rate + perp funding ann. | L2(35%): weighted util + absolute borrows + borrows/BTC mcap + Dune 7d vol momentum | L3(25%): HL OI + BTC+ETH OI concentration(inv) + BTC-ETH funding divergence + Dune net leverage flow (B/R ratio)
          </div>
        </>
      )}
    </div>
  );
}
