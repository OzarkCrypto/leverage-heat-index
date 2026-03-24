import { useState, useEffect, useCallback, useMemo } from "react";

const PROTOCOLS = ["aave-v3", "compound-v3", "morpho-blue", "aave-v2", "spark"];
const STABLES = ["usdc", "usdt", "dai", "usds"];

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

function fmt(n, d = 1) {
  if (n == null || isNaN(n)) return "\u2014";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d) + "K";
  return n.toFixed(d);
}

function pct(n, d = 2) {
  if (n == null || isNaN(n)) return "\u2014";
  return n.toFixed(d) + "%";
}

function Gauge({ score, size = 150 }) {
  const r = size * 0.36;
  const cx = size / 2, cy = size * 0.5;
  const sA = -210, eA = 30, range = eA - sA;
  const t = (score + 3) / 6;
  const nA = sA + range * t;
  const toR = a => (a * Math.PI) / 180;

  const arc = (a1, a2) => {
    const s = toR(a1), e = toR(a2);
    return `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`;
  };

  const steps = 60;
  const arcPaths = Array.from({ length: steps }, (_, i) => {
    const f = i / steps;
    const a1 = sA + range * f;
    const a2 = sA + range * (f + 1 / steps);
    const v = -3 + 6 * f;
    return <path key={i} d={arc(a1, a2)} stroke={sColor(v)} strokeWidth={5} fill="none" opacity={0.25} />;
  });

  const nd = toR(nA), nl = r * 0.75;

  return (
    <svg width={size} height={size * 0.56} viewBox={`0 0 ${size} ${size * 0.56}`}>
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
  const [loading, setLoading] = useState(true);
  const [pools, setPools] = useState([]);
  const [btcMcap, setBtcMcap] = useState(null);
  const [hlData, setHlData] = useState(null);
  const [ts, setTs] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pR, bR, hR] = await Promise.allSettled([
        fetch("https://yields.llama.fi/pools").then(r => r.json()),
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true").then(r => r.json()),
        fetch("https://api.hyperliquid.xyz/info", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs" })
        }).then(r => r.json()),
      ]);

      if (pR.status === "fulfilled") {
        const d = pR.value?.data || [];
        setPools(d.filter(p =>
          PROTOCOLS.some(pr => p.project?.toLowerCase() === pr) &&
          STABLES.some(s => p.symbol?.toLowerCase().includes(s)) &&
          p.totalBorrowUsd > 1_000_000
        ).map(p => ({
          ...p,
          utilization: p.totalSupplyUsd > 0 ? (p.totalBorrowUsd / p.totalSupplyUsd) * 100 : 0,
          apyBorrow: p.apyBorrow || 0,
        })).sort((a, b) => b.totalBorrowUsd - a.totalBorrowUsd));
      }
      if (bR.status === "fulfilled" && bR.value?.bitcoin) setBtcMcap(bR.value.bitcoin.usd_market_cap);
      if (hR.status === "fulfilled" && Array.isArray(hR.value)) {
        const [meta, ctx] = hR.value;
        setHlData((meta?.universe || []).map((u, i) => ({
          name: u.name,
          funding: parseFloat(ctx[i]?.funding || 0),
          openInterest: parseFloat(ctx[i]?.openInterest || 0),
          markPx: parseFloat(ctx[i]?.markPx || 0),
        })));
      }
      setTs(new Date());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const m = useMemo(() => {
    if (!pools.length) return null;
    const totalW = pools.reduce((s, p) => s + p.totalBorrowUsd, 0);
    const wBR = totalW > 0 ? pools.reduce((s, p) => s + p.apyBorrow * p.totalBorrowUsd, 0) / totalW : 0;
    const brS = scoreLinear(wBR, 3, 7, 20, 45);

    const btcF = hlData?.find(a => a.name === "BTC");
    const ethF = hlData?.find(a => a.name === "ETH");
    const btcFA = btcF ? btcF.funding * 3 * 365 * 100 : null;
    const ethFA = ethF ? ethF.funding * 3 * 365 * 100 : null;
    const fArr = [btcFA, ethFA].filter(x => x != null);
    const fAvg = fArr.length ? fArr.reduce((a, b) => a + b, 0) / fArr.length : 0;
    const fS = scoreLinear(fAvg, -5, 5, 25, 70);
    const l1 = brS * 0.55 + fS * 0.45;

    const wU = totalW > 0 ? pools.reduce((s, p) => s + p.utilization * p.totalBorrowUsd, 0) / totalW : 0;
    const uS = scoreLinear(wU, 55, 72, 87, 95);
    const tB = pools.reduce((s, p) => s + p.totalBorrowUsd, 0);
    const bMR = btcMcap ? (tB / btcMcap) * 100 : null;
    const bMS = bMR != null ? scoreLinear(bMR, 0.2, 0.5, 1.2, 2.5) : 0;
    const bAS = scoreLinear(tB / 1e9, 2, 6, 15, 30);
    const l2 = uS * 0.3 + bMS * 0.3 + bAS * 0.4;

    const tOI = hlData ? hlData.reduce((s, a) => s + a.openInterest * a.markPx, 0) : 0;
    const btcOI = btcF ? btcF.openInterest * btcF.markPx : 0;
    const ethOI = ethF ? ethF.openInterest * ethF.markPx : 0;
    const conc = tOI > 0 ? ((btcOI + ethOI) / tOI) * 100 : 0;
    const cS = tOI > 0 ? scoreLinear(100 - conc, 20, 35, 55, 75) : 0;
    const oiS = tOI > 0 ? scoreLinear(tOI / 1e9, 3, 8, 20, 40) : 0;
    const fDiv = (btcFA != null && ethFA != null) ? Math.abs(btcFA - ethFA) : 0;
    const dS = scoreLinear(fDiv, 2, 8, 25, 60);
    const l3 = oiS * 0.45 + cS * 0.3 + dS * 0.25;

    const comp = l1 * 0.4 + l2 * 0.35 + l3 * 0.25;

    return { wBR, brS, btcFA, ethFA, fAvg, fS, l1, wU, uS, tB, bMR, bMS, bAS, l2, tOI, conc, cS, oiS, fDiv, dS, l3, comp };
  }, [pools, btcMcap, hlData]);

  const f = "'IBM Plex Mono', 'SF Mono', 'Menlo', monospace";

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
            {loading ? "\u00b7\u00b7\u00b7" : "\u21bb"}
          </button>
        </div>
      </div>

      {loading && !m ? (
        <div style={{ textAlign: "center", padding: 40, color: "#bbb" }}>Loading\u2026</div>
      ) : m && (
        <>
          {/* Composite */}
          <div style={{
            background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8,
            padding: "12px 16px 4px", marginBottom: 12,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <Gauge score={m.comp} size={150} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, letterSpacing: 1, fontWeight: 600 }}>LAYER BREAKDOWN</div>
              {[
                ["L1 Borrow Cost", 40, m.l1],
                ["L2 Util / Capacity", 35, m.l2],
                ["L3 OI / Stress", 25, m.l3],
              ].map(([n, w, s]) => (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#888", width: 130 }}>{n} <span style={{ color: "#ccc" }}>({w}%)</span></span>
                  <div style={{ flex: 1, height: 4, background: "#f0f0f2", borderRadius: 2, position: "relative", maxWidth: 120 }}>
                    <div style={{
                      position: "absolute",
                      ...(s < 0
                        ? { right: "50%", width: `${(Math.abs(s) / 3) * 50}%`, borderRadius: "2px 0 0 2px" }
                        : { left: "50%", width: `${(Math.abs(s) / 3) * 50}%`, borderRadius: "0 2px 2px 0" }
                      ),
                      height: "100%", background: sColor(s),
                    }} />
                    <div style={{ position: "absolute", left: "50%", top: -1, width: 1, height: 6, background: "#ddd" }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sColor(s), minWidth: 36, textAlign: "right" }}>
                    {s > 0 ? "+" : ""}{s.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Layers */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <Layer title="L1 \u00b7 Borrow Cost" wt={40} score={m.l1}>
              <Row label="Wtd Borrow Rate" val={pct(m.wBR)} score={m.brS} sub="Aave/Compound/Morpho/Spark" />
              <Row label="BTC Funding (ann)" val={m.btcFA != null ? pct(m.btcFA) : "\u2014"} score={null} sub="Hyperliquid" />
              <Row label="ETH Funding (ann)" val={m.ethFA != null ? pct(m.ethFA) : "\u2014"} score={null} />
              <Row label="Avg Funding" val={pct(m.fAvg)} score={m.fS} />
            </Layer>

            <Layer title="L2 \u00b7 Util & Cap" wt={35} score={m.l2}>
              <Row label="Wtd Utilization" val={pct(m.wU)} score={m.uS} />
              <Row label="Total Borrows" val={"$" + fmt(m.tB)} score={m.bAS} sub="absolute size" />
              <Row label="Borrows / BTC Mcap" val={m.bMR != null ? pct(m.bMR, 3) : "\u2014"} score={m.bMS} sub={btcMcap ? `mcap $${fmt(btcMcap)}` : ""} />
            </Layer>

            <Layer title="L3 \u00b7 OI & Stress" wt={25} score={m.l3}>
              <Row label="HL Total OI" val={"$" + fmt(m.tOI)} score={m.oiS} sub="notional all pairs" />
              <Row label="BTC+ETH OI %" val={pct(m.conc, 1)} score={m.cS} sub="low = alt frenzy" />
              <Row label="BTC-ETH Fund. Div" val={pct(m.fDiv, 1)} score={m.dS} />
            </Layer>
          </div>

          {/* Scale */}
          <div style={{ display: "flex", gap: 2, marginBottom: 10, alignItems: "center", fontSize: 9, color: "#aaa", flexWrap: "wrap" }}>
            {[[-3, "FROZEN"], [-2, "COLD"], [-1, "COOL"], [0, "NEUT"], [1, "WARM"], [2, "HOT"], [3, "EXTR"]].map(([v, l]) => (
              <span key={v} style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 1, background: sColor(v), display: "inline-block" }} />
                <span style={{ color: sColor(v), fontWeight: 600 }}>{v > 0 ? "+" : ""}{v}</span>
                <span>{l}</span>
              </span>
            ))}
          </div>

          {/* Raw Pool Data */}
          <div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 6, overflow: "hidden" }}>
            <div onClick={() => setShowRaw(!showRaw)} style={{
              padding: "8px 12px", cursor: "pointer", display: "flex",
              justifyContent: "space-between", fontSize: 10, color: "#999", userSelect: "none",
            }}>
              <span>Pool Data \u00b7 {pools.length} pools</span>
              <span>{showRaw ? "\u25b2" : "\u25bc"}</span>
            </div>
            {showRaw && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr style={{ color: "#aaa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                      {["Protocol", "Asset", "Chain", "Borrow%", "Util%", "Borrows", "TVL"].map(h => (
                        <th key={h} style={{ padding: "5px 8px", fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pools.slice(0, 30).map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f5f5f7", color: "#555" }}>
                        <td style={{ padding: "4px 8px" }}>{p.project}</td>
                        <td style={{ padding: "4px 8px" }}>{p.symbol?.split("-")?.[0] || p.symbol}</td>
                        <td style={{ padding: "4px 8px", color: "#aaa" }}>{p.chain}</td>
                        <td style={{ padding: "4px 8px", color: p.apyBorrow > 15 ? "#d4522a" : "#555" }}>{pct(p.apyBorrow)}</td>
                        <td style={{ padding: "4px 8px", color: p.utilization > 85 ? "#d4522a" : "#555" }}>{pct(p.utilization)}</td>
                        <td style={{ padding: "4px 8px" }}>${fmt(p.totalBorrowUsd)}</td>
                        <td style={{ padding: "4px 8px", color: "#aaa" }}>${fmt(p.tvlUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 8.5, color: "#bbb", lineHeight: 1.6 }}>
            L1(40%): TVL\uAC00\uC911 borrow rate + perp funding ann. \u00b7 L2(35%): \uAC00\uC911 util + \uC808\uB300 \uB300\uCD9C\uADDC\uBAA8 + \uB300\uCD9C/BTC\uC2DC\uCD1D \u00b7 L3(25%): HL OI + BTC+ETH OI \uC9D1\uC911\uB3C4(inv) + BTC-ETH funding \uAD34\uB9AC
          </div>
        </>
      )}
    </div>
  );
}
