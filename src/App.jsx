import { useState, useEffect, useCallback, useMemo, useRef } from "react";

function useContainerWidth() {
  var ref = useRef(null);
  var _w = useState(960);
  var w = _w[0], setW = _w[1];
  useEffect(function() {
    if (!ref.current) return;
    var ro = new ResizeObserver(function(entries) {
      var cr = entries[0].contentRect;
      if (cr.width > 0) setW(cr.width);
    });
    ro.observe(ref.current);
    setW(ref.current.offsetWidth || 960);
    return function() { ro.disconnect(); };
  }, []);
  return [ref, w];
}

var LLAMA_PROTOCOLS = ["aave-v3","compound-v3","compound-v2","morpho-v1","sparklend","venus-core-pool","radiant-v1","fluid-lending"];
var STABLES = ["usdc","usdt","dai","usds","usdt0","susds","lusd","frax","gho","crvusd"];

var T = { en: {
  title: "Leverage Heat Index", subtitle: "On-chain leverage demand/supply regime monitor",
  sources: "DeFiLlama \u00b7 CoinGecko \u00b7 Hyperliquid \u00b7 Dune",
  regime: "Current Regime", action: "Implication", signals: "Active Signals",
  chart_title: "Stablecoin Borrow Volume", heat_title: "Historical Leverage Heat Score", heat_desc: "Hover over bars to see leverage conditions on any date. Score computed from borrow volume momentum + trend + borrow/repay ratio.",
  chart_7d: "7d avg", chart_br: "B/R Ratio", chart_wow: "WoW", chart_net: "Net 7d",
  borrow_vol: "Borrow Vol (7d MA)", borrow_vol_exp: "Daily new stablecoin borrow amount, smoothed with 7-day moving average",
  net_inflow: "Net Inflow", net_inflow_exp: "Days where new borrows > repayments = leverage expanding",
  net_outflow: "Net Outflow", net_outflow_exp: "Days where repayments > new borrows = deleveraging",
  cost_title: "Borrow Cost", cap_title: "Utilization & Capacity", risk_title: "OI & Risk",
  pool_data: "Pool Data", pools: "pools", score: "Score",
  protocol: "Protocol", asset: "Asset", chain: "Chain",
  borrow_pct: "Borrow%", util_pct: "Util%", borrows: "Borrows", supply: "Supply",
  coverage: "Coverage", methodology: "Methodology",
  coverage_desc: "~92% of EVM stablecoin lending across 7+ protocols on 6 chains. Auto-updates daily 06:00 UTC.",
  lbl_borrow_rate: "Avg Borrow APY (weighted)", lbl_btc_fund: "BTC Funding (ann)",
  lbl_eth_fund: "ETH Funding (ann)", lbl_avg_fund: "Avg Funding",
  lbl_util: "Pool Utilization (weighted)", lbl_total_borrow: "Total Borrows",
  lbl_borrow_mcap: "Borrows / BTC Mcap", lbl_vol_mom: "7d Vol Momentum",
  lbl_hl_oi: "HL Total OI", lbl_oi_conc: "BTC+ETH OI %",
  lbl_fund_div: "BTC-ETH Funding Divergence", lbl_net_flow: "Net Leverage Flow",
  sub_protocols: "Aave/Compound/Morpho/Spark/Venus/Radiant/Fluid",
  sub_hl: "Hyperliquid", sub_abs: "absolute size", sub_dune: "Dune",
  sub_notional: "notional all pairs", sub_alt: "low = alt frenzy",
  loading: "Fetching data...", no_data: "No data loaded. Click refresh.",
  exp_borrow_rate: "Each pool's variable borrow APY, weighted by borrow outstanding. Represents market-wide cost of borrowing stablecoins. Higher = more demand to borrow = higher leverage demand.",
  exp_btc_funding: "BTC perp funding rate on Hyperliquid (annualized). Paid every 8h between longs/shorts. Positive = longs pay shorts = bullish leverage bias.",
  exp_eth_funding: "ETH perp funding rate on Hyperliquid (annualized). Same mechanics as BTC. Often diverges during alt-season.",
  exp_avg_funding: "Average of BTC + ETH annualized funding. Core directional leverage signal. Sustained >15% historically precedes deleveraging events.",
  exp_util: "Borrows/supply across pools, weighted by borrow size. Above ~85% hits protocol kink points where rates spike non-linearly. High util = available liquidity nearly exhausted.",
  exp_total_borrows: "Sum of all stablecoin borrows across tracked protocols. Raw dollar magnitude of leverage in the system.",
  exp_borrows_mcap: "Total borrows / BTC market cap. Normalizes leverage vs market size. Rising = leverage growing faster than market.",
  exp_vol_mom: "7d avg daily borrow volume vs previous 7d (% change). Positive = borrow activity accelerating. Momentum indicator from Dune on-chain data.",
  exp_hl_oi: "Total notional OI across all 229 Hyperliquid perp pairs. Rising OI = new capital entering leveraged positions.",
  exp_oi_conc: "BTC+ETH share of total OI. Low concentration = alt leverage frenzy = speculative excess that historically precedes corrections.",
  exp_fund_div: "Abs difference between BTC and ETH funding. Large divergence = fragmented/stressed market positioning.",
  exp_net_flow: "7d total borrows / 7d total repayments. >1 = net leverage expansion. <1 = net deleveraging. Clearest on-chain leverage direction signal.",
  reg_extreme: "On-chain leverage at historical highs. Borrow rates, utilization, and speculative positioning all running hot.",
  reg_leveraging: "Market actively adding leverage. Borrow demand above average, funding rates elevated.",
  reg_warming: "Leverage demand picking up from neutral. Early positioning activity.",
  reg_neutral: "Leverage metrics at baseline. No strong directional signal.",
  reg_cooling: "Leverage unwinding. Repayments exceed new borrowing, funding subdued.",
  reg_deleveraged: "Market fully deleveraged. Historically low borrowing and minimal speculation.",
  act_extreme: "Deleveraging risk high. Consider reducing exposure, harvesting yields, preparing for cascade liquidations.",
  act_leveraging: "Yield strong but crowded. Monitor utilization kink-points closely.",
  act_warming: "Good entry for yield strategies. Borrow costs moderate, capacity available.",
  act_neutral: "Standard environment. Focus on protocol-level opportunities.",
  act_cooling: "Cheap borrow. Accumulation opportunity for leveraged yield with low competition.",
  act_deleveraged: "Maximum opportunity. Cheap borrow, empty pools, wide spreads.",
  sig_br_high: "Borrow rates elevated", sig_br_low: "Borrow rates depressed",
  sig_fund_hot: "Perp funding hot", sig_fund_neg: "Perp funding negative",
  sig_util_high: "Utilization high", sig_oi_high: "OI elevated",
  sig_alt_frenzy: "Alt leverage frenzy", sig_expand: "Net leverage expanding",
  sig_delever: "Net deleveraging", sig_vol_surge: "Volume surging", sig_vol_crash: "Volume collapsing",
  metrics_title: "Derived Metrics Timeline",
  metric_br: "7d B/R Ratio (Borrow / Repay)",
  metric_br_desc: "Rolling 7-day borrow/repay ratio. Above 1.0 = leverage expanding. Below 1.0 = deleveraging.",
  metric_mom: "Volume Momentum (7d vs 30d)",
  metric_mom_desc: "7-day avg borrow volume relative to 30-day avg, expressed as %. Positive = accelerating demand.",
  metric_cumflow: "Cumulative Net Leverage Flow",
  metric_cumflow_desc: "Running sum of (borrow - repay) since 2021. Rising = leverage accumulating in the system.",
  metric_heatscore: "Heat Score (0\u2013100)", metric_heatscore_desc: "Composite leverage heat score. Combines 365d rolling percentile (45%), volume momentum (25%), and borrow/repay ratio (30%). Tracks market overheating in real-time.",
  metrics_note: "Borrow rate, utilization, HL OI: real-time only (no historical API). Daily snapshots planned.",
  metrics_api_title: "Historical Metrics (DeFiLlama + CoinGecko + Hyperliquid)",
  metric_rate: "Avg Borrow APY (weighted)", metric_rate_desc: "TVL-weighted average stablecoin borrow rate across top lending pools. From DeFiLlama historical data.",
  metric_util: "Pool Utilization (weighted)", metric_util_desc: "Total borrows / total supply across tracked pools. Above 85% approaches kink-point rate spikes.",
  metric_tborrow: "Total Stablecoin Borrows", metric_tborrow_desc: "Sum of all stablecoin borrow outstanding across Aave, Compound, Morpho, Spark.",
  metric_bmcap: "Borrows / BTC Market Cap (%)", metric_bmcap_desc: "Stablecoin borrows as % of BTC market cap. Measures leverage density vs market size. CoinGecko BTC data (365d).",
  metric_btcfund: "BTC Funding Rate (ann)", metric_btcfund_desc: "BTC perpetual funding rate on Hyperliquid, annualized. Positive = longs pay shorts. 90d history.",
  metric_ethfund: "ETH Funding Rate (ann)", metric_ethfund_desc: "ETH perpetual funding rate on Hyperliquid, annualized. 90d history.",
  regime_method_title: "Regime Classification Methodology",
  regime_method: "The composite score (0\u2013100) is computed from 3 weighted layers. Each layer contains multiple sub-metrics scored on a continuous scale, then combined. The final score determines the current regime.",
  regime_layers: "Layer Weights: Borrow Cost (40%) measures how expensive it is to borrow stablecoins on-chain + perp funding rates. Utilization & Capacity (35%) measures how much of available lending capacity is being used and how fast demand is growing. OI & Risk (25%) measures speculative positioning scale and market stress from derivatives data.",
  regime_thresholds: "Regime Thresholds (score 0\u2013100): DELEVERAGED (0\u201333) = market fully unwound, max opportunity. COOLING (33\u201345) = leverage shrinking, cheap borrow. NEUTRAL (45\u201355) = baseline, no strong signal. WARMING (55\u201367) = early leverage buildup. LEVERAGING UP (67\u201383) = active leverage expansion, crowded. EXTREME (83\u2013100) = historical highs, cascade risk.",
  regime_data_sources: "Data Sources: DeFiLlama (real-time + historical borrow rates, utilization, borrows across 7+ protocols). Dune Analytics (on-chain borrow/repay transaction volumes since 2021). Hyperliquid (funding rates, OI across 229 perp pairs). CoinGecko (BTC price + market cap for normalization).",
}, ko: {
  title: "\uB808\uBC84\uB9AC\uC9C0 \uD788\uD2B8 \uC778\uB371\uC2A4", subtitle: "\uC628\uCCB4\uC778 \uB808\uBC84\uB9AC\uC9C0 \uC218\uC694/\uACF5\uAE09 \uB808\uC9D0 \uBAA8\uB2C8\uD130",
  sources: "DeFiLlama \u00b7 CoinGecko \u00b7 Hyperliquid \u00b7 Dune",
  regime: "\uD604\uC7AC \uB808\uC9D0", action: "\uC2DC\uC0AC\uC810", signals: "\uD65C\uC131 \uC2E0\uD638",
  chart_title: "\uC2A4\uD14C\uC774\uBE14\uCF54\uC778 \uB300\uCD9C \uBCFC\uB968", heat_title: "\uD788\uC2A4\uD1A0\uB9AC\uCEEC \uB808\uBC84\uB9AC\uC9C0 \uD788\uD2B8 \uC2A4\uCF54\uC5B4", heat_desc: "\uB9C8\uC6B0\uC2A4\uB97C \uC62C\uB824\uB193\uC73C\uBA74 \uD574\uB2F9 \uB0A0\uC9DC\uC758 \uB808\uBC84\uB9AC\uC9C0 \uC0C1\uD669\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBCFC\uB968 \uBAA8\uBA58\uD140 + \uCD94\uC138 + \uB300\uCD9C/\uC0C1\uD658 \uBE44\uC728\uC73C\uB85C \uC2A4\uCF54\uC5B4 \uC0B0\uCD9C.",
  chart_7d: "7\uC77C \uD3C9\uADE0", chart_br: "\uB300\uCD9C/\uC0C1\uD658", chart_wow: "\uC804\uC8FC\uBE44", chart_net: "\uC21C 7\uC77C",
  borrow_vol: "\uB300\uCD9C \uBCFC\uB968 (7\uC77C MA)", borrow_vol_exp: "\uC77C\uBCC4 \uC2A4\uD14C\uC774\uBE14 \uC2E0\uADDC \uB300\uCD9C\uAE08\uC758 7\uC77C \uC774\uB3D9\uD3C9\uADE0",
  net_inflow: "\uC21C \uC720\uC785", net_inflow_exp: "\uC2E0\uADDC \uB300\uCD9C > \uC0C1\uD658\uC778 \uB0A0 = \uB808\uBC84\uB9AC\uC9C0 \uC21C\uC99D",
  net_outflow: "\uC21C \uC720\uCD9C", net_outflow_exp: "\uC0C1\uD658 > \uC2E0\uADDC \uB300\uCD9C\uC778 \uB0A0 = \uB514\uB808\uBC84\uB9AC\uC9D5",
  cost_title: "\uCC28\uC785 \uBE44\uC6A9", cap_title: "\uD65C\uC6A9\uB960 & \uC6A9\uB7C9", risk_title: "OI & \uB9AC\uC2A4\uD06C",
  pool_data: "\uD480 \uB370\uC774\uD130", pools: "\uD480", score: "\uC2A4\uCF54\uC5B4",
  protocol: "\uD504\uB85C\uD1A0\uCF5C", asset: "\uC790\uC0B0", chain: "\uCCB4\uC778",
  borrow_pct: "\uB300\uCD9C\uAE08\uB9AC", util_pct: "\uD65C\uC6A9\uB960", borrows: "\uB300\uCD9C\uC561", supply: "\uACF5\uAE09\uC561",
  coverage: "\uCEE4\uBC84\uB9AC\uC9C0", methodology: "\uBC29\uBC95\uB860",
  coverage_desc: "6\uAC1C EVM \uCCB4\uC778, 7\uAC1C+ \uD504\uB85C\uD1A0\uCF5C\uC758 \uC2A4\uD14C\uC774\uBE14 \uB300\uCD9C ~92% \uCEE4\uBC84. \uB9E4\uC77C 06:00 UTC \uC790\uB3D9 \uC5C5\uB370\uC774\uD2B8.",
  lbl_borrow_rate: "\uD3C9\uADE0 \uB300\uCD9C \uAE08\uB9AC (\uAC00\uC911)", lbl_btc_fund: "BTC \uD380\uB529 (\uC5F0\uD658\uC0B0)",
  lbl_eth_fund: "ETH \uD380\uB529 (\uC5F0\uD658\uC0B0)", lbl_avg_fund: "\uD3C9\uADE0 \uD380\uB529",
  lbl_util: "\uD480 \uD65C\uC6A9\uB960 (\uAC00\uC911)", lbl_total_borrow: "\uCD1D \uB300\uCD9C \uC794\uC561",
  lbl_borrow_mcap: "\uB300\uCD9C/BTC \uC2DC\uCD1D", lbl_vol_mom: "7\uC77C \uBCFC\uB968 \uBAA8\uBA58\uD140",
  lbl_hl_oi: "HL \uCD1D \uBBF8\uACB0\uC81C\uC57D\uC815", lbl_oi_conc: "BTC+ETH OI \uBE44\uC911",
  lbl_fund_div: "BTC-ETH \uD380\uB529 \uAD34\uB9AC", lbl_net_flow: "\uC21C \uB808\uBC84\uB9AC\uC9C0 \uD750\uB984",
  sub_protocols: "Aave/Compound/Morpho/Spark/Venus/Radiant/Fluid",
  sub_hl: "Hyperliquid", sub_abs: "\uC808\uB300 \uADDC\uBAA8", sub_dune: "Dune",
  sub_notional: "\uC804\uCCB4 \uD398\uC5B4 \uBA85\uBAA9\uAC00", sub_alt: "\uB0AE\uC744\uC218\uB85D \uC54C\uD2B8 \uACFC\uC5F4",
  loading: "\uB370\uC774\uD130 \uB85C\uB529 \uC911...", no_data: "\uB370\uC774\uD130 \uC5C6\uC74C. \uC0C8\uB85C\uACE0\uCE68 \uD074\uB9AD.",
  exp_borrow_rate: "\uAC01 \uD480\uC758 \uBCC0\uB3D9 \uB300\uCD9C APY\uB97C \uB300\uCD9C \uC794\uC561\uC73C\uB85C \uAC00\uC911\uD3C9\uADE0. \uC2DC\uC7A5 \uC804\uCCB4\uC758 \uB300\uD45C \uCC28\uC785 \uBE44\uC6A9. \uB192\uC73C\uBA74 \uBE4C\uB9AC\uB824\uB294 \uC218\uC694 \uB9CE\uC74C = \uB808\uBC84\uB9AC\uC9C0 \uC218\uC694 \uB192\uC74C.",
  exp_btc_funding: "Hyperliquid BTC \uD380\uB529(\uC5F0\uD658\uC0B0). 8\uC2DC\uAC04\uB9C8\uB2E4 \uB871/\uC219 \uAC04 \uC9C0\uBD88. \uC591\uC218=\uB871\u2192\uC219 \uC9C0\uBD88(\uAC15\uC138 \uD3B8\uD5A5). \uC74C\uC218=\uC219\u2192\uB871 \uC9C0\uBD88(\uC57D\uC138).",
  exp_eth_funding: "Hyperliquid ETH \uD380\uB529(\uC5F0\uD658\uC0B0). BTC\uC640 \uB3D9\uC77C \uBA54\uCEE4\uB2C8\uC998. \uC54C\uD2B8\uC2DC\uC98C\uC774\uB098 ETH \uD2B9\uC815 \uC774\uBCA4\uD2B8 \uC2DC BTC\uC640 \uAD34\uB9AC \uBC1C\uC0DD.",
  exp_avg_funding: "BTC+ETH \uD3C9\uADE0 \uC5F0\uD658\uC0B0 \uD380\uB529. \uD575\uC2EC \uBC29\uD5A5\uC131 \uB808\uBC84\uB9AC\uC9C0 \uC2E0\uD638. >15% \uC9C0\uC18D\uC2DC \uB514\uB808\uBC84\uB9AC\uC9D5 \uC774\uBCA4\uD2B8\uC5D0 \uC120\uD589.",
  exp_util: "\uB300\uCD9C/\uACF5\uAE09 \uBE44\uC728(\uAC00\uC911\uD3C9\uADE0). ~85% \uC774\uC0C1\uC774\uBA74 kink point \u2192 \uAE08\uB9AC \uBE44\uC120\uD615 \uAE09\uB4F1. \uB192\uC740 \uD65C\uC6A9\uB960 = \uAC00\uC6A9 \uC720\uB3D9\uC131 \uC18C\uC9C4.",
  exp_total_borrows: "\uCD94\uC801 \uD504\uB85C\uD1A0\uCF5C \uC804\uCCB4 \uC2A4\uD14C\uC774\uBE14 \uB300\uCD9C \uC794\uC561 \uD569\uACC4. \uC2DC\uC2A4\uD15C \uB0B4 \uB808\uBC84\uB9AC\uC9C0\uC758 \uC808\uB300 \uB2EC\uB7EC \uADDC\uBAA8.",
  exp_borrows_mcap: "\uC2A4\uD14C\uC774\uBE14 \uB300\uCD9C/BTC \uC2DC\uCD1D. \uC2DC\uC7A5 \uB300\uBE44 \uB808\uBC84\uB9AC\uC9C0 \uC815\uADDC\uD654. \uC624\uB974\uBA74 \uC2DC\uC7A5\uBCF4\uB2E4 \uB808\uBC84\uB9AC\uC9C0\uAC00 \uBE60\uB974\uAC8C \uC131\uC7A5.",
  exp_vol_mom: "7\uC77C \uD3C9\uADE0 \uC77C\uC77C \uB300\uCD9C\uB7C9 vs \uC774\uC804 7\uC77C (% \uBCC0\uD654). \uC591\uC218=\uB300\uCD9C \uAC00\uC18D. Dune \uC628\uCCB4\uC778 \uB370\uC774\uD130.",
  exp_hl_oi: "Hyperliquid 229\uAC1C \uC790\uC0B0 \uCD1D \uBBF8\uACB0\uC81C\uC57D\uC815 \uBA85\uBAA9\uAC00. OI\uC0C1\uC2B9=\uC0C8 \uC790\uBCF8 \uB808\uBC84\uB9AC\uC9C0 \uC9C4\uC785.",
  exp_oi_conc: "BTC+ETH OI \uBE44\uC911. \uB0AE\uC73C\uBA74 \uC54C\uD2B8 \uB808\uBC84\uB9AC\uC9C0 \uD3ED\uBC1C = \uC870\uC815 \uC120\uD589 \uC2E0\uD638.",
  exp_fund_div: "BTC-ETH \uD380\uB529 \uAD34\uB9AC \uC808\uB300\uAC12. \uD070 \uAD34\uB9AC = \uC2DC\uC7A5 \uBD84\uD654/\uC2A4\uD2B8\uB808\uC2A4.",
  exp_net_flow: "7\uC77C \uB300\uCD9C/\uC0C1\uD658 \uBE44\uC728. >1=\uC21C \uB808\uBC84\uB9AC\uC9C0 \uD655\uB300. <1=\uC21C \uB514\uB808\uBC84\uB9AC\uC9D5. Dune \uAE30\uBC18.",
  reg_extreme: "\uC628\uCCB4\uC778 \uB808\uBC84\uB9AC\uC9C0 \uC5ED\uC0AC\uC801 \uACE0\uC810. \uB300\uCD9C \uAE08\uB9AC, \uD65C\uC6A9\uB960, \uD22C\uAE30\uC801 \uD3EC\uC9C0\uC158\uB2DD \uBAA8\uB450 \uACFC\uC5F4.",
  reg_leveraging: "\uC2DC\uC7A5\uC774 \uC801\uADF9\uC801\uC73C\uB85C \uB808\uBC84\uB9AC\uC9C0 \uCD94\uAC00 \uC911. \uB300\uCD9C \uC218\uC694 \uD3C9\uADE0 \uC774\uC0C1, \uD380\uB529 \uC0C1\uC2B9.",
  reg_warming: "\uB808\uBC84\uB9AC\uC9C0 \uC218\uC694 \uC911\uB9BD\uC5D0\uC11C \uD68C\uBCF5 \uC911. \uD3EC\uC9C0\uC154\uB2DD \uCD08\uAE30 \uC9D5\uD6C4.",
  reg_neutral: "\uB808\uBC84\uB9AC\uC9C0 \uC9C0\uD45C \uAE30\uC900\uC120. \uAC15\uD55C \uBC29\uD5A5\uC131 \uC2E0\uD638 \uC5C6\uC74C.",
  reg_cooling: "\uB808\uBC84\uB9AC\uC9C0 \uD574\uC18C \uC911. \uC0C1\uD658\uC774 \uC2E0\uADDC \uB300\uCD9C \uCD08\uACFC, \uD380\uB529 \uC800\uC870.",
  reg_deleveraged: "\uC2DC\uC7A5 \uC644\uC804 \uB514\uB808\uBC84\uB9AC\uC9D5. \uC5ED\uC0AC\uC801 \uC800\uC810\uC758 \uCC28\uC785 \uD65C\uB3D9.",
  act_extreme: "\uB514\uB808\uBC84\uB9AC\uC9D5 \uB9AC\uC2A4\uD06C \uB192\uC74C. \uC775\uC2A4\uD3EC\uC838 \uCD95\uC18C, \uC218\uC775 \uD655\uC815, \uCE90\uC2A4\uCF00\uC774\uB4DC \uCCAD\uC0B0 \uB300\uBE44.",
  act_leveraging: "\uC77C\uB4DC \uAE30\uD68C \uAC15\uD558\uC9C0\uB9CC \uD63C\uC7A1. kink-point \uBAA8\uB2C8\uD130\uB9C1 \uD544\uC218.",
  act_warming: "\uC77C\uB4DC \uC804\uB7B5 \uC9C4\uC785 \uC88B\uC740 \uC2DC\uC810. \uB300\uCD9C \uBE44\uC6A9 \uC801\uC815, \uC6A9\uB7C9 \uC5EC\uC720.",
  act_neutral: "\uD45C\uC900 \uC6B4\uC6A9. \uD504\uB85C\uD1A0\uCF5C \uB808\uBCA8 \uAE30\uD68C\uC5D0 \uC9D1\uC911.",
  act_cooling: "\uCC28\uC785 \uBE44\uC6A9 \uC800\uB834. \uACBD\uC7C1 \uC801\uC740 \uD658\uACBD\uC5D0\uC11C \uB808\uBC84\uB9AC\uC9C0 \uC77C\uB4DC \uCD95\uC801 \uAE30\uD68C.",
  act_deleveraged: "\uCD5C\uB300 \uAE30\uD68C. \uC800\uB834\uD55C \uB300\uCD9C, \uBE48 \uD480, \uB113\uC740 \uC2A4\uD504\uB808\uB4DC.",
  sig_br_high: "\uB300\uCD9C \uAE08\uB9AC \uC0C1\uC2B9", sig_br_low: "\uB300\uCD9C \uAE08\uB9AC \uD558\uB77D",
  sig_fund_hot: "\uD380\uB529 \uACFC\uC5F4", sig_fund_neg: "\uD380\uB529 \uC74C\uC218",
  sig_util_high: "\uD65C\uC6A9\uB960 \uB192\uC74C", sig_oi_high: "OI \uC0C1\uC2B9",
  sig_alt_frenzy: "\uC54C\uD2B8 \uB808\uBC84\uB9AC\uC9C0 \uD3ED\uBC1C", sig_expand: "\uC21C \uB808\uBC84\uB9AC\uC9C0 \uD655\uB300",
  sig_delever: "\uC21C \uB514\uB808\uBC84\uB9AC\uC9D5", sig_vol_surge: "\uBCFC\uB968 \uAE09\uC99D", sig_vol_crash: "\uBCFC\uB968 \uAE09\uAC10",
  metrics_title: "\uD30C\uC0DD \uC9C0\uD45C \uC2DC\uACC4\uC5F4",
  metric_br: "7\uC77C \uB300\uCD9C/\uC0C1\uD658 \uBE44\uC728",
  metric_br_desc: "\uB864\uB9C1 7\uC77C \uB300\uCD9C/\uC0C1\uD658 \uBE44\uC728. 1.0 \uC774\uC0C1 = \uB808\uBC84\uB9AC\uC9C0 \uD655\uB300. 1.0 \uBBF8\uB9CC = \uB514\uB808\uBC84\uB9AC\uC9D5.",
  metric_mom: "\uBCFC\uB968 \uBAA8\uBA58\uD140 (7\uC77C/30\uC77C)",
  metric_mom_desc: "7\uC77C \uD3C9\uADE0 \uB300\uCD9C\uB7C9\uC758 30\uC77C \uD3C9\uADE0 \uB300\uBE44 % \uBCC0\uD654. \uC591\uC218 = \uC218\uC694 \uAC00\uC18D.",
  metric_cumflow: "\uB204\uC801 \uC21C \uB808\uBC84\uB9AC\uC9C0 \uD750\uB984",
  metric_cumflow_desc: "2021\uB144\uBD80\uD130 (\uB300\uCD9C - \uC0C1\uD658) \uB204\uC801\uD569. \uC0C1\uC2B9 = \uC2DC\uC2A4\uD15C\uC5D0 \uB808\uBC84\uB9AC\uC9C0 \uCD95\uC801.",
  metric_heatscore: "\uD788\uD2B8 \uC2A4\uCF54\uC5B4 (0\u2013100)", metric_heatscore_desc: "\uBCF5\uD569 \uB808\uBC84\uB9AC\uC9C0 \uACFC\uC5F4 \uC9C0\uC218. 365\uC77C \uB864\uB9C1 \uD37C\uC13C\uD0C0\uC77C(45%) + \uBCFC\uB968 \uBAA8\uBA58\uD140(25%) + \uB300\uCD9C/\uC0C1\uD658 \uBE44\uC728(30%) \uACB0\uD569. \uC2DC\uC7A5 \uACFC\uC5F4 \uC2E4\uC2DC\uAC04 \uCD94\uC801.",
  metrics_note: "\uB300\uCD9C \uAE08\uB9AC, \uD65C\uC6A9\uB960, HL OI: \uC2E4\uC2DC\uAC04 \uC804\uC6A9 (\uD788\uC2A4\uD1A0\uB9AC\uCEEC API \uC5C6\uC74C). \uC77C\uC77C \uC2A4\uB0C5\uC0F7 \uCD94\uAC00 \uC608\uC815.",
  metrics_api_title: "\uD788\uC2A4\uD1A0\uB9AC\uCEEC \uC9C0\uD45C (DeFiLlama + CoinGecko + Hyperliquid)",
  metric_rate: "\uD3C9\uADE0 \uB300\uCD9C \uAE08\uB9AC (\uAC00\uC911)", metric_rate_desc: "\uC0C1\uC704 \uB80C\uB529 \uD480\uC758 TVL \uAC00\uC911\uD3C9\uADE0 \uC2A4\uD14C\uC774\uBE14 \uB300\uCD9C \uAE08\uB9AC. DeFiLlama \uD788\uC2A4\uD1A0\uB9AC\uCEEC \uB370\uC774\uD130.",
  metric_util: "\uD480 \uD65C\uC6A9\uB960 (\uAC00\uC911)", metric_util_desc: "\uCD94\uC801 \uD480 \uC804\uCCB4 \uB300\uCD9C/\uACF5\uAE09 \uBE44\uC728. 85% \uC774\uC0C1\uC774\uBA74 kink-point \uAE08\uB9AC \uAE09\uB4F1.",
  metric_tborrow: "\uC2A4\uD14C\uC774\uBE14 \uCD1D \uB300\uCD9C \uC794\uC561", metric_tborrow_desc: "Aave, Compound, Morpho, Spark \uC804\uCCB4 \uC2A4\uD14C\uC774\uBE14 \uB300\uCD9C \uC794\uC561 \uD569\uACC4.",
  metric_bmcap: "\uB300\uCD9C/BTC \uC2DC\uCD1D (%)", metric_bmcap_desc: "\uC2A4\uD14C\uC774\uBE14 \uB300\uCD9C\uC758 BTC \uC2DC\uCD1D \uB300\uBE44 \uBE44\uC728. \uC2DC\uC7A5 \uADDC\uBAA8 \uB300\uBE44 \uB808\uBC84\uB9AC\uC9C0 \uBC00\uB3C4. CoinGecko BTC \uB370\uC774\uD130 (365\uC77C).",
  metric_btcfund: "BTC \uD380\uB529\uB808\uC774\uD2B8 (\uC5F0\uD658\uC0B0)", metric_btcfund_desc: "Hyperliquid BTC \uBB34\uAE30\uD55C \uD380\uB529\uB808\uC774\uD2B8(\uC5F0\uD658\uC0B0). \uC591\uC218=\uB871\u2192\uC219. 90\uC77C \uD788\uC2A4\uD1A0\uB9AC.",
  metric_ethfund: "ETH \uD380\uB529\uB808\uC774\uD2B8 (\uC5F0\uD658\uC0B0)", metric_ethfund_desc: "Hyperliquid ETH \uBB34\uAE30\uD55C \uD380\uB529\uB808\uC774\uD2B8(\uC5F0\uD658\uC0B0). 90\uC77C \uD788\uC2A4\uD1A0\uB9AC.",
  regime_method_title: "\uB808\uC9D0 \uBD84\uB958 \uBC29\uBC95\uB860",
  regime_method: "\uC885\uD569 \uC2A4\uCF54\uC5B4(0\u2013100)\uB294 3\uAC1C \uAC00\uC911 \uB808\uC774\uC5B4\uB85C \uACC4\uC0B0\uB429\uB2C8\uB2E4. \uAC01 \uB808\uC774\uC5B4\uB294 \uC5EC\uB7EC \uD558\uC704 \uC9C0\uD45C\uB97C \uC5F0\uC18D\uC801 \uC2A4\uCF00\uC77C\uB85C \uC810\uC218\uD654\uD55C \uD6C4 \uACB0\uD569\uD569\uB2C8\uB2E4. \uCD5C\uC885 \uC810\uC218\uAC00 \uD604\uC7AC \uB808\uC9D0\uC744 \uACB0\uC815\uD569\uB2C8\uB2E4.",
  regime_layers: "\uB808\uC774\uC5B4 \uAC00\uC911\uCE58: \uCC28\uC785 \uBE44\uC6A9(40%) = \uC2A4\uD14C\uC774\uBE14 \uCC28\uC785 \uBE44\uC6A9 + perp \uD380\uB529. \uD65C\uC6A9\uB960 & \uC6A9\uB7C9(35%) = \uB80C\uB529 \uC6A9\uB7C9 \uC0AC\uC6A9\uB7C9\uACFC \uC218\uC694 \uC131\uC7A5 \uC18D\uB3C4. OI & \uB9AC\uC2A4\uD06C(25%) = \uD30C\uC0DD\uC0C1\uD488 \uD22C\uAE30\uC801 \uD3EC\uC9C0\uC154\uB2DD \uADDC\uBAA8\uC640 \uC2DC\uC7A5 \uC2A4\uD2B8\uB808\uC2A4.",
  regime_thresholds: "\uB808\uC9D0 \uAE30\uC900 (\uC2A4\uCF54\uC5B4 0\u2013100): DELEVERAGED(0\u201333) = \uC2DC\uC7A5 \uC644\uC804 \uD574\uC18C, \uCD5C\uB300 \uAE30\uD68C. COOLING(33\u201345) = \uB808\uBC84\uB9AC\uC9C0 \uCD95\uC18C, \uC800\uB834\uD55C \uCC28\uC785. NEUTRAL(45\u201355) = \uAE30\uC900\uC120, \uBC29\uD5A5\uC131 \uC5C6\uC74C. WARMING(55\u201367) = \uCD08\uAE30 \uB808\uBC84\uB9AC\uC9C0 \uCD95\uC801. LEVERAGING UP(67\u201383) = \uC801\uADF9\uC801 \uD655\uB300, \uD63C\uC7A1. EXTREME(83\u2013100) = \uC5ED\uC0AC\uC801 \uACE0\uC810, \uCE90\uC2A4\uCF00\uC774\uB4DC \uC704\uD5D8.",
  regime_data_sources: "\uB370\uC774\uD130 \uC18C\uC2A4: DeFiLlama(\uC2E4\uC2DC\uAC04+\uD788\uC2A4\uD1A0\uB9AC\uCEEC \uB300\uCD9C \uAE08\uB9AC, \uD65C\uC6A9\uB960, 7\uAC1C+ \uD504\uB85C\uD1A0\uCF5C). Dune Analytics(2021\uB144\uBD80\uD130 \uC628\uCCB4\uC778 \uB300\uCD9C/\uC0C1\uD658 \uD2B8\uB79C\uC7AD\uC158). Hyperliquid(229\uAC1C perp \uD380\uB529+OI). CoinGecko(BTC \uAC00\uACA9+\uC2DC\uCD1D).",
}};

