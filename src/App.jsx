import { useState, useEffect, useCallback, useMemo } from "react";

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
  borrow_pct: "\uB300\uCD9C%", util_pct: "\uD65C\uC6A9%", borrows: "\uB300\uCD9C\uAE08", supply: "\uACF5\uAE09\uAE08",
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
}};

function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }
function scoreLinear(v, cold, neut, hot, ext) { if (v <= cold) return -2; if (v <= neut) return lerp(-2, 0, (v - cold) / (neut - cold)); if (v <= hot) return lerp(0, 2, (v - neut) / (hot - neut)); if (v <= ext) return lerp(2, 3, (v - hot) / (ext - hot)); return 3; }
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
  var scores = [];
  for (var i = 29; i < data.length; i++) {
    // 30d rolling avg borrow volume
    var sum30 = 0; for (var j = i - 29; j <= i; j++) sum30 += data[j].borrow;
    var avg30 = sum30 / 30;
    // 7d rolling avg
    var sum7 = 0, sumR7 = 0;
    for (var j = Math.max(0, i - 6); j <= i; j++) { sum7 += data[j].borrow; sumR7 += data[j].repay; }
    var avg7 = sum7 / Math.min(7, i + 1);
    // 90d rolling avg for longer-term comparison
    var start90 = Math.max(0, i - 89);
    var sum90 = 0; for (var j = start90; j <= i; j++) sum90 += data[j].borrow;
    var avg90 = sum90 / (i - start90 + 1);
    // Volume momentum: 7d avg vs 30d avg
    var volMom = avg30 > 0 ? (avg7 / avg30 - 1) * 100 : 0;
    var volMomScore = scoreLinear(volMom, -40, 0, 40, 100);
    // Absolute volume vs 90d avg (is current activity high historically?)
    var volLevel = avg90 > 0 ? avg7 / avg90 : 1;
    var volLevelScore = scoreLinear(volLevel, 0.5, 0.9, 1.3, 2.0);
    // Borrow/repay ratio
    var brRatio = sumR7 > 0 ? sum7 / sumR7 : 1;
    var brScore = scoreLinear(brRatio, 0.7, 0.95, 1.15, 1.5);
    // Composite
    var heat = volMomScore * 0.3 + volLevelScore * 0.4 + brScore * 0.3;
    scores.push({ dt: data[i].dt, score: Math.max(-3, Math.min(3, heat)), borrow: data[i].borrow, repay: data[i].repay, brRatio: brRatio });
  }
  return scores;
}

// ── Gauge ──
function Gauge({ score, size }) {
  if (!size) size = 140; var r = size * 0.36, cx = size / 2, cy = size * 0.5;
  var sA = -210, eA = 30, range = eA - sA, t = (score + 3) / 6, nA = sA + range * t;
  var toR = function(a) { return (a * Math.PI) / 180; };
  var arc = function(a1, a2) { var s = toR(a1), e = toR(a2); return "M "+(cx+r*Math.cos(s))+" "+(cy+r*Math.sin(s))+" A "+r+" "+r+" 0 "+(a2-a1>180?1:0)+" 1 "+(cx+r*Math.cos(e))+" "+(cy+r*Math.sin(e)); };
  var arcP = Array.from({length:60}, function(_,i) { var f=i/60; return <path key={i} d={arc(sA+range*f, sA+range*(f+1/60))} stroke={sColor(-3+6*f)} strokeWidth={5} fill="none" opacity={0.25} />; });
  var nd = toR(nA), nl = r * 0.75;
  return (<svg width={size} height={size*0.56} viewBox={"0 0 "+size+" "+(size*0.56)}>
    {arcP}<line x1={cx} y1={cy} x2={cx+nl*Math.cos(nd)} y2={cy+nl*Math.sin(nd)} stroke={sColor(score)} strokeWidth={2} strokeLinecap="round" /><circle cx={cx} cy={cy} r={3} fill={sColor(score)} />
    <text x={cx} y={cy+18} textAnchor="middle" fill={sColor(score)} style={{fontSize:20,fontWeight:700,fontFamily:"var(--f)"}}>{score>0?"+":""}{score.toFixed(2)}</text>
    <text x={cx} y={cy+30} textAnchor="middle" fill={sColor(score)} style={{fontSize:8,fontWeight:600,fontFamily:"var(--f)",letterSpacing:1.5}}>{sLabel(score)}</text>
  </svg>);
}

