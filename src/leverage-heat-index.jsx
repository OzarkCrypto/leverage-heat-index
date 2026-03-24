import { useState, useEffect, useCallback, useMemo } from "react";

const PROTOCOLS = ["aave-v3", "compound-v3", "compound-v2", "morpho-v1", "sparklend"];
const STABLES = ["usdc", "usdt", "dai", "usds", "usdt0", "susds"];

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
  if (s <= -2) return "FROZEN";
  if (s <= -1) return "COLD";
  if (s <= -0.3) return "COOL";
  if (s <= 0.3) return "NEUTRAL";
  if (s <= 1) return "WARM";
  if (s <= 2) return "HOT";
  return "EXTREME";
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

function Gauge({ score, size }) {
  if (!size) size = 150;
  var r = size * 0.36;
  var cx = size / 2, cy = size * 0.5;
  var sA = -210, eA = 30, range = eA - sA;
  var t = (score + 3) / 6;
  var nA = sA + range * t;
  var toR = function(a) { return (a * Math.PI) / 180; };

  var arc = function(a1, a2) {
    var s = toR(a1), e = toR(a2);
    return "M " + (cx + r * Math.cos(s)) + " " + (cy + r * Math.sin(s)) + " A " + r + " " + r + " 0 " + (a2 - a1 > 180 ? 1 : 0) + " 1 " + (cx + r * Math.cos(e)) + " " + (cy + r * Math.sin(e));
  };

  var steps = 60;
  var arcPaths = Array.from({ length: steps }, function(_, i) {
    var f = i / steps;
    var a1 = sA + range * f;
    var a2 = sA + range * (f + 1 / steps);
    var v = -3 + 6 * f;
    return <path key={i} d={arc(a1, a2)} stroke={sColor(v)} strokeWidth={5} fill="none" opacity={0.25} />;
  });

  var nd = toR(nA), nl = r * 0.75;

  return (
    <svg width={size} height={size * 0.56} viewBox={"0 0 " + size + " " + (size * 0.56)}>
      {arcPaths}
      <line x1={cx} y1={cy} x2={cx + nl * Math.cos(nd)} y2={cy + nl * Math.sin(nd)}
        stroke={sColor(score)} strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={3} fill={sColor(score)} />
      <text x={cx} y={cy + 20} textAnchor="middle" fill={sColor(score)}
        style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--f)" }}>
        {score > 0 ? "+" : ""}{score.toFixed(2)}
      </text>
      <text x={cx} y={cy + 33} textAnchor="middle" fill={sColor(score)}
        style={{ fontSize: 9, fontWeight: 600, fontFamily: "var(--f)", letterSpacing: 1.5 }}>
        {sLabel(score)}
      </text>
    </svg>
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
        <div style={{
          fontSize: 10, fontWeight: 700, color: sColor(score),
          minWidth: 36, textAlign: "right",
          padding: "1px 5px", borderRadius: 3,
          background: sColor(score) + "12",
        }}>
          {score > 0 ? "+" : ""}{score.toFixed(1)}
        </div>
      )}
    </div>
  );
}