function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }
function scoreLinear(v, cold, neut, hot, ext) { var subCold = cold - (neut - cold); if (v <= subCold) return -3; if (v <= cold) return lerp(-3, -2, (v - subCold) / (cold - subCold)); if (v <= neut) return lerp(-2, 0, (v - cold) / (neut - cold)); if (v <= hot) return lerp(0, 2, (v - neut) / (hot - neut)); if (v <= ext) return lerp(2, 3, (v - hot) / (ext - hot)); return 3; }
function sColor(s) { if (s <= -1.5) return "#0ea371"; if (s <= -0.5) return "#4da87a"; if (s <= 0.5) return "#888"; if (s <= 1.5) return "#c47a20"; if (s <= 2.2) return "#d4522a"; return "#c41830"; }
function sLabel(s) { if (s <= -2) return "FROZEN"; if (s <= -1) return "COLD"; if (s <= -0.3) return "COOL"; if (s <= 0.3) return "NEUTRAL"; if (s <= 1) return "WARM"; if (s <= 2) return "HOT"; return "EXTREME"; }
function fmt(n, d) { if (d === undefined) d = 1; if (n == null || isNaN(n)) return "\u2014"; if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + "B"; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + "M"; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d) + "K"; return n.toFixed(d); }
function pct(n, d) { if (d === undefined) d = 2; if (n == null || isNaN(n)) return "\u2014"; return n.toFixed(d) + "%"; }