// ── Heat Timeline Chart ──
function HeatTimeline({ heatData, period, setPeriod, t }) {
  if (!heatData || heatData.length < 10) return null;
  var _hov = useState(-1), hov = _hov[0], setHov = _hov[1];
  var now = new Date(); var cutoff = new Date(now.getTime() - period * 86400000);
  var filtered = period >= 9999 ? heatData : heatData.filter(function(d) { return new Date(d.dt) >= cutoff; });
  if (filtered.length < 5) filtered = heatData;
  var W = 960, H = 160, pad = { t: 10, r: 14, b: 32, l: 40 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var activeIdx = hov >= 0 && hov < filtered.length ? hov : filtered.length - 1;
  var hovInfo = filtered[activeIdx];
  var barW = Math.max(1, cW / filtered.length);
  var rects = [];
  for (var i = 0; i < filtered.length; i++) {
    var x = pad.l + (i / filtered.length) * cW;
    var s = filtered[i].score; var baseY = pad.t + cH / 2;
    var h = (Math.abs(s) / 3) * (cH / 2); var y = s >= 0 ? baseY - h : baseY;
    rects.push(<rect key={i} x={x} y={y} width={barW} height={h || 0.5} fill={sColor(s)} opacity={activeIdx === i ? 1 : 0.5} />);
  }
  var crossX = pad.l + (activeIdx / filtered.length) * cW + barW / 2;
  var zeroY = pad.t + cH / 2;
  var labels = []; var step = Math.max(1, Math.floor(filtered.length / 10));
  for (var i = 0; i < filtered.length; i += step) { var x = pad.l + (i / filtered.length) * cW; labels.push(<text key={i} x={x} y={H - 4} textAnchor="middle" fill="#aaa" style={{ fontSize: 9 }}>{filtered[i].dt.split(" ")[0]}</text>); }
  var yLabels = [-2, -1, 0, 1, 2].map(function(v) { var y = pad.t + cH / 2 - (v / 3) * (cH / 2); return <g key={v}><line x1={pad.l} y1={y} x2={pad.l + cW} y2={y} stroke="#f0f0f2" strokeWidth={0.5} /><text x={pad.l - 4} y={y + 3} textAnchor="end" fill="#bbb" style={{ fontSize: 8 }}>{v > 0 ? "+" : ""}{v}</text></g>; });
  var handleMove = function(e) { var svg = e.currentTarget; var rect = svg.getBoundingClientRect(); var mouseX = (e.clientX - rect.left) / rect.width * W; var idx = Math.round(((mouseX - pad.l) / cW) * filtered.length); setHov(Math.max(0, Math.min(filtered.length - 1, idx))); };
  return (<div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{t.heat_title} &middot; {period >= 9999 ? "ALL" : period + "D"}</span>
      <div style={{ display: "flex", gap: 2 }}>{[{l:"90D",d:90},{l:"1Y",d:365},{l:"2Y",d:730},{l:"ALL",d:9999}].map(function(p) { var active = p.d === period; return <button key={p.l} onClick={function(){setPeriod(p.d);}} style={{background:active?"#111":"#fff",color:active?"#fff":"#999",border:"1px solid "+(active?"#111":"#e0e0e4"),borderRadius:3,padding:"2px 7px",fontSize:9,fontFamily:"var(--f)",cursor:"pointer",fontWeight:active?700:400}}>{p.l}</button>; })}</div>
    </div>
    <div style={{ fontSize: 10, marginBottom: 4, padding: "4px 8px", background: sColor(hovInfo.score) + "10", borderRadius: 4, display: "inline-flex", gap: 12, minHeight: 22 }}>
      <b>{hovInfo.dt.split(" ")[0]}</b>
      <span style={{ color: sColor(hovInfo.score), fontWeight: 700 }}>{hovInfo.score > 0 ? "+" : ""}{hovInfo.score.toFixed(2)} {sLabel(hovInfo.score)}</span>
      <span>Vol: ${fmt(hovInfo.borrow)}</span>
      <span>B/R: {hovInfo.brRatio.toFixed(2)}x</span>
    </div>
    <svg width="100%" height={H} viewBox={"0 0 " + W + " " + H} preserveAspectRatio="xMidYMid meet" style={{ display: "block", cursor: "crosshair" }} onMouseMove={handleMove} onMouseLeave={function(){setHov(-1);}}>
      {yLabels}{rects}
      <line x1={crossX} y1={pad.t} x2={crossX} y2={pad.t + cH} stroke="#999" strokeWidth={0.5} strokeDasharray="2,2" />
      <line x1={pad.l} y1={zeroY} x2={pad.l + cW} y2={zeroY} stroke="#ccc" strokeWidth={0.5} strokeDasharray="3,3" />
      {labels}
      <rect x={pad.l} y={pad.t} width={cW} height={cH} fill="transparent" />
    </svg>
    <div style={{ fontSize: 9, color: "#bbb", marginTop: 4 }}>{t.heat_desc}</div>
  </div>);
}

// ── Borrow Volume Chart ──
var PERIODS = [{label:"30D",days:30},{label:"90D",days:90},{label:"180D",days:180},{label:"1Y",days:365},{label:"2Y",days:730},{label:"ALL",days:9999}];
function BorrowChart({ data, period, setPeriod, t }) {
  if (!data || data.length < 3) return null;
  var _hov = useState(-1), hov = _hov[0], setHov = _hov[1];
  var now = new Date(); var cutoff = new Date(now.getTime() - period * 86400000);
  var filtered = period >= 9999 ? data : data.filter(function(d) { return new Date(d.dt) >= cutoff; });
  if (filtered.length < 2) filtered = data;
  var maData = []; for (var i = 0; i < filtered.length; i++) { var start = Math.max(0, i - 6), sum = 0, cnt = 0; for (var j = start; j <= i; j++) { sum += filtered[j].borrow; cnt++; } maData.push(sum / cnt); }
  var W = 960, H = 300, pad = { t: 14, r: 14, b: 34, l: 56 };
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
  for (var i = 0; i < filtered.length; i += step) { var x = pad.l + (i / (filtered.length - 1)) * cW; dateLabels.push(<text key={i} x={x} y={H-6} textAnchor="middle" fill="#999" style={{fontSize:9.5}}>{filtered[i].dt.split(" ")[0]}</text>); }
  var yTicks = [0, maxB*0.25, maxB*0.5, maxB*0.75, maxB];
  var yLabels = yTicks.map(function(v, i) { var y = pad.t + cH - (v / maxB) * cH; return <g key={i}><line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke="#f0f0f2" strokeWidth={0.5} /><text x={pad.l-4} y={y+3} textAnchor="end" fill="#aaa" style={{fontSize:9}}>${fmt(v,0)}</text></g>; });
  // Hover logic: x-position based, default to latest
  var activeIdx = hov >= 0 && hov < filtered.length ? hov : filtered.length - 1;
  var activeData = filtered[activeIdx];
  var activeNet = activeData.borrow - activeData.repay;
  var crossX = pad.l + (activeIdx / (filtered.length - 1)) * cW;
  var handleMove = function(e) { var svg = e.currentTarget; var rect = svg.getBoundingClientRect(); var mouseX = (e.clientX - rect.left) / rect.width * W; var idx = Math.round(((mouseX - pad.l) / cW) * (filtered.length - 1)); setHov(Math.max(0, Math.min(filtered.length - 1, idx))); };
  return (<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
      <span style={{fontSize:10,fontWeight:700,color:"#999",letterSpacing:1,textTransform:"uppercase"}}>{t.chart_title} &middot; {period>=9999?"ALL":period+"D"}</span>
      <div style={{display:"flex",gap:2}}>{PERIODS.map(function(p){var active=p.days===period;return <button key={p.label} onClick={function(){setPeriod(p.days);}} style={{background:active?"#111":"#fff",color:active?"#fff":"#999",border:"1px solid "+(active?"#111":"#e0e0e4"),borderRadius:3,padding:"2px 7px",fontSize:9,fontFamily:"var(--f)",cursor:"pointer",fontWeight:active?700:400}}>{p.label}</button>;})}</div>
    </div>
    <div style={{fontSize:10,marginBottom:4,padding:"4px 8px",background:"#f8f8fa",borderRadius:4,display:"inline-flex",gap:12,minHeight:22}}>
      <b>{activeData.dt.split(" ")[0]}</b>
      <span>Vol: <b>${fmt(activeData.borrow)}</b></span>
      <span>Repay: <b>${fmt(activeData.repay)}</b></span>
      <span>Net: <b style={{color:activeNet>=0?"#0ea371":"#d4522a"}}>${fmt(activeNet)}</b></span>
      <span>B/R: <b>{activeData.repay > 0 ? (activeData.borrow / activeData.repay).toFixed(2) : "\u2014"}x</b></span>
    </div>
    <svg width="100%" height={H} viewBox={"0 0 "+W+" "+H} preserveAspectRatio="xMidYMid meet" style={{display:"block",cursor:"crosshair"}} onMouseMove={handleMove} onMouseLeave={function(){setHov(-1);}}>
      {yLabels}<path d={maArea} fill="#7c8cf510" />{netBars}<path d={maLine} stroke="#7c8cf5" strokeWidth={1.8} fill="none" />
      <line x1={crossX} y1={pad.t} x2={crossX} y2={pad.t+cH} stroke="#999" strokeWidth={0.5} strokeDasharray="2,2" />
      <line x1={pad.l} y1={pad.t+cH} x2={pad.l+cW} y2={pad.t+cH} stroke="#e0e0e4" strokeWidth={0.5} />
      {dateLabels}
      <rect x={pad.l} y={pad.t} width={cW} height={cH} fill="transparent" />
    </svg>
    <div style={{display:"flex",gap:14,marginTop:4,fontSize:9,color:"#999",flexWrap:"wrap"}}>
      <span><span style={{display:"inline-block",width:12,height:2,background:"#7c8cf5",borderRadius:1,marginRight:3}}></span>{t.borrow_vol}</span>
      <span><span style={{display:"inline-block",width:8,height:8,background:"#0ea37150",borderRadius:1,marginRight:3}}></span>{t.net_inflow}</span>
      <span><span style={{display:"inline-block",width:8,height:8,background:"#d4522a50",borderRadius:1,marginRight:3}}></span>{t.net_outflow}</span>
    </div>
    <div style={{fontSize:9,color:"#bbb",marginTop:3,lineHeight:1.5}}>{t.borrow_vol}: {t.borrow_vol_exp} &middot; {t.net_inflow}: {t.net_inflow_exp} &middot; {t.net_outflow}: {t.net_outflow_exp}</div>
  </div>);
}

function Row({ label, val, score, sub, exp }) {
  var _s = useState(false), sh = _s[0], setSh = _s[1];
  return (<div>
    <div onClick={exp?function(){setSh(!sh);}:undefined} style={{display:"flex",alignItems:"center",padding:"5px 0",gap:6,borderBottom:"1px solid #f0f0f2",cursor:exp?"pointer":"default"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:11,color:"#444",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{exp&&<span style={{color:"#bbb",marginRight:3,fontSize:9}}>{sh?"\u25BC":"\u25B6"}</span>}{label}</div>
        {sub&&<div style={{fontSize:9,color:"#aaa",marginTop:1}}>{sub}</div>}
      </div>
      <div style={{fontSize:12,fontWeight:600,color:"#222",minWidth:65,textAlign:"right",whiteSpace:"nowrap"}}>{val}</div>
      {score!=null&&<div style={{fontSize:10,fontWeight:700,color:sColor(score),minWidth:36,textAlign:"right",padding:"1px 5px",borderRadius:3,background:sColor(score)+"12"}}>{score>0?"+":""}{score.toFixed(1)}</div>}
    </div>
    {sh&&exp&&<div style={{fontSize:10,color:"#777",padding:"4px 0 6px 14px",lineHeight:1.5,borderBottom:"1px solid #f0f0f2"}}>{exp}</div>}
  </div>);
}
function Layer({ title, wt, score, t, children }) {
  return (<div style={{border:"1px solid #e8e8ec",borderRadius:6,padding:"10px 12px",flex:"1 1 240px",minWidth:240,background:"#fff"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
      <span style={{fontSize:10,fontWeight:700,color:"#999",letterSpacing:1,textTransform:"uppercase"}}>{title}</span>
      <span style={{fontSize:9,color:"#bbb"}}>{wt}%</span>
    </div>{children}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:6,borderTop:"1px solid #eee"}}>
      <span style={{fontSize:10,color:"#aaa"}}>{t.score}</span>
      <span style={{fontSize:14,fontWeight:700,color:sColor(score)}}>{score>0?"+":""}{score.toFixed(2)}</span>
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
  useEffect(function(){fetchAll();fetchDune();},[fetchAll,fetchDune]);

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
    <div style={{"--f":f,fontFamily:f,background:"#fafafa",minHeight:"100vh",padding:"16px 14px",color:"#333",fontSize:12}}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:"#111",letterSpacing:0.3}}>{t.title}</div>
          <div style={{fontSize:9,color:"#aaa",marginTop:2}}>{t.subtitle} &middot; {t.sources}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {!loading&&Object.keys(apiStatus).length>0&&(<div style={{display:"flex",gap:5,fontSize:8,marginRight:4}}>
            {[["LL",apiStatus.llama],["CG",apiStatus.coingecko],["HL",apiStatus.hyperliquid],["DN",duneData?"ok":duneLoading?"...":"?"]].map(function(item){return <span key={item[0]} style={{color:item[1]==="ok"?"#0ea371":"#ccc",fontWeight:600}}>{item[0]}</span>;})}
          </div>)}
          <div style={{display:"flex",border:"1px solid #ddd",borderRadius:3,overflow:"hidden"}}>
            <button onClick={function(){setLang("en");}} style={{background:lang==="en"?"#111":"#fff",color:lang==="en"?"#fff":"#999",border:"none",padding:"2px 6px",fontSize:9,fontFamily:f,cursor:"pointer",fontWeight:600}}>EN</button>
            <button onClick={function(){setLang("ko");}} style={{background:lang==="ko"?"#111":"#fff",color:lang==="ko"?"#fff":"#999",border:"none",padding:"2px 6px",fontSize:9,fontFamily:f,cursor:"pointer",fontWeight:600}}>{String.fromCharCode(54620)}</button>
          </div>
          {ts&&<span style={{fontSize:9,color:"#bbb"}}>{ts.toLocaleTimeString()}</span>}
          <button onClick={function(){fetchAll();fetchDune();}} disabled={loading} style={{background:"#fff",border:"1px solid #ddd",borderRadius:4,padding:"3px 10px",fontSize:10,fontFamily:f,cursor:loading?"wait":"pointer",color:"#666"}}>{loading?"...":"\u21bb"}</button>
        </div>
      </div>

      {error&&<div style={{background:"#fff5f5",border:"1px solid #fdd",borderRadius:6,padding:10,marginBottom:12,fontSize:11,color:"#c44"}}>{error}</div>}

      {loading?<div style={{textAlign:"center",padding:60,color:"#bbb",fontSize:11}}>{t.loading}</div>:!m?<div style={{textAlign:"center",padding:40,color:"#999",fontSize:11}}>{t.no_data}</div>:(<>

        {/* REGIME */}
        {regime&&(<div style={{background:"#fff",border:"1px solid #e8e8ec",borderRadius:8,padding:"14px 16px",marginBottom:12,display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:130}}>
            <Gauge score={m.comp} size={140} />
            <div style={{fontSize:11,fontWeight:700,color:regime.color,marginTop:2,letterSpacing:0.5}}>{regime.emoji} {regime.label}</div>
          </div>
          <div style={{flex:1,minWidth:280}}>
            <div style={{fontSize:10,color:"#aaa",fontWeight:600,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{t.regime}</div>
            <div style={{fontSize:12,color:"#333",lineHeight:1.6,marginBottom:8}}>{regime.desc}</div>
            <div style={{fontSize:11,color:"#555",lineHeight:1.5,marginBottom:8,padding:"6px 10px",background:regime.color+"08",borderLeft:"3px solid "+regime.color,borderRadius:"0 4px 4px 0"}}>
              <b style={{color:regime.color}}>{t.action}:</b> {regime.act}
            </div>
            {signals.length>0&&(<div style={{fontSize:10,color:"#888",lineHeight:1.6}}>
              <b style={{color:"#999"}}>{t.signals}:</b> {signals.map(function(s,i){return <span key={i} style={{display:"inline-block",marginRight:10}}>&bull; {s}</span>;})}
            </div>)}
            <div style={{display:"flex",gap:14,marginTop:8,fontSize:10,color:"#888"}}>
              {[[t.cost_title,m.l1],[t.cap_title,m.l2],[t.risk_title,m.l3]].map(function(item){return <span key={item[0]}>{item[0]}: <b style={{color:sColor(item[1])}}>{item[1]>0?"+":""}{item[1].toFixed(2)}</b></span>;})}
            </div>
          </div>
        </div>)}

        {/* HEAT TIMELINE */}
        <HeatTimeline heatData={heatData} period={heatPeriod} setPeriod={setHeatPeriod} t={t} />

        {/* BORROW CHART */}
        {duneData&&duneData.length>3&&(<div style={{background:"#fff",border:"1px solid #e8e8ec",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
          <BorrowChart data={duneData} period={chartPeriod} setPeriod={setChartPeriod} t={t} />
          {duneMetrics&&(<div style={{display:"flex",gap:16,marginTop:6,fontSize:10,color:"#888",flexWrap:"wrap",borderTop:"1px solid #f0f0f2",paddingTop:6}}>
            <span>{t.chart_7d}: <b>${fmt(duneMetrics.avgB7)}/day</b></span>
            <span>{t.chart_br}: <b style={{color:sColor(m.netFlowS)}}>{duneMetrics.brRatio.toFixed(2)}x</b></span>
            <span>{t.chart_wow}: <b style={{color:sColor(m.volMomS)}}>{duneMetrics.volChange>0?"+":""}{duneMetrics.volChange.toFixed(1)}%</b></span>
            <span>{t.chart_net}: <b style={{color:duneMetrics.netFlow7>=0?"#0ea371":"#d4522a"}}>${fmt(duneMetrics.netFlow7)}</b></span>
          </div>)}
        </div>)}

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
        <div style={{display:"flex",gap:2,marginBottom:10,alignItems:"center",fontSize:9,color:"#aaa",flexWrap:"wrap"}}>
          {[[-3,"FROZEN"],[-2,"COLD"],[-1,"COOL"],[0,"NEUT"],[1,"WARM"],[2,"HOT"],[3,"EXTR"]].map(function(item){return <span key={item[0]} style={{display:"flex",alignItems:"center",gap:2,marginRight:6}}><span style={{width:6,height:6,borderRadius:1,background:sColor(item[0]),display:"inline-block"}} /><span style={{color:sColor(item[0]),fontWeight:600}}>{item[0]>0?"+":""}{item[0]}</span><span>{item[1]}</span></span>;})}
        </div>

        {/* Pool Data */}
        <div style={{background:"#fff",border:"1px solid #e8e8ec",borderRadius:6,overflow:"hidden",marginBottom:8}}>
          <div onClick={function(){setShowRaw(!showRaw);}} style={{padding:"8px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",fontSize:10,color:"#999",userSelect:"none"}}>
            <span>{t.pool_data} &middot; {pools.length} {t.pools}</span><span>{showRaw?"\u25b2":"\u25bc"}</span>
          </div>
          {showRaw&&(<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
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

        <div style={{fontSize:8.5,color:"#bbb",lineHeight:1.8}}>
          <b style={{color:"#999"}}>{t.coverage}:</b> {t.coverage_desc}<br />
          <b style={{color:"#999"}}>{t.methodology}:</b> Cost(40%): borrow rate + perp funding | Capacity(35%): util + borrows + borrows/BTC mcap + vol momentum | Risk(25%): HL OI + concentration + funding div + net flow | Cron: daily 06:00 UTC
        </div>
      </>)}
    </div>
  );
}