function Layer({ title, wt, score, children }) {
  return (
    <div style={{
      border: "1px solid #e8e8ec", borderRadius: 6, padding: "10px 12px",
      flex: "1 1 220px", minWidth: 220, background: "#fff",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
        <span style={{ fontSize: 9, color: "#bbb" }}>{wt}%</span>
      </div>
      {children}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px solid #eee" }}>
        <span style={{ fontSize: 10, color: "#aaa" }}>Layer</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: sColor(score) }}>
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  var _s = useState(true); var loading = _s[0]; var setLoading = _s[1];
  var _e = useState(null); var error = _e[0]; var setError = _e[1];
  var _a = useState({}); var apiStatus = _a[0]; var setApiStatus = _a[1];
  var _p = useState([]); var pools = _p[0]; var setPools = _p[1];
  var _b = useState(null); var btcMcap = _b[0]; var setBtcMcap = _b[1];
  var _h = useState(null); var hlData = _h[0]; var setHlData = _h[1];
  var _t = useState(null); var ts = _t[0]; var setTs = _t[1];
  var _r = useState(false); var showRaw = _r[0]; var setShowRaw = _r[1];

  var fetchAll = useCallback(function() {
    setLoading(true);
    setError(null);
    var status = {};

    Promise.allSettled([
      fetch("https://yields.llama.fi/poolsBorrow").then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true").then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }),
      fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" })
      }).then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }),
    ]).then(function(results) {
      var pR = results[0];
      var bR = results[1];
      var hR = results[2];

      if (pR.status === "fulfilled") {
        status.llama = "ok";
        var d = (pR.value && pR.value.data) ? pR.value.data : [];
        var filtered = [];
        for (var i = 0; i < d.length; i++) {
          var p = d[i];
          var proj = (p.project || "").toLowerCase();
          var sym = (p.symbol || "").toLowerCase();
          var matchProto = PROTOCOLS.indexOf(proj) !== -1;
          var matchStable = false;
          for (var j = 0; j < STABLES.length; j++) {
            if (sym.indexOf(STABLES[j]) !== -1) { matchStable = true; break; }
          }
          var borrowUsd = p.totalBorrowUsd || 0;
          if (matchProto && matchStable && borrowUsd > 1000000) {
            filtered.push({
              project: p.project,
              symbol: p.symbol,
              chain: p.chain,
              tvlUsd: p.tvlUsd || 0,
              apyBorrow: p.apyBaseBorrow || 0,
              totalBorrowUsd: p.totalBorrowUsd || 0,
              totalSupplyUsd: p.totalSupplyUsd || 0,
              utilization: (p.totalSupplyUsd && p.totalSupplyUsd > 0) ? (p.totalBorrowUsd / p.totalSupplyUsd) * 100 : 0,
            });
          }
        }
        filtered.sort(function(a, b) { return b.totalBorrowUsd - a.totalBorrowUsd; });
        setPools(filtered);
      } else {
        status.llama = String((pR.reason && pR.reason.message) || "failed");
      }

      if (bR.status === "fulfilled" && bR.value && bR.value.bitcoin) {
        status.coingecko = "ok";
        setBtcMcap(bR.value.bitcoin.usd_market_cap);
      } else {
        status.coingecko = bR.status === "rejected" ? String((bR.reason && bR.reason.message) || "failed") : "no data";
      }

      if (hR.status === "fulfilled" && Array.isArray(hR.value)) {
        status.hyperliquid = "ok";
        var meta = hR.value[0];
        var ctx = hR.value[1];
        var universe = (meta && meta.universe) ? meta.universe : [];
        var mapped = [];
        for (var k = 0; k < universe.length; k++) {
          mapped.push({
            name: universe[k].name,
            funding: parseFloat((ctx[k] && ctx[k].funding) || 0),
            openInterest: parseFloat((ctx[k] && ctx[k].openInterest) || 0),
            markPx: parseFloat((ctx[k] && ctx[k].markPx) || 0),
          });
        }
        setHlData(mapped);
      } else {
        status.hyperliquid = hR.status === "rejected" ? String((hR.reason && hR.reason.message) || "failed") : "no data";
      }

      setApiStatus(status);
      setTs(new Date());
      setLoading(false);
    }).catch(function(e) {
      setError(String(e.message || e));
      setLoading(false);
    });
  }, []);

  useEffect(function() { fetchAll(); }, [fetchAll]);

  var m = useMemo(function() {
    if (!pools.length) return null;
    var totalW = 0;
    for (var i = 0; i < pools.length; i++) totalW += pools[i].totalBorrowUsd;

    var wBR = 0;
    if (totalW > 0) {
      var sumBR = 0;
      for (var i = 0; i < pools.length; i++) sumBR += pools[i].apyBorrow * pools[i].totalBorrowUsd;
      wBR = sumBR / totalW;
    }
    var brS = scoreLinear(wBR, 3, 7, 20, 45);

    var btcF = null, ethF = null;
    if (hlData) {
      for (var i = 0; i < hlData.length; i++) {
        if (hlData[i].name === "BTC") btcF = hlData[i];
        if (hlData[i].name === "ETH") ethF = hlData[i];
      }
    }
    var btcFA = btcF ? btcF.funding * 3 * 365 * 100 : null;
    var ethFA = ethF ? ethF.funding * 3 * 365 * 100 : null;
    var fArr = [];
    if (btcFA != null) fArr.push(btcFA);
    if (ethFA != null) fArr.push(ethFA);
    var fAvg = fArr.length ? fArr.reduce(function(a, b) { return a + b; }, 0) / fArr.length : 0;
    var fS = scoreLinear(fAvg, -5, 5, 25, 70);
    var l1 = brS * 0.55 + fS * 0.45;

    var wU = 0;
    if (totalW > 0) {
      var sumU = 0;
      for (var i = 0; i < pools.length; i++) sumU += pools[i].utilization * pools[i].totalBorrowUsd;
      wU = sumU / totalW;
    }
    var uS = scoreLinear(wU, 55, 72, 87, 95);
    var tB = totalW;
    var bMR = btcMcap ? (tB / btcMcap) * 100 : null;
    var bMS = bMR != null ? scoreLinear(bMR, 0.2, 0.5, 1.2, 2.5) : 0;
    var bAS = scoreLinear(tB / 1e9, 2, 6, 15, 30);
    var l2 = uS * 0.3 + bMS * 0.3 + bAS * 0.4;

    var tOI = 0;
    if (hlData) {
      for (var i = 0; i < hlData.length; i++) tOI += hlData[i].openInterest * hlData[i].markPx;
    }
    var btcOI = btcF ? btcF.openInterest * btcF.markPx : 0;
    var ethOI = ethF ? ethF.openInterest * ethF.markPx : 0;
    var conc = tOI > 0 ? ((btcOI + ethOI) / tOI) * 100 : 0;
    var cS = tOI > 0 ? scoreLinear(100 - conc, 20, 35, 55, 75) : 0;
    var oiS = tOI > 0 ? scoreLinear(tOI / 1e9, 3, 8, 20, 40) : 0;
    var fDiv = (btcFA != null && ethFA != null) ? Math.abs(btcFA - ethFA) : 0;
    var dS = scoreLinear(fDiv, 2, 8, 25, 60);
    var l3 = oiS * 0.45 + cS * 0.3 + dS * 0.25;

    var comp = l1 * 0.4 + l2 * 0.35 + l3 * 0.25;

    return { wBR: wBR, brS: brS, btcFA: btcFA, ethFA: ethFA, fAvg: fAvg, fS: fS, l1: l1, wU: wU, uS: uS, tB: tB, bMR: bMR, bMS: bMS, bAS: bAS, l2: l2, tOI: tOI, conc: conc, cS: cS, oiS: oiS, fDiv: fDiv, dS: dS, l3: l3, comp: comp };
  }, [pools, btcMcap, hlData]);

  var f = "'IBM Plex Mono', 'SF Mono', 'Menlo', monospace";

  return (
    <div style={{ "--f": f, fontFamily: f, background: "#fafafa", minHeight: "100vh", padding: "16px 14px", color: "#333", fontSize: 12 }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", letterSpacing: 0.3 }}>Leverage Heat Index</div>
          <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>DeFiLlama · CoinGecko · Hyperliquid</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ts && <span style={{ fontSize: 9, color: "#bbb" }}>{ts.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} disabled={loading} style={{
            background: "#fff", border: "1px solid #ddd", borderRadius: 4, padding: "3px 10px",
            fontSize: 10, fontFamily: f, cursor: loading ? "wait" : "pointer", color: "#666",
          }}>
            {loading ? "..." : "\u21bb"}
          </button>
        </div>
      </div>

      {!loading && Object.keys(apiStatus).length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 9 }}>
          {[["DeFiLlama", apiStatus.llama], ["CoinGecko", apiStatus.coingecko], ["Hyperliquid", apiStatus.hyperliquid]].map(function(item) {
            var name = item[0], st = item[1];
            return (
              <span key={name} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: st === "ok" ? "#0ea371" : st ? "#d4522a" : "#ccc",
                  display: "inline-block",
                }} />
                <span style={{ color: st === "ok" ? "#888" : "#d4522a" }}>{name}</span>
                {st && st !== "ok" && <span style={{ color: "#d4522a", fontSize: 8 }}>({st})</span>}
              </span>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 11, color: "#c44" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#bbb", fontSize: 11 }}>
          Fetching data...
        </div>
      ) : !m ? (
        <div style={{ textAlign: "center", padding: 40, color: "#999", fontSize: 11 }}>
          <div style={{ marginBottom: 8 }}>No lending pool data loaded.</div>
          <div style={{ color: "#bbb", fontSize: 10 }}>
            API may be temporarily unavailable. Click refresh to retry.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8,
            padding: "12px 16px 4px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <Gauge score={m.comp} size={150} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, letterSpacing: 1, fontWeight: 600 }}>LAYER BREAKDOWN</div>
              {[["L1 Borrow Cost", 40, m.l1], ["L2 Util / Capacity", 35, m.l2], ["L3 OI / Stress", 25, m.l3]].map(function(item) {
                var n = item[0], w = item[1], s = item[2];
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#888", width: 130 }}>{n} <span style={{ color: "#ccc" }}>({w}%)</span></span>
                    <div style={{ flex: 1, height: 4, background: "#f0f0f2", borderRadius: 2, position: "relative", maxWidth: 120 }}>
                      <div style={{
                        position: "absolute",
                        right: s < 0 ? "50%" : undefined,
                        left: s >= 0 ? "50%" : undefined,
                        width: (Math.abs(s) / 3) * 50 + "%",
                        borderRadius: s < 0 ? "2px 0 0 2px" : "0 2px 2px 0",
                        height: "100%", background: sColor(s),
                      }} />
                      <div style={{ position: "absolute", left: "50%", top: -1, width: 1, height: 6, background: "#ddd" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: sColor(s), minWidth: 36, textAlign: "right" }}>
                      {s > 0 ? "+" : ""}{s.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

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
            </Layer>

            <Layer title="L3 &middot; OI &amp; Stress" wt={25} score={m.l3}>
              <Row label="HL Total OI" val={"$" + fmt(m.tOI)} score={m.oiS} sub="notional all pairs" />
              <Row label="BTC+ETH OI %" val={pct(m.conc, 1)} score={m.cS} sub="low = alt frenzy" />
              <Row label="BTC-ETH Fund. Div" val={pct(m.fDiv, 1)} score={m.dS} />
            </Layer>
          </div>

          <div style={{ display: "flex", gap: 2, marginBottom: 10, alignItems: "center", fontSize: 9, color: "#aaa", flexWrap: "wrap" }}>
            {[[-3, "FROZEN"], [-2, "COLD"], [-1, "COOL"], [0, "NEUT"], [1, "WARM"], [2, "HOT"], [3, "EXTR"]].map(function(item) {
              var v = item[0], l = item[1];
              return (
                <span key={v} style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 1, background: sColor(v), display: "inline-block" }} />
                  <span style={{ color: sColor(v), fontWeight: 600 }}>{v > 0 ? "+" : ""}{v}</span>
                  <span>{l}</span>
                </span>
              );
            })}
          </div>

          <div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 6, overflow: "hidden" }}>
            <div onClick={function() { setShowRaw(!showRaw); }} style={{
              padding: "8px 12px", cursor: "pointer", display: "flex",
              justifyContent: "space-between", fontSize: 10, color: "#999", userSelect: "none",
            }}>
              <span>Pool Data &middot; {pools.length} pools</span>
              <span>{showRaw ? "\u25b2" : "\u25bc"}</span>
            </div>
            {showRaw && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr style={{ color: "#aaa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                      {["Protocol", "Asset", "Chain", "Borrow%", "Util%", "Borrows", "Supply"].map(function(h) {
                        return <th key={h} style={{ padding: "5px 8px", fontWeight: 500 }}>{h}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pools.slice(0, 30).map(function(p, i) {
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f5f5f7", color: "#555" }}>
                          <td style={{ padding: "4px 8px" }}>{p.project}</td>
                          <td style={{ padding: "4px 8px" }}>{p.symbol}</td>
                          <td style={{ padding: "4px 8px", color: "#aaa" }}>{p.chain}</td>
                          <td style={{ padding: "4px 8px", color: p.apyBorrow > 15 ? "#d4522a" : "#555" }}>{pct(p.apyBorrow)}</td>
                          <td style={{ padding: "4px 8px", color: p.utilization > 85 ? "#d4522a" : "#555" }}>{pct(p.utilization)}</td>
                          <td style={{ padding: "4px 8px" }}>{"$" + fmt(p.totalBorrowUsd)}</td>
                          <td style={{ padding: "4px 8px", color: "#aaa" }}>{"$" + fmt(p.totalSupplyUsd)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 8.5, color: "#bbb", lineHeight: 1.6 }}>
            L1(40%): TVL weighted borrow rate + perp funding ann. | L2(35%): weighted util + absolute borrows + borrows/BTC mcap | L3(25%): HL OI + BTC+ETH OI concentration(inv) + BTC-ETH funding divergence
          </div>
        </>
      )}
    </div>
  );
}