function getRegime(c, t) {
  if (c >= 2) return { label: "EXTREME LEVERAGE", color: "#c41830", emoji: "\uD83D\uDD25", desc: t.reg_extreme, act: t.act_extreme };
  if (c >= 1) return { label: "LEVERAGING UP", color: "#d4522a", emoji: "\u26A0\uFE0F", desc: t.reg_leveraging, act: t.act_leveraging };
  if (c >= 0.3) return { label: "WARMING", color: "#c47a20", emoji: "\uD83D\uDCC8", desc: t.reg_warming, act: t.act_warming };
  if (c >= -0.3) return { label: "NEUTRAL", color: "#888", emoji: "\u2796", desc: t.reg_neutral, act: t.act_neutral };
  if (c >= -1) return { label: "COOLING", color: "#4da87a", emoji: "\uD83D\uDCC9", desc: t.reg_cooling, act: t.act_cooling };
  return { label: "DELEVERAGED", color: "#0ea371", emoji: "\u2744\uFE0F", desc: t.reg_deleveraged, act: t.act_deleveraged };
}
function getSignals(m, dm, t) {
  var s = [];
  if (m) { if (m.brS>1) s.push(t.sig_br_high+" ("+pct(m.wBR)+")"); else if (m.brS<-1) s.push(t.sig_br_low+" ("+pct(m.wBR)+")"); if (m.fS>1) s.push(t.sig_fund_hot+" ("+pct(m.fAvg)+" ann)"); else if (m.fS<-1) s.push(t.sig_fund_neg+" ("+pct(m.fAvg)+" ann)"); if (m.uS>1) s.push(t.sig_util_high+" ("+pct(m.wU)+")"); if (m.oiS>1) s.push(t.sig_oi_high+" ($"+fmt(m.tOI)+")"); if (m.cS>1) s.push(t.sig_alt_frenzy+" ("+pct(m.conc,0)+")"); }
  if (dm) { if (dm.brRatio>1.1) s.push(t.sig_expand+" (B/R "+dm.brRatio.toFixed(2)+"x)"); else if (dm.brRatio<0.9) s.push(t.sig_delever+" (B/R "+dm.brRatio.toFixed(2)+"x)"); if (dm.volChange>20) s.push(t.sig_vol_surge+" (+"+dm.volChange.toFixed(0)+"%)"); else if (dm.volChange<-20) s.push(t.sig_vol_crash+" ("+dm.volChange.toFixed(0)+"%)"); }
  return s;
}

// ── Compute historical heat scores from Dune data ──
function computeHeatScores(data) {
  if (!data || data.length < 30) return [];
  // Compute all 7d rolling averages
  var avg7All = [];
  for (var i = 6; i < data.length; i++) {
    var s = 0; for (var j = i - 6; j <= i; j++) s += data[j].borrow;
    avg7All.push({ idx: i, val: s / 7 });
  }
  // Rolling 365d percentile function
  function rollingPctile(pos, window) {
    var start = Math.max(0, pos - window);
    var vals = [];
    for (var k = start; k <= pos; k++) vals.push(avg7All[k].val);
    if (vals.length < 30) return 50;
    vals.sort(function(a,b){return a-b;});
    var target = avg7All[pos].val;
    var below = 0;
    for (var k = 0; k < vals.length; k++) { if (vals[k] < target) below++; else break; }
    return below / vals.length * 100;
  }
  // Compute scores starting from day 29
  var scores = [];
  for (var i = 29; i < data.length; i++) {
    var sum7 = 0, sumR7 = 0;
    for (var j = Math.max(0, i - 6); j <= i; j++) { sum7 += data[j].borrow; sumR7 += data[j].repay; }
    var avg7 = sum7 / Math.min(7, i + 1);
    var sum30 = 0; for (var j = i - 29; j <= i; j++) sum30 += data[j].borrow;
    var avg30 = sum30 / 30;
    // Rolling 365d percentile
    var avg7Idx = i - 6; // index into avg7All
    if (avg7Idx < 0) avg7Idx = 0;
    var pctile = rollingPctile(avg7Idx, 365);
    var pctScore = scoreLinear(pctile, 15, 45, 75, 95);
    // Momentum: 7d vs 30d
    var volMom = avg30 > 0 ? (avg7 / avg30 - 1) * 100 : 0;
    var momScore = scoreLinear(volMom, -30, 0, 30, 70);
    // B/R ratio
    var brRatio = sumR7 > 0 ? sum7 / sumR7 : 1;
    var brScore = scoreLinear(brRatio, 0.8, 0.97, 1.08, 1.3);
    // Composite: percentile dominant
    var heat = pctScore * 0.45 + momScore * 0.25 + brScore * 0.30;
    heat = Math.max(-3, Math.min(3, heat));
    scores.push({ dt: data[i].dt, score: heat, borrow: data[i].borrow, repay: data[i].repay, brRatio: brRatio, pctile: Math.round(pctile) });
  }
  return scores;
}

// ── Gauge ──
function Gauge({ score, size }) {
  if (!size) size = 140;
  var score100 = Math.round((score + 3) / 6 * 100); // convert -3~+3 to 0~100
  var r = size * 0.34, cx = size / 2, cy = size * 0.42;
  var svgH = size * 0.72; // taller to fit text below
  var sA = -210, eA = 30, range = eA - sA, t = (score + 3) / 6, nA = sA + range * t;
  var toR = function(a) { return (a * Math.PI) / 180; };
  var arc = function(a1, a2) { var s = toR(a1), e = toR(a2); return "M "+(cx+r*Math.cos(s))+" "+(cy+r*Math.sin(s))+" A "+r+" "+r+" 0 "+(a2-a1>180?1:0)+" 1 "+(cx+r*Math.cos(e))+" "+(cy+r*Math.sin(e)); };
  var arcP = Array.from({length:60}, function(_,i) { var f=i/60; return <path key={i} d={arc(sA+range*f, sA+range*(f+1/60))} stroke={sColor(-3+6*f)} strokeWidth={5} fill="none" opacity={0.25} />; });
  var nd = toR(nA), nl = r * 0.75;
  return (<svg width={size} height={svgH} viewBox={"0 0 "+size+" "+svgH}>
    {arcP}<line x1={cx} y1={cy} x2={cx+nl*Math.cos(nd)} y2={cy+nl*Math.sin(nd)} stroke={sColor(score)} strokeWidth={2} strokeLinecap="round" /><circle cx={cx} cy={cy} r={3} fill={sColor(score)} />
    <text x={cx} y={cy+22} textAnchor="middle" fill={sColor(score)} style={{fontSize:28,fontWeight:700,fontFamily:"var(--f)"}}>{score100}</text>
    <text x={cx} y={cy+36} textAnchor="middle" fill={sColor(score)} style={{fontSize:10,fontWeight:600,fontFamily:"var(--f)",letterSpacing:1.5}}>{sLabel(score)}</text>
    <text x={cx - r - 4} y={cy + r * 0.55} textAnchor="end" fill="#ccc" style={{fontSize:9,fontFamily:"var(--f)"}}>0</text>
    <text x={cx + r + 4} y={cy + r * 0.55} textAnchor="start" fill="#ccc" style={{fontSize:9,fontFamily:"var(--f)"}}>100</text>
  </svg>);
}

// ── Heat Timeline Chart ──
function HeatTimeline({ heatData, period, setPeriod, t }) {
  var _hov = useState(-1), hov = _hov[0], setHov = _hov[1];
  var _cw = useContainerWidth(), containerRef = _cw[0], W = _cw[1];
  if (!heatData || heatData.length < 10) return <div ref={containerRef}></div>;
  var now = new Date(); var cutoff = new Date(now.getTime() - period * 86400000);
  var filtered = period >= 9999 ? heatData : heatData.filter(function(d) { return new Date(d.dt) >= cutoff; });
  if (filtered.length < 5) filtered = heatData;
  var H = 220, pad = { t: 10, r: 14, b: 32, l: 40 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var activeIdx = hov >= 0 && hov < filtered.length ? hov : filtered.length - 1;
  var hovInfo = filtered[activeIdx];
  var hovScore100 = Math.round((hovInfo.score + 3) / 6 * 100);
  // Regime zones (y=0 is top, so 100 is at pad.t and 0 is at pad.t+cH)
  var zones = [
    { min: 83, max: 100, color: "#c41830", label: "EXTREME" },
    { min: 67, max: 83, color: "#d4522a", label: "LEVERAGING" },
    { min: 55, max: 67, color: "#c47a20", label: "WARMING" },
    { min: 45, max: 55, color: "#888", label: "NEUTRAL" },
    { min: 33, max: 45, color: "#4da87a", label: "COOLING" },
    { min: 0, max: 33, color: "#0ea371", label: "DELEVERAGED" }
  ];
  var zoneRects = zones.map(function(z) {
    var y1 = pad.t + cH - (z.max / 100) * cH;
    var y2 = pad.t + cH - (z.min / 100) * cH;
    return <g key={z.label}>
      <rect x={pad.l} y={y1} width={cW} height={y2 - y1} fill={z.color} opacity={0.06} />
      <text x={pad.l + 4} y={y1 + 10} fill={z.color} opacity={0.5} style={{ fontSize: 8, fontWeight: 600 }}>{z.label}</text>
    </g>;
  });
  // Build line path
  var pts = [];
  for (var i = 0; i < filtered.length; i++) {
    var x = pad.l + (i / (filtered.length - 1)) * cW;
    var s100 = (filtered[i].score + 3) / 6 * 100;
    var y = pad.t + cH - (s100 / 100) * cH;
    pts.push(x + "," + y);
  }
  var linePath = "M " + pts.join(" L ");
  var areaPath = "M " + pad.l + "," + (pad.t + cH) + " L " + pts.join(" L ") + " L " + (pad.l + cW) + "," + (pad.t + cH) + " Z";
  // Crosshair
  var crossX = pad.l + (activeIdx / (filtered.length - 1)) * cW;
  var crossY = pad.t + cH - (hovScore100 / 100) * cH;
  // Date labels
  var dateLabels = []; var step = Math.max(1, Math.floor(filtered.length / 10));
  for (var i = 0; i < filtered.length; i += step) { var x = pad.l + (i / (filtered.length - 1)) * cW; dateLabels.push(<text key={i} x={x} y={H - 4} textAnchor="middle" fill="#aaa" style={{ fontSize: 10 }}>{filtered[i].dt.split(" ")[0]}</text>); }
  // Y labels (0, 25, 50, 75, 100)
  var yLabels = [0, 25, 50, 75, 100].map(function(v) { var y = pad.t + cH - (v / 100) * cH; return <g key={v}><line x1={pad.l} y1={y} x2={pad.l + cW} y2={y} stroke="#e0e0e4" strokeWidth={0.3} /><text x={pad.l - 4} y={y + 3} textAnchor="end" fill="#bbb" style={{ fontSize: 10 }}>{v}</text></g>; });
  var handleMove = function(e) { var svg = e.currentTarget; var rect = svg.getBoundingClientRect(); var mouseX = e.clientX - rect.left; var idx = Math.round((mouseX - pad.l) / cW * (filtered.length - 1)); setHov(Math.max(0, Math.min(filtered.length - 1, idx))); };
  var regimeLabel = hovScore100 >= 83 ? "EXTREME" : hovScore100 >= 67 ? "LEVERAGING" : hovScore100 >= 55 ? "WARMING" : hovScore100 >= 45 ? "NEUTRAL" : hovScore100 >= 33 ? "COOLING" : "DELEVERAGED";
  return (<div ref={containerRef} style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{t.heat_title} &middot; {period >= 9999 ? "ALL" : period + "D"}</span>
      <div style={{ display: "flex", gap: 2 }}>{[{l:"90D",d:90},{l:"1Y",d:365},{l:"2Y",d:730},{l:"ALL",d:9999}].map(function(p) { var active = p.d === period; return <button key={p.l} onClick={function(){setPeriod(p.d);}} style={{background:active?"#111":"#fff",color:active?"#fff":"#999",border:"1px solid "+(active?"#111":"#e0e0e4"),borderRadius:3,padding:"2px 7px",fontSize:11,fontFamily:"var(--f)",cursor:"pointer",fontWeight:active?700:400}}>{p.l}</button>; })}</div>
    </div>
    <div style={{ fontSize: 12, marginBottom: 4, padding: "5px 10px", background: sColor(hovInfo.score) + "12", borderRadius: 4, display: "inline-flex", gap: 14, minHeight: 24, alignItems: "center", flexWrap: "wrap" }}>
      <b>{hovInfo.dt.split(" ")[0]}</b>
      <span style={{ color: sColor(hovInfo.score), fontWeight: 700, fontSize: 14 }}>{hovScore100}</span>
      <span style={{ color: sColor(hovInfo.score), fontWeight: 600, fontSize: 11 }}>{regimeLabel}</span>
      <span style={{ color: "#888" }}>Vol: ${fmt(hovInfo.borrow)}</span>
      <span style={{ color: "#888" }}>B/R: {hovInfo.brRatio.toFixed(2)}x</span>
      {hovInfo.pctile != null && <span style={{ color: "#888" }}>Pctile: {hovInfo.pctile}%</span>}
    </div>
    <svg width={W} height={H} style={{ display: "block", cursor: "crosshair" }} onMouseMove={handleMove} onMouseLeave={function(){setHov(-1);}}>
      {zoneRects}{yLabels}
      <path d={areaPath} fill="url(#heatGrad)" opacity={0.15} />
      <path d={linePath} stroke={sColor(hovInfo.score)} strokeWidth={1.5} fill="none" />
      <line x1={crossX} y1={pad.t} x2={crossX} y2={pad.t + cH} stroke="#999" strokeWidth={0.5} strokeDasharray="2,2" />
      <circle cx={crossX} cy={crossY} r={3.5} fill={sColor(hovInfo.score)} stroke="#fff" strokeWidth={1.5} />
      {dateLabels}
      <rect x={pad.l} y={pad.t} width={cW} height={cH} fill="transparent" />
      <defs><linearGradient id="heatGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c41830" /><stop offset="50%" stopColor="#888" /><stop offset="100%" stopColor="#0ea371" /></linearGradient></defs>
    </svg>
    <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>{t.heat_desc}</div>
  </div>);
}

// ── Borrow Volume Chart ──
var PERIODS = [{label:"30D",days:30},{label:"90D",days:90},{label:"180D",days:180},{label:"1Y",days:365},{label:"2Y",days:730},{label:"ALL",days:9999}];
function BorrowChart({ data, period, setPeriod, t }) {
  var _hov = useState(-1), hov = _hov[0], setHov = _hov[1];
  var _cw = useContainerWidth(), containerRef = _cw[0], W = _cw[1];
  if (!data || data.length < 3) return <div ref={containerRef}></div>;
  var now = new Date(); var cutoff = new Date(now.getTime() - period * 86400000);
  var filtered = period >= 9999 ? data : data.filter(function(d) { return new Date(d.dt) >= cutoff; });
  if (filtered.length < 2) filtered = data;
  var maData = []; for (var i = 0; i < filtered.length; i++) { var start = Math.max(0, i - 6), sum = 0, cnt = 0; for (var j = start; j <= i; j++) { sum += filtered[j].borrow; cnt++; } maData.push(sum / cnt); }
  var H = 300, pad = { t: 14, r: 14, b: 34, l: 56 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var sorted = filtered.map(function(d){return d.borrow;}).sort(function(a,b){return a-b;});
  var p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  var maxB = Math.max(p95 * 1.15, 1);
  var maxNet = 0, minNet = 0;
  for (var i = 0; i < filtered.length; i++) { var net = filtered[i].borrow - filtered[i].repay; if (net > maxNet) maxNet = net; if (net < minNet) minNet = net; }
  var netAbs = Math.max(Math.abs(maxNet), Math.abs(minNet)) * 1.2 || 1;
  var maPts = [], netPts = [];
  for (var i = 0; i < filtered.length; i++) { var x = pad.l + (i / (filtered.length - 1)) * cW; maPts.push(x + "," + (pad.t + cH - Math.min(maData[i] / maxB, 1.2) * cH)); var netVal = filtered[i].borrow - filtered[i].repay; netPts.push({ x: x, y: pad.t + cH / 2 - (netVal / netAbs) * (cH / 2), val: netVal }); }
  var maArea = "M "+pad.l+","+(pad.t+cH)+" L "+maPts.join(" L ")+" L "+(pad.l+cW)+","+(pad.t+cH)+" Z";
  var maLine = "M " + maPts.join(" L ");
  var barW = Math.max(1.5, cW / filtered.length * 0.7);
  var netBars = netPts.map(function(p, i) { var baseY = pad.t + cH / 2; var h = Math.abs(baseY - p.y); return <rect key={i} x={p.x - barW/2} y={p.val >= 0 ? p.y : baseY} width={barW} height={h || 0.5} fill={p.val >= 0 ? "#0ea37150" : "#d4522a50"} />; });
  var dateLabels = [], step = Math.max(1, Math.floor(filtered.length / 12));
  for (var i = 0; i < filtered.length; i += step) { var x = pad.l + (i / (filtered.length - 1)) * cW; dateLabels.push(<text key={i} x={x} y={H-6} textAnchor="middle" fill="#999" style={{fontSize:11}}>{filtered[i].dt.split(" ")[0]}</text>); }
  var yTicks = [0, maxB*0.25, maxB*0.5, maxB*0.75, maxB];
  var yLabels = yTicks.map(function(v, i) { var y = pad.t + cH - (v / maxB) * cH; return <g key={i}><line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke="#f0f0f2" strokeWidth={0.5} /><text x={pad.l-4} y={y+3} textAnchor="end" fill="#aaa" style={{fontSize:11}}>${fmt(v,0)}</text></g>; });
  var activeIdx = hov >= 0 && hov < filtered.length ? hov : filtered.length - 1;
  var activeData = filtered[activeIdx];
  var activeNet = activeData.borrow - activeData.repay;
  var crossX = pad.l + (activeIdx / (filtered.length - 1)) * cW;
  var handleMove = function(e) { var svg = e.currentTarget; var rect = svg.getBoundingClientRect(); var mouseX = e.clientX - rect.left; var idx = Math.round((mouseX - pad.l) / cW * (filtered.length - 1)); setHov(Math.max(0, Math.min(filtered.length - 1, idx))); };
  return (<div ref={containerRef}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <span style={{fontSize:12,fontWeight:700,color:"#999",letterSpacing:1,textTransform:"uppercase"}}>{t.chart_title} &middot; {period>=9999?"ALL":period+"D"}</span>
      <div style={{display:"flex",gap:2}}>{PERIODS.map(function(p){var active=p.days===period;return <button key={p.label} onClick={function(){setPeriod(p.days);}} style={{background:active?"#111":"#fff",color:active?"#fff":"#999",border:"1px solid "+(active?"#111":"#e0e0e4"),borderRadius:3,padding:"2px 7px",fontSize:11,fontFamily:"var(--f)",cursor:"pointer",fontWeight:active?700:400}}>{p.label}</button>;})}</div>
    </div>
    <div style={{fontSize:12,marginBottom:4,padding:"4px 8px",background:"#f8f8fa",borderRadius:4,display:"inline-flex",gap:12,minHeight:22}}>
      <b>{activeData.dt.split(" ")[0]}</b>
      <span>Vol: <b>${fmt(activeData.borrow)}</b></span>
      <span>Repay: <b>${fmt(activeData.repay)}</b></span>
      <span>Net: <b style={{color:activeNet>=0?"#0ea371":"#d4522a"}}>${fmt(activeNet)}</b></span>
      <span>B/R: <b>{activeData.repay > 0 ? (activeData.borrow / activeData.repay).toFixed(2) : "\u2014"}x</b></span>
    </div>
    <svg width={W} height={H} style={{display:"block",cursor:"crosshair"}} onMouseMove={handleMove} onMouseLeave={function(){setHov(-1);}}>
      {yLabels}<path d={maArea} fill="#7c8cf510" />{netBars}<path d={maLine} stroke="#7c8cf5" strokeWidth={1.8} fill="none" />
      <line x1={crossX} y1={pad.t} x2={crossX} y2={pad.t+cH} stroke="#999" strokeWidth={0.5} strokeDasharray="2,2" />
      <line x1={pad.l} y1={pad.t+cH} x2={pad.l+cW} y2={pad.t+cH} stroke="#e0e0e4" strokeWidth={0.5} />
      {dateLabels}
      <rect x={pad.l} y={pad.t} width={cW} height={cH} fill="transparent" />
    </svg>
    <div style={{display:"flex",gap:14,marginTop:4,fontSize:11,color:"#999",flexWrap:"wrap"}}>
      <span><span style={{display:"inline-block",width:12,height:2,background:"#7c8cf5",borderRadius:1,marginRight:3}}></span>{t.borrow_vol}</span>
      <span><span style={{display:"inline-block",width:8,height:8,background:"#0ea37150",borderRadius:1,marginRight:3}}></span>{t.net_inflow}</span>
      <span><span style={{display:"inline-block",width:8,height:8,background:"#d4522a50",borderRadius:1,marginRight:3}}></span>{t.net_outflow}</span>
    </div>
    <div style={{fontSize:11,color:"#bbb",marginTop:3,lineHeight:1.5}}>{t.borrow_vol}: {t.borrow_vol_exp} &middot; {t.net_inflow}: {t.net_inflow_exp} &middot; {t.net_outflow}: {t.net_outflow_exp}</div>
  </div>);
}

// ── Metrics Explorer: derived time-series from Dune data ──
function computeDerivedMetrics(data) {
  if (!data || data.length < 30) return null;
  var br = [], mom = [], cumflow = [];
  var cumSum = 0;
  for (var i = 0; i < data.length; i++) {
    // Rolling 7d B/R ratio
    var s7b = 0, s7r = 0;
    for (var j = Math.max(0, i - 6); j <= i; j++) { s7b += data[j].borrow; s7r += data[j].repay; }
    br.push({ dt: data[i].dt, val: s7r > 0 ? s7b / s7r : 1 });
    // Volume momentum: 7d avg vs 30d avg
    var avg7 = s7b / Math.min(7, i + 1);
    var s30 = 0; var c30 = Math.min(30, i + 1);
    for (var j = Math.max(0, i - 29); j <= i; j++) s30 += data[j].borrow;
    var avg30 = s30 / c30;
    mom.push({ dt: data[i].dt, val: avg30 > 0 ? ((avg7 / avg30) - 1) * 100 : 0 });
    // Cumulative net flow
    cumSum += data[i].borrow - data[i].repay;
    cumflow.push({ dt: data[i].dt, val: cumSum });
  }
  return { br: br, mom: mom, cumflow: cumflow };
}

function MiniChart({ data, period, label, desc, color, baselineY, formatVal, t }) {
  var _cw = useContainerWidth(), containerRef = _cw[0], W = _cw[1];
  var _hov = useState(-1), hov = _hov[0], setHov = _hov[1];
  if (!data || data.length < 10) return <div ref={containerRef}></div>;
  var now = new Date(); var cutoff = new Date(now.getTime() - period * 86400000);
  var filtered = period >= 9999 ? data : data.filter(function(d) { return new Date(d.dt) >= cutoff; });
  if (filtered.length < 5) filtered = data;
  var H = 120, pad = { t: 8, r: 8, b: 24, l: 50 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var vals = filtered.map(function(d) { return d.val; });
  var minV = Math.min.apply(null, vals), maxV = Math.max.apply(null, vals);
  if (maxV === minV) { maxV = minV + 1; }
  var range = maxV - minV;
  // Build line
  var pts = [];
  for (var i = 0; i < filtered.length; i++) {
    var x = pad.l + (i / (filtered.length - 1)) * cW;
    var y = pad.t + cH - ((filtered[i].val - minV) / range) * cH;
    pts.push(x + "," + y);
  }
  var line = "M " + pts.join(" L ");
  var area = "M " + pad.l + "," + (pad.t + cH) + " L " + pts.join(" L ") + " L " + (pad.l + cW) + "," + (pad.t + cH) + " Z";
  // Baseline
  var blY = null;
  if (baselineY != null) { blY = pad.t + cH - ((baselineY - minV) / range) * cH; }
  // Labels
  var dateLabels = []; var step = Math.max(1, Math.floor(filtered.length / 6));
  for (var i = 0; i < filtered.length; i += step) { var x = pad.l + (i / (filtered.length - 1)) * cW; dateLabels.push(<text key={i} x={x} y={H - 4} textAnchor="middle" fill="#bbb" style={{ fontSize: 10 }}>{filtered[i].dt.split(" ")[0].slice(2)}</text>); }
  var yLabels = [minV, (minV + maxV) / 2, maxV].map(function(v, i) { var y = pad.t + cH - ((v - minV) / range) * cH; return <text key={i} x={pad.l - 4} y={y + 3} textAnchor="end" fill="#ccc" style={{ fontSize: 10 }}>{formatVal(v)}</text>; });
  // Hover
  var activeIdx = hov >= 0 && hov < filtered.length ? hov : filtered.length - 1;
  var activeData = filtered[activeIdx];
  var crossX = pad.l + (activeIdx / (filtered.length - 1)) * cW;
  var handleMove = function(e) { var svg = e.currentTarget; var rect = svg.getBoundingClientRect(); var mouseX = e.clientX - rect.left; var idx = Math.round((mouseX - pad.l) / cW * (filtered.length - 1)); setHov(Math.max(0, Math.min(filtered.length - 1, idx))); };
  return (<div ref={containerRef} style={{ marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#888" }}>{label}</span>
      <span style={{ fontSize: 11, color: "#666" }}><b>{activeData.dt.split(" ")[0]}</b>: <b style={{ color: color }}>{formatVal(activeData.val)}</b></span>
    </div>
    <svg width={W} height={H} style={{ display: "block", cursor: "crosshair" }} onMouseMove={handleMove} onMouseLeave={function(){setHov(-1);}}>
      {yLabels}
      <path d={area} fill={color + "10"} />
      <path d={line} stroke={color} strokeWidth={1.5} fill="none" />
      {blY != null && <line x1={pad.l} y1={blY} x2={pad.l + cW} y2={blY} stroke="#ccc" strokeWidth={0.5} strokeDasharray="3,3" />}
      <line x1={crossX} y1={pad.t} x2={crossX} y2={pad.t + cH} stroke="#999" strokeWidth={0.5} strokeDasharray="2,2" />
      {dateLabels}
      <rect x={pad.l} y={pad.t} width={cW} height={cH} fill="transparent" />
    </svg>
    <div style={{ fontSize: 10, color: "#bbb", marginTop: 1 }}>{desc}</div>
  </div>);
}

function MetricsExplorer({ duneData, historyData, period, setPeriod, t }) {
  var derived = useMemo(function() { return computeDerivedMetrics(duneData); }, [duneData]);
  // Transform historyData into MiniChart format
  var apiCharts = useMemo(function() {
    if (!historyData || historyData.length < 5) return null;
    var rate = [], util = [], tborrow = [], bmcap = [], btcf = [], ethf = [];
    for (var i = 0; i < historyData.length; i++) {
      var h = historyData[i];
      if (h.borrowRate != null) rate.push({ dt: h.dt + " 00:00:00.000 UTC", val: h.borrowRate });
      if (h.utilization != null) util.push({ dt: h.dt + " 00:00:00.000 UTC", val: h.utilization });
      if (h.totalBorrow != null) tborrow.push({ dt: h.dt + " 00:00:00.000 UTC", val: h.totalBorrow });
      if (h.borrowMcapRatio != null) bmcap.push({ dt: h.dt + " 00:00:00.000 UTC", val: h.borrowMcapRatio });
      if (h.btcFunding != null) btcf.push({ dt: h.dt + " 00:00:00.000 UTC", val: h.btcFunding });
      if (h.ethFunding != null) ethf.push({ dt: h.dt + " 00:00:00.000 UTC", val: h.ethFunding });
    }
    return { rate: rate, util: util, tborrow: tborrow, bmcap: bmcap, btcf: btcf, ethf: ethf };
  }, [historyData]);
  if (!derived && !apiCharts) return null;
  var fmtRatio = function(v) { return v.toFixed(2) + "x"; };
  var fmtPct = function(v) { return (v > 0 ? "+" : "") + v.toFixed(1) + "%"; };
  var fmtPctPlain = function(v) { return v.toFixed(2) + "%"; };
  var fmtDollar = function(v) { return "$" + fmt(v); };
  return (<div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{apiCharts ? t.metrics_api_title : t.metrics_title}</span>
      <div style={{ display: "flex", gap: 2 }}>
        {[{l:"90D",d:90},{l:"1Y",d:365},{l:"2Y",d:730},{l:"ALL",d:9999}].map(function(p) {
          var active = p.d === period;
          return <button key={p.l} onClick={function(){setPeriod(p.d);}} style={{background:active?"#111":"#fff",color:active?"#fff":"#999",border:"1px solid "+(active?"#111":"#e0e0e4"),borderRadius:3,padding:"2px 7px",fontSize:11,fontFamily:"var(--f)",cursor:"pointer",fontWeight:active?700:400}}>{p.l}</button>;
        })}
      </div>
    </div>
    {apiCharts && apiCharts.rate.length > 5 && <MiniChart data={apiCharts.rate} period={period} label={t.metric_rate} desc={t.metric_rate_desc} color="#d4522a" baselineY={null} formatVal={fmtPctPlain} t={t} />}
    {apiCharts && apiCharts.util.length > 5 && <MiniChart data={apiCharts.util} period={period} label={t.metric_util} desc={t.metric_util_desc} color="#c47a20" baselineY={85} formatVal={fmtPctPlain} t={t} />}
    {apiCharts && apiCharts.tborrow.length > 5 && <MiniChart data={apiCharts.tborrow} period={period} label={t.metric_tborrow} desc={t.metric_tborrow_desc} color="#7c8cf5" baselineY={null} formatVal={fmtDollar} t={t} />}
    {apiCharts && apiCharts.bmcap.length > 5 && <MiniChart data={apiCharts.bmcap} period={period} label={t.metric_bmcap} desc={t.metric_bmcap_desc} color="#0ea371" baselineY={null} formatVal={fmtPctPlain} t={t} />}
    {apiCharts && apiCharts.btcf.length > 5 && <MiniChart data={apiCharts.btcf} period={period} label={t.metric_btcfund} desc={t.metric_btcfund_desc} color="#d4522a" baselineY={0} formatVal={fmtPctPlain} t={t} />}
    {apiCharts && apiCharts.ethf.length > 5 && <MiniChart data={apiCharts.ethf} period={period} label={t.metric_ethfund} desc={t.metric_ethfund_desc} color="#7c8cf5" baselineY={0} formatVal={fmtPctPlain} t={t} />}
    {derived && <>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", marginTop: 10, marginBottom: 4, paddingTop: 8, borderTop: "1px solid #f0f0f2" }}>Dune On-chain</div>
      <MiniChart data={derived.br} period={period} label={t.metric_br} desc={t.metric_br_desc} color="#7c8cf5" baselineY={1.0} formatVal={fmtRatio} t={t} />
      <MiniChart data={derived.mom} period={period} label={t.metric_mom} desc={t.metric_mom_desc} color="#c47a20" baselineY={0} formatVal={fmtPct} t={t} />
      <MiniChart data={derived.cumflow} period={period} label={t.metric_cumflow} desc={t.metric_cumflow_desc} color="#0ea371" baselineY={0} formatVal={fmtDollar} t={t} />
    </>}
  </div>);
}

function RegimeMethodology({ t }) {
  var _open = useState(false), open = _open[0], setOpen = _open[1];
  return (<div style={{background:"#fff",border:"1px solid #e8e8ec",borderRadius:6,marginBottom:12,overflow:"hidden"}}>
    <div onClick={function(){setOpen(!open);}} style={{padding:"8px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#999",userSelect:"none"}}>
      <span style={{fontWeight:600,letterSpacing:0.5}}>{t.regime_method_title}</span>
      <span style={{fontSize:10,color:"#bbb"}}>{open?"\u25B2":"\u25BC"}</span>
    </div>
    {open && (<div style={{padding:"0 14px 12px"}}>
      <div style={{fontSize:11,color:"#555",lineHeight:1.8,marginBottom:8}}>{t.regime_method}</div>
      <div style={{fontSize:11,color:"#555",lineHeight:1.8,marginBottom:8}}>{t.regime_layers}</div>
      <div style={{marginBottom:8}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {[
            {label:"DELEVERAGED",range:"0\u201333",color:"#0ea371"},
            {label:"COOLING",range:"33\u201345",color:"#4da87a"},
            {label:"NEUTRAL",range:"45\u201355",color:"#888"},
            {label:"WARMING",range:"55\u201367",color:"#c47a20"},
            {label:"LEVERAGING UP",range:"67\u201383",color:"#d4522a"},
            {label:"EXTREME",range:"83\u2013100",color:"#c41830"}
          ].map(function(r){return <div key={r.label} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:3,background:r.color+"10",border:"1px solid "+r.color+"30",fontSize:10}}>
            <span style={{width:8,height:8,borderRadius:1,background:r.color,display:"inline-block"}}></span>
            <span style={{fontWeight:700,color:r.color}}>{r.label}</span>
            <span style={{color:"#999"}}>{r.range}</span>
          </div>;})}
        </div>
      </div>
      <div style={{fontSize:11,color:"#555",lineHeight:1.8,marginBottom:4}}>{t.regime_thresholds}</div>
      <div style={{fontSize:10,color:"#aaa",lineHeight:1.6}}>{t.regime_data_sources}</div>
    </div>)}
  </div>);
}

function Row({ label, val, score, sub, exp }) {
  var _s = useState(false), sh = _s[0], setSh = _s[1];
  return (<div>
    <div onClick={exp?function(){setSh(!sh);}:undefined} style={{display:"flex",alignItems:"center",padding:"5px 0",gap:6,borderBottom:"1px solid #f0f0f2",cursor:exp?"pointer":"default"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,color:"#444",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{exp&&<span style={{color:"#bbb",marginRight:3,fontSize:11}}>{sh?"\u25BC":"\u25B6"}</span>}{label}</div>
        {sub&&<div style={{fontSize:11,color:"#aaa",marginTop:1}}>{sub}</div>}
      </div>
      <div style={{fontSize:14,fontWeight:600,color:"#222",minWidth:65,textAlign:"right",whiteSpace:"nowrap"}}>{val}</div>
      {score!=null&&<div style={{fontSize:12,fontWeight:700,color:sColor(score),minWidth:36,textAlign:"right",padding:"1px 5px",borderRadius:3,background:sColor(score)+"12"}}>{score>0?"+":""}{score.toFixed(1)}</div>}
    </div>
    {sh&&exp&&<div style={{fontSize:12,color:"#777",padding:"4px 0 6px 14px",lineHeight:1.5,borderBottom:"1px solid #f0f0f2"}}>{exp}</div>}
  </div>);
}
function Layer({ title, wt, score, t, children }) {
  return (<div style={{border:"1px solid #e8e8ec",borderRadius:6,padding:"10px 12px",flex:"1 1 240px",minWidth:240,background:"#fff"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
      <span style={{fontSize:12,fontWeight:700,color:"#999",letterSpacing:1,textTransform:"uppercase"}}>{title}</span>
      <span style={{fontSize:11,color:"#bbb"}}>{wt}%</span>
    </div>{children}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:6,borderTop:"1px solid #eee"}}>
      <span style={{fontSize:12,color:"#aaa"}}>{t.score}</span>
      <span style={{fontSize:17,fontWeight:700,color:sColor(score)}}>{score>0?"+":""}{score.toFixed(2)}</span>
    </div>
  </div>);
}

// ═══════════════ MAIN ═══════════════
export default function App() {
  var _lang = useState("en"), lang = _lang[0], setLang = _lang[1];
  var t = T[lang];
  var _s = useState(true), loading = _s[0], setLoading = _s[1];
  var _e = useState(null), error = _e[0], setError = _e[1];
  var _a = useState({}), apiStatus = _a[0], setApiStatus = _a[1];
  var _p = useState([]), pools = _p[0], setPools = _p[1];
  var _b = useState(null), btcMcap = _b[0], setBtcMcap = _b[1];
  var _h = useState(null), hlData = _h[0], setHlData = _h[1];
  var _t2 = useState(null), ts = _t2[0], setTs = _t2[1];
  var _r = useState(false), showRaw = _r[0], setShowRaw = _r[1];
  var _d = useState(null), duneData = _d[0], setDuneData = _d[1];
  var _dl = useState(false), duneLoading = _dl[0], setDuneLoading = _dl[1];
  var _cp = useState(9999), chartPeriod = _cp[0], setChartPeriod = _cp[1];
  var _hp = useState(9999), heatPeriod = _hp[0], setHeatPeriod = _hp[1];
  var _mp = useState(9999), metricsPeriod = _mp[0], setMetricsPeriod = _mp[1];
  var _hist = useState(null), historyData = _hist[0], setHistoryData = _hist[1];

  var fetchAll = useCallback(function() {
    setLoading(true); setError(null); var status = {};
    Promise.allSettled([
      fetch("https://yields.llama.fi/poolsBorrow").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true").then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}),
      fetch("https://api.hyperliquid.xyz/info",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"metaAndAssetCtxs"})}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}),
    ]).then(function(results) {
      var pR=results[0],bR=results[1],hR=results[2];
      if(pR.status==="fulfilled"){status.llama="ok";var d=(pR.value&&pR.value.data)?pR.value.data:[],filtered=[];
        for(var i=0;i<d.length;i++){var p=d[i],proj=(p.project||"").toLowerCase(),sym=(p.symbol||"").toLowerCase();var matchP=LLAMA_PROTOCOLS.indexOf(proj)!==-1,matchS=false;for(var j=0;j<STABLES.length;j++){if(sym.indexOf(STABLES[j])!==-1){matchS=true;break;}}if(matchP&&matchS&&(p.totalBorrowUsd||0)>1000000)filtered.push({project:p.project,symbol:p.symbol,chain:p.chain,tvlUsd:p.tvlUsd||0,apyBorrow:p.apyBaseBorrow||0,totalBorrowUsd:p.totalBorrowUsd||0,totalSupplyUsd:p.totalSupplyUsd||0,utilization:(p.totalSupplyUsd>0)?(p.totalBorrowUsd/p.totalSupplyUsd)*100:0});}
        filtered.sort(function(a,b){return b.totalBorrowUsd-a.totalBorrowUsd;});setPools(filtered);
      }else{status.llama=String((pR.reason&&pR.reason.message)||"failed");}
      if(bR.status==="fulfilled"&&bR.value&&bR.value.bitcoin){status.coingecko="ok";setBtcMcap(bR.value.bitcoin.usd_market_cap);}else{status.coingecko="no data";}
      if(hR.status==="fulfilled"&&Array.isArray(hR.value)){status.hyperliquid="ok";var meta=hR.value[0],ctx=hR.value[1],u=(meta&&meta.universe)?meta.universe:[],mapped=[];for(var k=0;k<u.length;k++)mapped.push({name:u[k].name,funding:parseFloat((ctx[k]&&ctx[k].funding)||0),openInterest:parseFloat((ctx[k]&&ctx[k].openInterest)||0),markPx:parseFloat((ctx[k]&&ctx[k].markPx)||0)});setHlData(mapped);}else{status.hyperliquid="no data";}
      setApiStatus(status);setTs(new Date());setLoading(false);
    }).catch(function(e){setError(String(e.message||e));setLoading(false);});
  },[]);
  var fetchDune = useCallback(function() {
    setDuneLoading(true);
    fetch("/api/dune").then(function(r){return r.json();}).then(function(data){
      if(data.rows){var byDate={};for(var i=0;i<data.rows.length;i++){var row=data.rows[i],dt=row.dt.split(" ")[0];if(!byDate[dt])byDate[dt]={dt:row.dt,borrow:0,repay:0,count:0};byDate[dt].borrow+=row.daily_borrow_usd||0;byDate[dt].repay+=row.daily_repay_usd||0;byDate[dt].count+=row.borrow_count||0;}
        var arr=Object.values(byDate);arr.sort(function(a,b){return a.dt<b.dt?-1:1;});setDuneData(arr);}
      setDuneLoading(false);
    }).catch(function(){setDuneLoading(false);});
  },[]);
  var fetchHistory = useCallback(function() {
    fetch("/api/history").then(function(r){return r.json();}).then(function(data){
      if(data.history && data.history.length > 0) setHistoryData(data.history);
    }).catch(function(){});
  },[]);
  useEffect(function(){fetchAll();fetchDune();fetchHistory();},[fetchAll,fetchDune,fetchHistory]);

  var heatData = useMemo(function() { return computeHeatScores(duneData); }, [duneData]);

  var duneMetrics = useMemo(function(){
    if(!duneData||duneData.length<7)return null;
    var last7=duneData.slice(-7),prev7=duneData.slice(-14,-7);
    var sumB7=0,sumR7=0,sumBP=0;for(var i=0;i<last7.length;i++){sumB7+=last7[i].borrow;sumR7+=last7[i].repay;}for(var i=0;i<prev7.length;i++){sumBP+=prev7[i].borrow;}
    var avgB7=sumB7/7,avgBP=prev7.length?sumBP/prev7.length:avgB7;
    return{avgB7:avgB7,brRatio:sumR7>0?sumB7/sumR7:1,volChange:avgBP>0?((avgB7-avgBP)/avgBP)*100:0,netFlow7:sumB7-sumR7};
  },[duneData]);

  var m = useMemo(function(){
    if(!pools.length)return null;var totalW=0;for(var i=0;i<pools.length;i++)totalW+=pools[i].totalBorrowUsd;
    var wBR=0;if(totalW>0){var sumBR=0;for(var i=0;i<pools.length;i++)sumBR+=pools[i].apyBorrow*pools[i].totalBorrowUsd;wBR=sumBR/totalW;}
    var brS=scoreLinear(wBR,3,7,20,45);var btcF=null,ethF=null;
    if(hlData){for(var i=0;i<hlData.length;i++){if(hlData[i].name==="BTC")btcF=hlData[i];if(hlData[i].name==="ETH")ethF=hlData[i];}}
    var btcFA=btcF?btcF.funding*3*365*100:null,ethFA=ethF?ethF.funding*3*365*100:null;
    var fArr=[];if(btcFA!=null)fArr.push(btcFA);if(ethFA!=null)fArr.push(ethFA);
    var fAvg=fArr.length?fArr.reduce(function(a,b){return a+b;},0)/fArr.length:0;
    var fS=scoreLinear(fAvg,-5,5,25,70);var l1=brS*0.55+fS*0.45;
    var wU=0;if(totalW>0){var sumU=0;for(var i=0;i<pools.length;i++)sumU+=pools[i].utilization*pools[i].totalBorrowUsd;wU=sumU/totalW;}
    var uS=scoreLinear(wU,55,72,87,95),tB=totalW;
    var bMR=btcMcap?(tB/btcMcap)*100:null,bMS=bMR!=null?scoreLinear(bMR,0.2,0.5,1.2,2.5):0;
    var bAS=scoreLinear(tB/1e9,2,6,15,30);var volMomS=duneMetrics?scoreLinear(duneMetrics.volChange,-30,0,30,80):0;
    var l2=uS*0.25+bMS*0.25+bAS*0.3+volMomS*0.2;
    var tOI=0;if(hlData){for(var i=0;i<hlData.length;i++)tOI+=hlData[i].openInterest*hlData[i].markPx;}
    var btcOI=btcF?btcF.openInterest*btcF.markPx:0,ethOI=ethF?ethF.openInterest*ethF.markPx:0;
    var conc=tOI>0?((btcOI+ethOI)/tOI)*100:0;var cS=tOI>0?scoreLinear(100-conc,20,35,55,75):0;
    var oiS=tOI>0?scoreLinear(tOI/1e9,3,8,20,40):0;
    var fDiv=(btcFA!=null&&ethFA!=null)?Math.abs(btcFA-ethFA):0,dS=scoreLinear(fDiv,2,8,25,60);
    var netFlowS=duneMetrics?scoreLinear(duneMetrics.brRatio,0.7,0.95,1.15,1.5):0;
    var l3=oiS*0.35+cS*0.2+dS*0.2+netFlowS*0.25;var comp=l1*0.4+l2*0.35+l3*0.25;
    return{wBR:wBR,brS:brS,btcFA:btcFA,ethFA:ethFA,fAvg:fAvg,fS:fS,l1:l1,wU:wU,uS:uS,tB:tB,bMR:bMR,bMS:bMS,bAS:bAS,volMomS:volMomS,l2:l2,tOI:tOI,conc:conc,cS:cS,oiS:oiS,fDiv:fDiv,dS:dS,netFlowS:netFlowS,l3:l3,comp:comp};
  },[pools,btcMcap,hlData,duneMetrics]);

  var regime = m ? getRegime(m.comp, t) : null;
  var signals = m ? getSignals(m, duneMetrics, t) : [];
  var f = "'IBM Plex Mono','SF Mono','Menlo',monospace";

  return (
    <div style={{"--f":f,fontFamily:f,background:"#fafafa",minHeight:"100vh",padding:"16px 14px",color:"#333",fontSize:14}}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:"#111",letterSpacing:0.3}}>{t.title}</div>
          <div style={{fontSize:11,color:"#aaa",marginTop:2}}>{t.subtitle} &middot; {t.sources}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {!loading&&Object.keys(apiStatus).length>0&&(<div style={{display:"flex",gap:5,fontSize:10,marginRight:4}}>
            {[["LL",apiStatus.llama],["CG",apiStatus.coingecko],["HL",apiStatus.hyperliquid],["DN",duneData?"ok":duneLoading?"...":"?"]].map(function(item){return <span key={item[0]} style={{color:item[1]==="ok"?"#0ea371":"#ccc",fontWeight:600}}>{item[0]}</span>;})}
          </div>)}
          <div style={{display:"flex",border:"1px solid #ddd",borderRadius:3,overflow:"hidden"}}>
            <button onClick={function(){setLang("en");}} style={{background:lang==="en"?"#111":"#fff",color:lang==="en"?"#fff":"#999",border:"none",padding:"2px 6px",fontSize:11,fontFamily:f,cursor:"pointer",fontWeight:600}}>EN</button>
            <button onClick={function(){setLang("ko");}} style={{background:lang==="ko"?"#111":"#fff",color:lang==="ko"?"#fff":"#999",border:"none",padding:"2px 6px",fontSize:11,fontFamily:f,cursor:"pointer",fontWeight:600}}>{String.fromCharCode(54620)}</button>
          </div>
          {ts&&<span style={{fontSize:11,color:"#bbb"}}>{ts.toLocaleTimeString()}</span>}
          <button onClick={function(){fetchAll();fetchDune();}} disabled={loading} style={{background:"#fff",border:"1px solid #ddd",borderRadius:4,padding:"3px 10px",fontSize:12,fontFamily:f,cursor:loading?"wait":"pointer",color:"#666"}}>{loading?"...":"\u21bb"}</button>
        </div>
      </div>

      {error&&<div style={{background:"#fff5f5",border:"1px solid #fdd",borderRadius:6,padding:10,marginBottom:12,fontSize:13,color:"#c44"}}>{error}</div>}

      {loading?<div style={{textAlign:"center",padding:60,color:"#bbb",fontSize:13}}>{t.loading}</div>:!m?<div style={{textAlign:"center",padding:40,color:"#999",fontSize:13}}>{t.no_data}</div>:(<>

        {/* REGIME */}
        {regime&&(<div style={{background:"#fff",border:"1px solid #e8e8ec",borderRadius:8,padding:"14px 16px",marginBottom:12,display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:130}}>
            <Gauge score={m.comp} size={140} />
            <div style={{fontSize:13,fontWeight:700,color:regime.color,marginTop:2,letterSpacing:0.5}}>{regime.emoji} {regime.label}</div>
          </div>
          <div style={{flex:1,minWidth:280}}>
            <div style={{fontSize:12,color:"#aaa",fontWeight:600,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{t.regime}</div>
            <div style={{fontSize:14,color:"#333",lineHeight:1.6,marginBottom:8}}>{regime.desc}</div>
            <div style={{fontSize:13,color:"#555",lineHeight:1.5,marginBottom:8,padding:"6px 10px",background:regime.color+"08",borderLeft:"3px solid "+regime.color,borderRadius:"0 4px 4px 0"}}>
              <b style={{color:regime.color}}>{t.action}:</b> {regime.act}
            </div>
            {signals.length>0&&(<div style={{fontSize:12,color:"#888",lineHeight:1.6}}>
              <b style={{color:"#999"}}>{t.signals}:</b> {signals.map(function(s,i){return <span key={i} style={{display:"inline-block",marginRight:10}}>&bull; {s}</span>;})}
            </div>)}
            <div style={{display:"flex",gap:14,marginTop:8,fontSize:12,color:"#888"}}>
              {[[t.cost_title,m.l1],[t.cap_title,m.l2],[t.risk_title,m.l3]].map(function(item){return <span key={item[0]}>{item[0]}: <b style={{color:sColor(item[1])}}>{item[1]>0?"+":""}{item[1].toFixed(2)}</b></span>;})}
            </div>
          </div>
        </div>)}

        {/* REGIME METHODOLOGY - collapsible, right below regime */}
        <RegimeMethodology t={t} />

        {/* HEAT TIMELINE */}
        <HeatTimeline heatData={heatData} period={heatPeriod} setPeriod={setHeatPeriod} t={t} />

        {/* BORROW CHART */}
        {duneData&&duneData.length>3&&(<div style={{background:"#fff",border:"1px solid #e8e8ec",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
          <BorrowChart data={duneData} period={chartPeriod} setPeriod={setChartPeriod} t={t} />
          {duneMetrics&&(<div style={{display:"flex",gap:16,marginTop:6,fontSize:12,color:"#888",flexWrap:"wrap",borderTop:"1px solid #f0f0f2",paddingTop:6}}>
            <span>{t.chart_7d}: <b>${fmt(duneMetrics.avgB7)}/day</b></span>
            <span>{t.chart_br}: <b style={{color:sColor(m.netFlowS)}}>{duneMetrics.brRatio.toFixed(2)}x</b></span>
            <span>{t.chart_wow}: <b style={{color:sColor(m.volMomS)}}>{duneMetrics.volChange>0?"+":""}{duneMetrics.volChange.toFixed(1)}%</b></span>
            <span>{t.chart_net}: <b style={{color:duneMetrics.netFlow7>=0?"#0ea371":"#d4522a"}}>${fmt(duneMetrics.netFlow7)}</b></span>
          </div>)}
        </div>)}

        {/* DERIVED METRICS */}
        <MetricsExplorer duneData={duneData} historyData={historyData} period={metricsPeriod} setPeriod={setMetricsPeriod} t={t} />

        {/* 3 LAYERS */}
        <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <Layer title={t.cost_title} wt={40} score={m.l1} t={t}>
            <Row label={t.lbl_borrow_rate} val={pct(m.wBR)} score={m.brS} sub={t.sub_protocols} exp={t.exp_borrow_rate} />
            <Row label={t.lbl_btc_fund} val={m.btcFA!=null?pct(m.btcFA):"\u2014"} score={null} sub={t.sub_hl} exp={t.exp_btc_funding} />
            <Row label={t.lbl_eth_fund} val={m.ethFA!=null?pct(m.ethFA):"\u2014"} score={null} exp={t.exp_eth_funding} />
            <Row label={t.lbl_avg_fund} val={pct(m.fAvg)} score={m.fS} exp={t.exp_avg_funding} />
          </Layer>
          <Layer title={t.cap_title} wt={35} score={m.l2} t={t}>
            <Row label={t.lbl_util} val={pct(m.wU)} score={m.uS} exp={t.exp_util} />
            <Row label={t.lbl_total_borrow} val={"$"+fmt(m.tB)} score={m.bAS} sub={t.sub_abs} exp={t.exp_total_borrows} />
            <Row label={t.lbl_borrow_mcap} val={m.bMR!=null?pct(m.bMR,3):"\u2014"} score={m.bMS} sub={btcMcap?"mcap $"+fmt(btcMcap):""} exp={t.exp_borrows_mcap} />
            {duneMetrics&&<Row label={t.lbl_vol_mom} val={(duneMetrics.volChange>0?"+":"")+duneMetrics.volChange.toFixed(1)+"%"} score={m.volMomS} sub={t.sub_dune} exp={t.exp_vol_mom} />}
          </Layer>
          <Layer title={t.risk_title} wt={25} score={m.l3} t={t}>
            <Row label={t.lbl_hl_oi} val={"$"+fmt(m.tOI)} score={m.oiS} sub={t.sub_notional} exp={t.exp_hl_oi} />
            <Row label={t.lbl_oi_conc} val={pct(m.conc,1)} score={m.cS} sub={t.sub_alt} exp={t.exp_oi_conc} />
            <Row label={t.lbl_fund_div} val={pct(m.fDiv,1)} score={m.dS} exp={t.exp_fund_div} />
            {duneMetrics&&<Row label={t.lbl_net_flow} val={duneMetrics.brRatio.toFixed(2)+"x"} score={m.netFlowS} sub={t.sub_dune} exp={t.exp_net_flow} />}
          </Layer>
        </div>

        {/* Scale */}
        <div style={{display:"flex",gap:2,marginBottom:10,alignItems:"center",fontSize:11,color:"#aaa",flexWrap:"wrap"}}>
          {[[-3,"FROZEN"],[-2,"COLD"],[-1,"COOL"],[0,"NEUT"],[1,"WARM"],[2,"HOT"],[3,"EXTR"]].map(function(item){return <span key={item[0]} style={{display:"flex",alignItems:"center",gap:2,marginRight:6}}><span style={{width:6,height:6,borderRadius:1,background:sColor(item[0]),display:"inline-block"}} /><span style={{color:sColor(item[0]),fontWeight:600}}>{item[0]>0?"+":""}{item[0]}</span><span>{item[1]}</span></span>;})}
        </div>

        {/* Pool Data */}
        <div style={{background:"#fff",border:"1px solid #e8e8ec",borderRadius:6,overflow:"hidden",marginBottom:8}}>
          <div onClick={function(){setShowRaw(!showRaw);}} style={{padding:"8px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",fontSize:12,color:"#999",userSelect:"none"}}>
            <span>{t.pool_data} &middot; {pools.length} {t.pools}</span><span>{showRaw?"\u25b2":"\u25bc"}</span>
          </div>
          {showRaw&&(<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{color:"#aaa",borderBottom:"1px solid #eee",textAlign:"left"}}>
                {[t.protocol,t.asset,t.chain,t.borrow_pct,t.util_pct,t.borrows,t.supply].map(function(h){return <th key={h} style={{padding:"5px 8px",fontWeight:500}}>{h}</th>;})}
              </tr></thead>
              <tbody>{pools.slice(0,40).map(function(p,i){return <tr key={i} style={{borderBottom:"1px solid #f5f5f7",color:"#555"}}>
                <td style={{padding:"4px 8px"}}>{p.project}</td><td style={{padding:"4px 8px"}}>{p.symbol}</td>
                <td style={{padding:"4px 8px",color:"#aaa"}}>{p.chain}</td>
                <td style={{padding:"4px 8px",color:p.apyBorrow>15?"#d4522a":"#555"}}>{pct(p.apyBorrow)}</td>
                <td style={{padding:"4px 8px",color:p.utilization>85?"#d4522a":"#555"}}>{pct(p.utilization)}</td>
                <td style={{padding:"4px 8px"}}>{"$"+fmt(p.totalBorrowUsd)}</td>
                <td style={{padding:"4px 8px",color:"#aaa"}}>{"$"+fmt(p.totalSupplyUsd)}</td>
              </tr>;})}</tbody>
            </table>
          </div>)}
        </div>

        <div style={{fontSize:10,color:"#bbb",lineHeight:1.8}}>
          <b style={{color:"#999"}}>{t.coverage}:</b> {t.coverage_desc}
        </div>
        <div style={{marginTop:8,fontSize:12}}>
          <a href="https://dune.com/ozark/onchain-leverage-index" target="_blank" rel="noopener noreferrer" style={{color:"#7c8cf5",textDecoration:"none",fontWeight:600}}>
            Dune Dashboard &rarr;
          </a>
          <span style={{color:"#ccc",marginLeft:8,fontSize:11}}>{lang==="ko"?"Dune\uC5D0\uC11C \uC9C1\uC811 \uCFFC\uB9AC \uC2E4\uD589 \uBC0F \uB370\uC774\uD130 \uD655\uC778":"Run queries and explore raw data on Dune"}</span>
        </div>
      </>)}
    </div>
  );
}
