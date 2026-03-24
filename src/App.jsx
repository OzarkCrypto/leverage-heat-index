import { useState, useEffect, useCallback, useMemo } from "react";

// ── Protocols tracked ──
var LLAMA_PROTOCOLS = ["aave-v3","compound-v3","compound-v2","morpho-v1","sparklend","venus-core-pool","radiant-v1","fluid-lending"];
var STABLES = ["usdc","usdt","dai","usds","usdt0","susds","lusd","frax","gho","crvusd"];

// ── Translations ──
var T = {
  en: {
    title: "Leverage Heat Index",
    subtitle: "On-chain leverage demand/supply regime monitor",
    sources: "DeFiLlama \u00b7 CoinGecko \u00b7 Hyperliquid \u00b7 Dune",
    regime: "Current Regime",
    action: "Implication",
    signals: "Active Signals",
    chart_title: "Stablecoin Borrow Volume",
    chart_7d: "7d avg",
    chart_br: "B/R Ratio",
    chart_wow: "WoW",
    chart_net: "Net 7d",
    borrow_vol: "Borrow Vol (7d MA)",
    borrow_vol_exp: "Daily new stablecoin borrow amount, smoothed with 7-day moving average",
    net_inflow: "Net Inflow",
    net_inflow_exp: "Days where new borrows > repayments = leverage is expanding",
    net_outflow: "Net Outflow",
    net_outflow_exp: "Days where repayments > new borrows = deleveraging is occurring",
    cost_title: "Borrow Cost",
    cap_title: "Utilization & Capacity",
    risk_title: "OI & Risk",
    pool_data: "Pool Data",
    pools: "pools",
    protocol: "Protocol", asset: "Asset", chain: "Chain",
    borrow_pct: "Borrow%", util_pct: "Util%", borrows: "Borrows", supply: "Supply",
    coverage: "Coverage",
    coverage_desc: "88.7% of all stablecoin lending across 5+ protocols on 6 EVM chains. Updates daily 06:00 UTC.",
    methodology: "Methodology",
    // Metric explanations
    exp_borrow_rate: "Each lending pool's variable borrow APY, weighted by that pool's total borrow outstanding. Pools with larger borrows have more weight. This represents the market-wide cost of borrowing stablecoins. When demand to borrow is high, rates rise. When demand is low, rates fall. This is the most direct proxy for leverage demand.",
    exp_btc_funding: "BTC perpetual futures funding rate on Hyperliquid, converted to annualized %. Funding is paid every 8 hours between longs and shorts. Positive = longs pay shorts (bullish bias, leveraged longs dominate). Negative = shorts pay longs (bearish bias). This measures directional leverage sentiment in the derivatives market.",
    exp_eth_funding: "ETH perpetual futures funding rate on Hyperliquid, annualized. Same mechanics as BTC funding. ETH funding often diverges from BTC during alt-season or ETH-specific catalysts.",
    exp_avg_funding: "Simple average of BTC and ETH annualized funding rates. This is the core directional leverage signal from the perp market. Sustained high funding (>15% ann) historically precedes deleveraging events. Negative funding is rare and signals extreme bearish positioning.",
    exp_util: "Total borrows / total supply across all tracked pools, weighted by borrow size. When utilization exceeds ~85%, most protocols hit a 'kink point' where the interest rate curve steepens sharply \u2014 rates spike non-linearly to incentivize repayment. High utilization means available liquidity is nearly exhausted.",
    exp_total_borrows: "Sum of all stablecoin borrow outstanding across Aave, Compound, Morpho, Spark, Venus, Radiant, Fluid. This is the absolute scale of on-chain leverage. Unlike rates or utilization which are ratios, this captures the raw dollar magnitude of leverage in the system.",
    exp_borrows_mcap: "Total stablecoin borrows divided by BTC market cap. This normalizes leverage size against the overall market. A rising ratio means leverage is growing faster than the market, indicating increasing leverage density. Useful for cross-cycle comparison.",
    exp_vol_mom: "Average daily new borrow volume over the last 7 days vs the previous 7 days, expressed as % change. Positive = borrow activity is accelerating (new leverage being added faster). Negative = borrow activity is decelerating. This is a momentum indicator for leverage demand, sourced from Dune on-chain transaction data.",
    exp_hl_oi: "Total notional value of all open perpetual futures positions on Hyperliquid (contract size \u00d7 mark price, summed across all 229 assets). This measures the total scale of speculative positioning. Rising OI = new capital entering leveraged positions. Falling OI = positions being closed.",
    exp_oi_conc: "What share of total Hyperliquid OI sits in BTC + ETH vs altcoins. When BTC+ETH concentration is high, speculation is focused on majors (healthier). When concentration drops (alts take larger OI share), it signals an alt leverage frenzy \u2014 historically a sign of speculative excess that precedes corrections.",
    exp_fund_div: "Absolute difference between BTC and ETH annualized funding rates. When both trade at similar funding, the market has coherent positioning. Large divergence signals fragmented or stressed markets \u2014 e.g., ETH funding spiking while BTC stays flat suggests ETH-specific leverage buildup.",
    exp_net_flow: "Sum of all stablecoin borrows over 7 days divided by sum of all repayments over 7 days. >1.0 means more was borrowed than repaid = net leverage expansion. <1.0 means more was repaid than borrowed = net deleveraging. This is the clearest on-chain signal of whether leverage is growing or shrinking, sourced from Dune.",
    // Regime descriptions
    reg_extreme: "On-chain leverage is at historically elevated levels. Borrow rates, utilization, and speculative positioning are all running hot.",
    reg_leveraging: "Market is actively adding leverage. Borrow demand is above average and funding rates are elevated.",
    reg_warming: "Leverage demand is picking up from neutral. Early signs of positioning activity.",
    reg_neutral: "Leverage metrics are at baseline. No strong directional signal from on-chain borrowing activity.",
    reg_cooling: "Leverage is unwinding. Repayments exceed new borrowing, funding rates are subdued.",
    reg_deleveraged: "Market has fully deleveraged. Historically low borrowing activity and minimal speculative positioning.",
    act_extreme: "Deleveraging risk is high. Consider reducing exposure, harvesting yields, and preparing for potential cascade liquidations.",
    act_leveraging: "Yield opportunities are strong but crowded. Monitor utilization curves closely for kink-point approaches.",
    act_warming: "Good entry window for yield strategies. Borrow costs are moderate, capacity is available.",
    act_neutral: "Standard operating environment. Focus on protocol-level opportunities rather than macro leverage bets.",
    act_cooling: "Borrow costs are cheap. Accumulation opportunity for leveraged yield positions with low competition.",
    act_deleveraged: "Maximum opportunity for leveraged yield farming. Cheap borrow, empty pools, wide spreads.",
    sig_br_high: "Borrow rates elevated", sig_br_low: "Borrow rates depressed",
    sig_fund_hot: "Perp funding hot", sig_fund_neg: "Perp funding negative",
    sig_util_high: "Pool utilization high", sig_oi_high: "Hyperliquid OI elevated",
    sig_alt_frenzy: "Alt leverage frenzy", sig_expand: "Net leverage expanding",
    sig_delever: "Net deleveraging", sig_vol_surge: "Borrow volume surging",
    sig_vol_crash: "Borrow volume collapsing",
  },
  ko: {
    title: "\uB808\uBC84\uB9AC\uC9C0 \uD788\uD2B8 \uC778\uB371\uC2A4",
    subtitle: "\uC628\uCCB4\uC778 \uB808\uBC84\uB9AC\uC9C0 \uC218\uC694/\uACF5\uAE09 \uB808\uC9D0 \uBAA8\uB2C8\uD130",
    sources: "DeFiLlama \u00b7 CoinGecko \u00b7 Hyperliquid \u00b7 Dune",
    regime: "\uD604\uC7AC \uB808\uC9D0",
    action: "\uC2DC\uC0AC\uC810",
    signals: "\uD65C\uC131 \uC2E0\uD638",
    chart_title: "\uC2A4\uD14C\uC774\uBE14\uCF54\uC778 \uB300\uCD9C \uBCFC\uB968",
    chart_7d: "7\uC77C \uD3C9\uADE0",
    chart_br: "\uB300\uCD9C/\uC0C1\uD658",
    chart_wow: "\uC804\uC8FC\uBE44",
    chart_net: "\uC21C 7\uC77C",
    borrow_vol: "\uB300\uCD9C \uBCFC\uB968 (7\uC77C MA)",
    borrow_vol_exp: "\uC77C\uBCC4 \uC2A4\uD14C\uC774\uBE14\uCF54\uC778 \uC2E0\uADDC \uB300\uCD9C\uAE08\uC561\uC744 7\uC77C \uC774\uB3D9\uD3C9\uADE0\uC73C\uB85C \uC2A4\uBB34\uB529",
    net_inflow: "\uC21C \uC720\uC785",
    net_inflow_exp: "\uC2E0\uADDC \uB300\uCD9C > \uC0C1\uD658\uC778 \uB0A0 = \uB808\uBC84\uB9AC\uC9C0\uAC00 \uC21C\uC99D\uAC00\uD558\uB294 \uC911",
    net_outflow: "\uC21C \uC720\uCD9C",
    net_outflow_exp: "\uC0C1\uD658 > \uC2E0\uADDC \uB300\uCD9C\uC778 \uB0A0 = \uB514\uB808\uBC84\uB9AC\uC9D5 \uC9C4\uD589 \uC911",
    cost_title: "\uCC28\uC785 \uBE44\uC6A9",
    cap_title: "\uD65C\uC6A9\uB960 & \uC6A9\uB7C9",
    risk_title: "OI & \uB9AC\uC2A4\uD06C",
    pool_data: "\uD480 \uB370\uC774\uD130",
    pools: "\uD480",
    protocol: "\uD504\uB85C\uD1A0\uCF5C", asset: "\uC790\uC0B0", chain: "\uCCB4\uC778",
    borrow_pct: "\uB300\uCD9C%", util_pct: "\uD65C\uC6A9%", borrows: "\uB300\uCD9C\uAE08", supply: "\uACF5\uAE09\uAE08",
    coverage: "\uCEE4\uBC84\uB9AC\uC9C0",
    coverage_desc: "6\uAC1C EVM \uCCB4\uC778, 5\uAC1C+ \uD504\uB85C\uD1A0\uCF5C\uC758 \uC2A4\uD14C\uC774\uBE14\uCF54\uC778 \uB300\uCD9C\uC758 88.7% \uCEE4\uBC84. \uB9E4\uC77C 06:00 UTC \uC790\uB3D9 \uC5C5\uB370\uC774\uD2B8.",
    methodology: "\uBC29\uBC95\uB860",
    exp_borrow_rate: "\uAC01 \uB80C\uB529 \uD480\uC758 \uBCC0\uB3D9 \uB300\uCD9C \uAE08\uB9AC(APY)\uB97C \uD574\uB2F9 \uD480\uC758 \uB300\uCD9C \uC794\uC561\uC73C\uB85C \uAC00\uC911\uD3C9\uADE0\uD55C \uAC12. \uB300\uCD9C \uC794\uC561\uC774 \uD070 \uD480\uC77C\uC218\uB85D \uAC00\uC911\uCE58\uAC00 \uB192\uB2E4. \uC774 \uC218\uCE58\uAC00 '\uC2DC\uC7A5 \uC804\uCCB4\uC758 \uB300\uD45C \uCC28\uC785 \uBE44\uC6A9'\uC774\uB2E4. \uB192\uC73C\uBA74 \uBE4C\uB9AC\uB824\uB294 \uC218\uC694\uAC00 \uB9CE\uB2E4\uB294 \uB73B\uC774\uACE0, \uB0AE\uC73C\uBA74 \uC218\uC694\uAC00 \uC801\uB2E4\uB294 \uB73B\uC774\uB2E4. \uB808\uBC84\uB9AC\uC9C0 \uC218\uC694\uC758 \uAC00\uC7A5 \uC9C1\uC811\uC801\uC778 \uD504\uB85D\uC2DC.",
    exp_btc_funding: "Hyperliquid BTC \uBB34\uAE30\uD55C \uD380\uB529\uB808\uC774\uD2B8\uB97C \uC5F0\uD658\uC0B0\uD55C \uAC12. \uD380\uB529\uC740 8\uC2DC\uAC04\uB9C8\uB2E4 \uB871\uACFC \uC219 \uC0AC\uC774\uC5D0\uC11C \uC9C0\uBD88\uB41C\uB2E4. \uC591\uC218 = \uB871\uC774 \uC219\uC5D0\uAC8C \uC9C0\uBD88(\uAC15\uC138 \uD3B8\uD5A5, \uB808\uBC84\uB9AC\uC9C0 \uB871\uC774 \uC9C0\uBC30\uC801). \uC74C\uC218 = \uC219\uC774 \uB871\uC5D0\uAC8C \uC9C0\uBD88(\uC57D\uC138 \uD3B8\uD5A5). \uD30C\uC0DD\uC0C1\uD488 \uC2DC\uC7A5\uC758 \uBC29\uD5A5\uC131 \uB808\uBC84\uB9AC\uC9C0 \uC2EC\uB9AC \uCE21\uC815.",
    exp_eth_funding: "Hyperliquid ETH \uBB34\uAE30\uD55C \uD380\uB529\uB808\uC774\uD2B8(\uC5F0\uD658\uC0B0). BTC \uD380\uB529\uACFC \uB3D9\uC77C\uD55C \uBA54\uCEE4\uB2C8\uC998. \uC54C\uD2B8 \uC2DC\uC98C\uC774\uB098 ETH \uD2B9\uC815 \uCE90\uD0C8\uB9AC\uC2A4\uD2B8 \uC2DC BTC \uD380\uB529\uACFC \uAD34\uB9AC\uAC00 \uBC1C\uC0DD\uD560 \uC218 \uC788\uB2E4.",
    exp_avg_funding: "BTC + ETH \uC5F0\uD658\uC0B0 \uD380\uB529\uC758 \uB2E8\uC21C \uD3C9\uADE0. perp \uC2DC\uC7A5\uC758 \uD575\uC2EC \uBC29\uD5A5\uC131 \uB808\uBC84\uB9AC\uC9C0 \uC2E0\uD638. \uC9C0\uC18D\uC801\uC73C\uB85C \uB192\uC740 \uD380\uB529(>15% \uC5F0\uD658\uC0B0)\uC740 \uC5ED\uC0AC\uC801\uC73C\uB85C \uB514\uB808\uBC84\uB9AC\uC9D5 \uC774\uBCA4\uD2B8\uC5D0 \uC120\uD589\uD588\uB2E4. \uC74C\uC218 \uD380\uB529\uC740 \uB4DC\uBB3C\uACE0 \uADF9\uB2E8\uC801 \uC57D\uC138 \uD3EC\uC9C0\uC154\uB2DD\uC744 \uC758\uBBF8.",
    exp_util: "\uC804\uCCB4 \uCD94\uC801 \uD480\uC758 \uB300\uCD9C\uC561/\uACF5\uAE09\uC561 \uBE44\uC728\uC744 \uB300\uCD9C \uADDC\uBAA8\uB85C \uAC00\uC911\uD3C9\uADE0. ~85%\uB97C \uB118\uC73C\uBA74 \uB300\uBD80\uBD84 \uD504\uB85C\uD1A0\uCF5C\uC758 \uAE08\uB9AC \uACE1\uC120\uC774 \uAE09\uACBD\uC0AC\uB97C \uC774\uB8E8\uB294 'kink point'\uC5D0 \uB3C4\uB2EC \u2014 \uAE08\uB9AC\uAC00 \uBE44\uC120\uD615\uC801\uC73C\uB85C \uAE09\uB4F1\uD558\uC5EC \uC0C1\uD658\uC744 \uC720\uB3C4\uD55C\uB2E4. \uB192\uC740 \uD65C\uC6A9\uB960 = \uAC00\uC6A9 \uC720\uB3D9\uC131\uC774 \uAC70\uC758 \uC18C\uC9C4.",
    exp_total_borrows: "Aave, Compound, Morpho, Spark, Venus, Radiant, Fluid \uC804\uCCB4\uC758 \uC2A4\uD14C\uC774\uBE14\uCF54\uC778 \uB300\uCD9C \uC794\uC561 \uD569\uACC4. \uAE08\uB9AC\uB098 \uD65C\uC6A9\uB960 \uAC19\uC740 \uBE44\uC728\uC774 \uC544\uB2C8\uB77C, \uC2DC\uC2A4\uD15C \uB0B4 \uB808\uBC84\uB9AC\uC9C0\uC758 \uC808\uB300\uC801 \uB2EC\uB7EC \uADDC\uBAA8\uB97C \uBCF4\uC5EC\uC900\uB2E4.",
    exp_borrows_mcap: "\uC2A4\uD14C\uC774\uBE14 \uB300\uCD9C \uCD1D\uC561\uC744 BTC \uC2DC\uAC00\uCD1D\uC561\uC73C\uB85C \uB098\uB208 \uAC12. \uC2DC\uC7A5 \uADDC\uBAA8 \uB300\uBE44 \uB808\uBC84\uB9AC\uC9C0\uB97C \uC815\uADDC\uD654\uD55C\uB2E4. \uC774 \uBE44\uC728\uC774 \uC624\uB974\uBA74 \uC2DC\uC7A5\uBCF4\uB2E4 \uB808\uBC84\uB9AC\uC9C0\uAC00 \uB354 \uBE60\uB974\uAC8C \uC131\uC7A5\uD558\uB294 \uAC83. \uC0AC\uC774\uD074 \uAC04 \uBE44\uAD50\uC5D0 \uC720\uC6A9.",
    exp_vol_mom: "\uCD5C\uADFC 7\uC77C \uD3C9\uADE0 \uC77C\uC77C \uC2E0\uADDC \uB300\uCD9C\uB7C9 vs \uC774\uC804 7\uC77C\uC758 % \uBCC0\uD654. \uC591\uC218 = \uB300\uCD9C \uD65C\uB3D9 \uAC00\uC18D(\uC0C8 \uB808\uBC84\uB9AC\uC9C0\uAC00 \uB354 \uBE60\uB974\uAC8C \uCD94\uAC00\uB428). \uC74C\uC218 = \uB300\uCD9C \uD65C\uB3D9 \uAC10\uC18D. \uB808\uBC84\uB9AC\uC9C0 \uC218\uC694\uC758 \uBAA8\uBA58\uD140 \uC9C0\uD45C. Dune \uC628\uCCB4\uC778 \uD2B8\uB79C\uC7AD\uC158 \uB370\uC774\uD130 \uAE30\uBC18.",
    exp_hl_oi: "Hyperliquid \uC804\uCCB4 229\uAC1C \uC790\uC0B0\uC758 \uBB34\uAE30\uD55C \uBBF8\uACB0\uC81C\uC57D\uC815 \uCD1D \uBA85\uBAA9\uAC00\uCE58(\uACC4\uC57D \uC218 \u00d7 \uB9C8\uD06C \uAC00\uACA9). \uD22C\uAE30\uC801 \uD3EC\uC9C0\uC154\uB2DD\uC758 \uCD1D \uADDC\uBAA8. OI \uC0C1\uC2B9 = \uC0C8\uB85C\uC6B4 \uC790\uBCF8\uC774 \uB808\uBC84\uB9AC\uC9C0 \uD3EC\uC9C0\uC158\uC5D0 \uC9C4\uC785. OI \uD558\uB77D = \uD3EC\uC9C0\uC158 \uC815\uB9AC.",
    exp_oi_conc: "\uC804\uCCB4 Hyperliquid OI \uC911 BTC+ETH\uAC00 \uCC28\uC9C0\uD558\uB294 \uBE44\uC911. BTC+ETH \uC9D1\uC911\uB3C4\uAC00 \uB192\uC73C\uBA74 \uD22C\uAE30\uAC00 \uBA54\uC774\uC800\uC5D0 \uC9D1\uC911(\uAC74\uAC15). \uC9D1\uC911\uB3C4\uAC00 \uB5A8\uC5B4\uC9C0\uBA74(\uC54C\uD2B8\uAC00 OI \uBE44\uC911 \uC99D\uAC00) \uC54C\uD2B8 \uB808\uBC84\uB9AC\uC9C0 \uD3ED\uBC1C \u2014 \uC5ED\uC0AC\uC801\uC73C\uB85C \uC870\uC815\uC5D0 \uC120\uD589\uD558\uB294 \uD22C\uAE30\uC801 \uACFC\uC5F4 \uC2E0\uD638.",
    exp_fund_div: "BTC\uC640 ETH \uC5F0\uD658\uC0B0 \uD380\uB529\uC758 \uC808\uB300\uAC12 \uCC28\uC774. \uB458 \uB2E4 \uBE44\uC2B7\uD55C \uD380\uB529\uC774\uBA74 \uC2DC\uC7A5\uC774 \uC77C\uAD00\uB41C \uD3EC\uC9C0\uC154\uB2DD. \uAD34\uB9AC\uAC00 \uD06C\uBA74 \uC2DC\uC7A5 \uBD84\uD654/\uC2A4\uD2B8\uB808\uC2A4 \u2014 \uC608: ETH \uD380\uB529\uC774 \uAE09\uB4F1\uD558\uB294\uB370 BTC\uB294 \uBCF4\uD569\uC774\uBA74 ETH \uD2B9\uC815 \uB808\uBC84\uB9AC\uC9C0 \uCD95\uC801\uC744 \uC758\uBBF8.",
    exp_net_flow: "7\uC77C\uAC04 \uC2A4\uD14C\uC774\uBE14 \uC2E0\uADDC \uB300\uCD9C \uCD1D\uC561 / 7\uC77C\uAC04 \uC0C1\uD658 \uCD1D\uC561. >1.0\uC774\uBA74 \uBE4C\uB9B0 \uAC83\uC774 \uAC1A\uC740 \uAC83\uBCF4\uB2E4 \uB9CE\uC74C = \uC21C \uB808\uBC84\uB9AC\uC9C0 \uD655\uB300. <1.0\uC774\uBA74 \uAC1A\uC740 \uAC83\uC774 \uBE4C\uB9B0 \uAC83\uBCF4\uB2E4 \uB9CE\uC74C = \uC21C \uB514\uB808\uBC84\uB9AC\uC9D5. \uB808\uBC84\uB9AC\uC9C0\uAC00 \uC131\uC7A5\uD558\uB294\uC9C0 \uCD95\uC18C\uD558\uB294\uC9C0\uC758 \uAC00\uC7A5 \uBA85\uD655\uD55C \uC628\uCCB4\uC778 \uC2E0\uD638. Dune \uB370\uC774\uD130 \uAE30\uBC18.",
    reg_extreme: "\uC628\uCCB4\uC778 \uB808\uBC84\uB9AC\uC9C0\uAC00 \uC5ED\uC0AC\uC801 \uACE0\uC810. \uB300\uCD9C \uAE08\uB9AC, \uD65C\uC6A9\uB960, \uD22C\uAE30\uC801 \uD3EC\uC9C0\uC158\uB2DD \uBAA8\uB450 \uACFC\uC5F4.",
    reg_leveraging: "\uC2DC\uC7A5\uC774 \uC801\uADF9\uC801\uC73C\uB85C \uB808\uBC84\uB9AC\uC9C0\uB97C \uCD94\uAC00\uD558\uB294 \uC911. \uB300\uCD9C \uC218\uC694 \uD3C9\uADE0 \uC774\uC0C1, \uD380\uB529 \uC0C1\uC2B9.",
    reg_warming: "\uB808\uBC84\uB9AC\uC9C0 \uC218\uC694\uAC00 \uC911\uB9BD\uC5D0\uC11C \uD68C\uBCF5 \uC911. \uD3EC\uC9C0\uC154\uB2DD \uD65C\uB3D9 \uCD08\uAE30 \uC9D5\uD6C4.",
    reg_neutral: "\uB808\uBC84\uB9AC\uC9C0 \uC9C0\uD45C\uAC00 \uAE30\uC900\uC120. \uC628\uCCB4\uC778 \uCC28\uC785\uC5D0\uC11C \uAC15\uD55C \uBC29\uD5A5\uC131 \uC2E0\uD638 \uC5C6\uC74C.",
    reg_cooling: "\uB808\uBC84\uB9AC\uC9C0 \uD574\uC18C \uC911. \uC0C1\uD658\uC774 \uC2E0\uADDC \uB300\uCD9C\uC744 \uCD08\uACFC, \uD380\uB529 \uC800\uC870.",
    reg_deleveraged: "\uC2DC\uC7A5 \uC644\uC804 \uB514\uB808\uBC84\uB9AC\uC9D5. \uC5ED\uC0AC\uC801 \uC800\uC810\uC758 \uCC28\uC785 \uD65C\uB3D9\uACFC \uCD5C\uC18C \uD22C\uAE30\uC801 \uD3EC\uC9C0\uC158\uB2DD.",
    act_extreme: "\uB514\uB808\uBC84\uB9AC\uC9D5 \uB9AC\uC2A4\uD06C \uB192\uC74C. \uC775\uC2A4\uD3EC\uC838 \uCD95\uC18C, \uC218\uC775 \uD655\uC815, \uCE90\uC2A4\uCF00\uC774\uB4DC \uCCAD\uC0B0 \uB300\uBE44 \uACE0\uB824.",
    act_leveraging: "\uC77C\uB4DC \uAE30\uD68C\uB294 \uAC15\uD558\uC9C0\uB9CC \uD63C\uC7A1. utilization kink-point \uC811\uADFC \uBAA8\uB2C8\uD130\uB9C1 \uD544\uC218.",
    act_warming: "\uC77C\uB4DC \uC804\uB7B5 \uC9C4\uC785 \uC88B\uC740 \uC2DC\uC810. \uB300\uCD9C \uBE44\uC6A9 \uC801\uC815, \uC6A9\uB7C9 \uC5EC\uC720.",
    act_neutral: "\uD45C\uC900 \uC6B4\uC6A9 \uD658\uACBD. \uB9E4\uD06C\uB85C \uB808\uBC84\uB9AC\uC9C0 \uBCA0\uD305\uBCF4\uB2E4 \uD504\uB85C\uD1A0\uCF5C \uB808\uBCA8 \uAE30\uD68C\uC5D0 \uC9D1\uC911.",
    act_cooling: "\uCC28\uC785 \uBE44\uC6A9 \uC800\uB834. \uACBD\uC7C1 \uC801\uC740 \uD658\uACBD\uC5D0\uC11C \uB808\uBC84\uB9AC\uC9C0 \uC77C\uB4DC \uD3EC\uC9C0\uC158 \uCD95\uC801 \uAE30\uD68C.",
    act_deleveraged: "\uB808\uBC84\uB9AC\uC9C0 \uC77C\uB4DC \uD30C\uBC0D \uCD5C\uB300 \uAE30\uD68C. \uC800\uB834\uD55C \uB300\uCD9C, \uBE48 \uD480, \uB113\uC740 \uC2A4\uD504\uB808\uB4DC.",
    sig_br_high: "\uB300\uCD9C \uAE08\uB9AC \uC0C1\uC2B9", sig_br_low: "\uB300\uCD9C \uAE08\uB9AC \uD558\uB77D",
    sig_fund_hot: "Perp \uD380\uB529 \uACFC\uC5F4", sig_fund_neg: "Perp \uD380\uB529 \uC74C\uC218",
    sig_util_high: "\uD480 \uD65C\uC6A9\uB960 \uB192\uC74C", sig_oi_high: "Hyperliquid OI \uC0C1\uC2B9",
    sig_alt_frenzy: "\uC54C\uD2B8 \uB808\uBC84\uB9AC\uC9C0 \uD3ED\uBC1C", sig_expand: "\uC21C \uB808\uBC84\uB9AC\uC9C0 \uD655\uB300",
    sig_delever: "\uC21C \uB514\uB808\uBC84\uB9AC\uC9D5", sig_vol_surge: "\uB300\uCD9C \uBCFC\uB968 \uAE09\uC99D",
    sig_vol_crash: "\uB300\uCD9C \uBCFC\uB968 \uAE09\uAC10",
  }
};

function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }
function scoreLinear(v, cold, neut, hot, ext) {
  if (v <= cold) return -2; if (v <= neut) return lerp(-2, 0, (v - cold) / (neut - cold));
  if (v <= hot) return lerp(0, 2, (v - neut) / (hot - neut));
  if (v <= ext) return lerp(2, 3, (v - hot) / (ext - hot)); return 3;
}
function sColor(s) { if (s <= -1.5) return "#0ea371"; if (s <= -0.5) return "#4da87a"; if (s <= 0.5) return "#888"; if (s <= 1.5) return "#c47a20"; if (s <= 2.2) return "#d4522a"; return "#c41830"; }
function sLabel(s) { if (s <= -2) return "FROZEN"; if (s <= -1) return "COLD"; if (s <= -0.3) return "COOL"; if (s <= 0.3) return "NEUTRAL"; if (s <= 1) return "WARM"; if (s <= 2) return "HOT"; return "EXTREME"; }
function fmt(n, d) { if (d === undefined) d = 1; if (n == null || isNaN(n)) return "\u2014"; if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d) + "B"; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + "M"; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d) + "K"; return n.toFixed(d); }
function pct(n, d) { if (d === undefined) d = 2; if (n == null || isNaN(n)) return "\u2014"; return n.toFixed(d) + "%"; }

function getRegime(comp, t) {
  if (comp >= 2) return { label: "EXTREME LEVERAGE", color: "#c41830", emoji: "\uD83D\uDD25", desc: t.reg_extreme, act: t.act_extreme };
  if (comp >= 1) return { label: "LEVERAGING UP", color: "#d4522a", emoji: "\u26A0\uFE0F", desc: t.reg_leveraging, act: t.act_leveraging };
  if (comp >= 0.3) return { label: "WARMING", color: "#c47a20", emoji: "\uD83D\uDCC8", desc: t.reg_warming, act: t.act_warming };
  if (comp >= -0.3) return { label: "NEUTRAL", color: "#888", emoji: "\u2796", desc: t.reg_neutral, act: t.act_neutral };
  if (comp >= -1) return { label: "COOLING", color: "#4da87a", emoji: "\uD83D\uDCC9", desc: t.reg_cooling, act: t.act_cooling };
  return { label: "DELEVERAGED", color: "#0ea371", emoji: "\u2744\uFE0F", desc: t.reg_deleveraged, act: t.act_deleveraged };
}

function getSignals(m, dm, t) {
  var s = [];
  if (m) {
    if (m.brS > 1) s.push(t.sig_br_high + " (" + pct(m.wBR) + ")");
    else if (m.brS < -1) s.push(t.sig_br_low + " (" + pct(m.wBR) + ")");
    if (m.fS > 1) s.push(t.sig_fund_hot + " (" + pct(m.fAvg) + " ann)");
    else if (m.fS < -1) s.push(t.sig_fund_neg + " (" + pct(m.fAvg) + " ann)");
    if (m.uS > 1) s.push(t.sig_util_high + " (" + pct(m.wU) + ")");
    if (m.oiS > 1) s.push(t.sig_oi_high + " ($" + fmt(m.tOI) + ")");
    if (m.cS > 1) s.push(t.sig_alt_frenzy + " (BTC+ETH " + pct(m.conc, 0) + ")");
  }
  if (dm) {
    if (dm.brRatio > 1.1) s.push(t.sig_expand + " (B/R " + dm.brRatio.toFixed(2) + "x)");
    else if (dm.brRatio < 0.9) s.push(t.sig_delever + " (B/R " + dm.brRatio.toFixed(2) + "x)");
    if (dm.volChange > 20) s.push(t.sig_vol_surge + " (+" + dm.volChange.toFixed(0) + "%)");
    else if (dm.volChange < -20) s.push(t.sig_vol_crash + " (" + dm.volChange.toFixed(0) + "%)");
  }
  return s;
}

// ── Gauge ──
function Gauge({ score, size }) {
  if (!size) size = 140;
  var r = size * 0.36, cx = size / 2, cy = size * 0.5;
  var sA = -210, eA = 30, range = eA - sA, t = (score + 3) / 6, nA = sA + range * t;
  var toR = function(a) { return (a * Math.PI) / 180; };
  var arc = function(a1, a2) { var s = toR(a1), e = toR(a2); return "M " + (cx + r * Math.cos(s)) + " " + (cy + r * Math.sin(s)) + " A " + r + " " + r + " 0 " + (a2 - a1 > 180 ? 1 : 0) + " 1 " + (cx + r * Math.cos(e)) + " " + (cy + r * Math.sin(e)); };
  var arcPaths = Array.from({ length: 60 }, function(_, i) { var f = i / 60; return <path key={i} d={arc(sA + range * f, sA + range * (f + 1 / 60))} stroke={sColor(-3 + 6 * f)} strokeWidth={5} fill="none" opacity={0.25} />; });
  var nd = toR(nA), nl = r * 0.75;
  return (<svg width={size} height={size * 0.56} viewBox={"0 0 " + size + " " + (size * 0.56)}>
    {arcPaths}
    <line x1={cx} y1={cy} x2={cx + nl * Math.cos(nd)} y2={cy + nl * Math.sin(nd)} stroke={sColor(score)} strokeWidth={2} strokeLinecap="round" />
    <circle cx={cx} cy={cy} r={3} fill={sColor(score)} />
    <text x={cx} y={cy + 18} textAnchor="middle" fill={sColor(score)} style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--f)" }}>{score > 0 ? "+" : ""}{score.toFixed(2)}</text>
    <text x={cx} y={cy + 30} textAnchor="middle" fill={sColor(score)} style={{ fontSize: 8, fontWeight: 600, fontFamily: "var(--f)", letterSpacing: 1.5 }}>{sLabel(score)}</text>
  </svg>);
}

// ── Chart ──
var PERIODS = [{ label: "30D", days: 30 }, { label: "90D", days: 90 }, { label: "180D", days: 180 }, { label: "1Y", days: 365 }, { label: "2Y", days: 730 }, { label: "ALL", days: 9999 }];

function BorrowChart({ data, period, setPeriod, t }) {
  if (!data || data.length < 3) return null;
  var now = new Date();
  var cutoff = new Date(now.getTime() - period * 86400000);
  var filtered = period >= 9999 ? data : data.filter(function(d) { return new Date(d.dt) >= cutoff; });
  if (filtered.length < 2) filtered = data;

  var maData = [];
  for (var i = 0; i < filtered.length; i++) {
    var start = Math.max(0, i - 6), sum = 0, cnt = 0;
    for (var j = start; j <= i; j++) { sum += filtered[j].borrow; cnt++; }
    maData.push(sum / cnt);
  }

  var W = 960, H = 300, pad = { t: 14, r: 14, b: 34, l: 56 };
  var cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var sorted = filtered.map(function(d) { return d.borrow; }).sort(function(a, b) { return a - b; });
  var p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  var maxB = Math.max(p95 * 1.15, 1);
  var maxNet = 0, minNet = 0;
  for (var i = 0; i < filtered.length; i++) { var net = filtered[i].borrow - filtered[i].repay; if (net > maxNet) maxNet = net; if (net < minNet) minNet = net; }
  var netAbs = Math.max(Math.abs(maxNet), Math.abs(minNet)) * 1.2 || 1;

  var maPts = [], netPts = [];
  for (var i = 0; i < filtered.length; i++) {
    var x = pad.l + (i / (filtered.length - 1)) * cW;
    maPts.push(x + "," + (pad.t + cH - Math.min(maData[i] / maxB, 1.2) * cH));
    var netVal = filtered[i].borrow - filtered[i].repay;
    netPts.push({ x: x, y: pad.t + cH / 2 - (netVal / netAbs) * (cH / 2), val: netVal });
  }
  var maArea = "M " + pad.l + "," + (pad.t + cH) + " L " + maPts.join(" L ") + " L " + (pad.l + cW) + "," + (pad.t + cH) + " Z";
  var maLine = "M " + maPts.join(" L ");
  var barW = Math.max(1.5, cW / filtered.length * 0.7);
  var netBars = netPts.map(function(p, i) { var baseY = pad.t + cH / 2; var h = Math.abs(baseY - p.y); return <rect key={i} x={p.x - barW / 2} y={p.val >= 0 ? p.y : baseY} width={barW} height={h || 0.5} fill={p.val >= 0 ? "#0ea37150" : "#d4522a50"} />; });
  var labels = [], step = Math.max(1, Math.floor(filtered.length / 12));
  for (var i = 0; i < filtered.length; i += step) { var x = pad.l + (i / (filtered.length - 1)) * cW; labels.push(<text key={i} x={x} y={H - 6} textAnchor="middle" fill="#999" style={{ fontSize: 9.5 }}>{filtered[i].dt.split(" ")[0]}</text>); }
  var yTicks = [0, maxB * 0.25, maxB * 0.5, maxB * 0.75, maxB];
  var yLabels = yTicks.map(function(v, i) { var y = pad.t + cH - (v / maxB) * cH; return <g key={i}><line x1={pad.l} y1={y} x2={pad.l + cW} y2={y} stroke="#f0f0f2" strokeWidth={0.5} /><text x={pad.l - 4} y={y + 3} textAnchor="end" fill="#aaa" style={{ fontSize: 9 }}>${fmt(v, 0)}</text></g>; });

  return (<div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{t.chart_title} &middot; {period >= 9999 ? "ALL" : period + "D"}</span>
      <div style={{ display: "flex", gap: 2 }}>
        {PERIODS.map(function(p) { var active = p.days === period; return <button key={p.label} onClick={function() { setPeriod(p.days); }} style={{ background: active ? "#111" : "#fff", color: active ? "#fff" : "#999", border: "1px solid " + (active ? "#111" : "#e0e0e4"), borderRadius: 3, padding: "2px 7px", fontSize: 9, fontFamily: "var(--f)", cursor: "pointer", fontWeight: active ? 700 : 400 }}>{p.label}</button>; })}
      </div>
    </div>
    <svg width="100%" height={H} viewBox={"0 0 " + W + " " + H} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      {yLabels}<path d={maArea} fill="#7c8cf510" />{netBars}<path d={maLine} stroke="#7c8cf5" strokeWidth={1.8} fill="none" />
      <line x1={pad.l} y1={pad.t + cH} x2={pad.l + cW} y2={pad.t + cH} stroke="#e0e0e4" strokeWidth={0.5} />{labels}
    </svg>
    <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 9, color: "#999", flexWrap: "wrap" }}>
      <span title={t.borrow_vol_exp}><span style={{ display: "inline-block", width: 12, height: 2, background: "#7c8cf5", borderRadius: 1, marginRight: 3 }}></span>{t.borrow_vol}</span>
      <span title={t.net_inflow_exp}><span style={{ display: "inline-block", width: 8, height: 8, background: "#0ea37150", borderRadius: 1, marginRight: 3 }}></span>{t.net_inflow}</span>
      <span title={t.net_outflow_exp}><span style={{ display: "inline-block", width: 8, height: 8, background: "#d4522a50", borderRadius: 1, marginRight: 3 }}></span>{t.net_outflow}</span>
    </div>
    <div style={{ fontSize: 9, color: "#bbb", marginTop: 4, lineHeight: 1.5 }}>
      {t.borrow_vol}: {t.borrow_vol_exp} &middot; {t.net_inflow}: {t.net_inflow_exp} &middot; {t.net_outflow}: {t.net_outflow_exp}
    </div>
  </div>);
}

// ── Row with tooltip ──
function Row({ label, val, score, sub, exp }) {
  var _s = useState(false), showExp = _s[0], setShowExp = _s[1];
  return (<div>
    <div onClick={exp ? function() { setShowExp(!showExp); } : undefined} style={{ display: "flex", alignItems: "center", padding: "5px 0", gap: 6, borderBottom: "1px solid #f0f0f2", cursor: exp ? "pointer" : "default" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {exp && <span style={{ color: "#bbb", marginRight: 3, fontSize: 9 }}>{showExp ? "\u25BC" : "\u25B6"}</span>}
          {label}
        </div>
        {sub && <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#222", minWidth: 65, textAlign: "right", whiteSpace: "nowrap" }}>{val}</div>
      {score != null && <div style={{ fontSize: 10, fontWeight: 700, color: sColor(score), minWidth: 36, textAlign: "right", padding: "1px 5px", borderRadius: 3, background: sColor(score) + "12" }}>{score > 0 ? "+" : ""}{score.toFixed(1)}</div>}
    </div>
    {showExp && exp && <div style={{ fontSize: 10, color: "#777", padding: "4px 0 6px 14px", lineHeight: 1.5, borderBottom: "1px solid #f0f0f2" }}>{exp}</div>}
  </div>);
}

function Layer({ title, wt, score, children }) {
  return (<div style={{ border: "1px solid #e8e8ec", borderRadius: 6, padding: "10px 12px", flex: "1 1 240px", minWidth: 240, background: "#fff" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#999", letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
      <span style={{ fontSize: 9, color: "#bbb" }}>{wt}%</span>
    </div>
    {children}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 6, borderTop: "1px solid #eee" }}>
      <span style={{ fontSize: 10, color: "#aaa" }}>Score</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: sColor(score) }}>{score > 0 ? "+" : ""}{score.toFixed(2)}</span>
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
  var _t = useState(null), ts = _t[0], setTs = _t[1];
  var _r = useState(false), showRaw = _r[0], setShowRaw = _r[1];
  var _d = useState(null), duneData = _d[0], setDuneData = _d[1];
  var _dl = useState(false), duneLoading = _dl[0], setDuneLoading = _dl[1];
  var _cp = useState(9999), chartPeriod = _cp[0], setChartPeriod = _cp[1];

  var fetchAll = useCallback(function() {
    setLoading(true); setError(null); var status = {};
    Promise.allSettled([
      fetch("https://yields.llama.fi/poolsBorrow").then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true").then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
      fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "metaAndAssetCtxs" }) }).then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }),
    ]).then(function(results) {
      var pR = results[0], bR = results[1], hR = results[2];
      if (pR.status === "fulfilled") {
        status.llama = "ok"; var d = (pR.value && pR.value.data) ? pR.value.data : [], filtered = [];
        for (var i = 0; i < d.length; i++) {
          var p = d[i], proj = (p.project || "").toLowerCase(), sym = (p.symbol || "").toLowerCase();
          var matchP = LLAMA_PROTOCOLS.indexOf(proj) !== -1, matchS = false;
          for (var j = 0; j < STABLES.length; j++) { if (sym.indexOf(STABLES[j]) !== -1) { matchS = true; break; } }
          if (matchP && matchS && (p.totalBorrowUsd || 0) > 1000000) filtered.push({ project: p.project, symbol: p.symbol, chain: p.chain, tvlUsd: p.tvlUsd || 0, apyBorrow: p.apyBaseBorrow || 0, totalBorrowUsd: p.totalBorrowUsd || 0, totalSupplyUsd: p.totalSupplyUsd || 0, utilization: (p.totalSupplyUsd > 0) ? (p.totalBorrowUsd / p.totalSupplyUsd) * 100 : 0 });
        }
        filtered.sort(function(a, b) { return b.totalBorrowUsd - a.totalBorrowUsd; }); setPools(filtered);
      } else { status.llama = String((pR.reason && pR.reason.message) || "failed"); }
      if (bR.status === "fulfilled" && bR.value && bR.value.bitcoin) { status.coingecko = "ok"; setBtcMcap(bR.value.bitcoin.usd_market_cap); }
      else { status.coingecko = bR.status === "rejected" ? String((bR.reason && bR.reason.message) || "failed") : "no data"; }
      if (hR.status === "fulfilled" && Array.isArray(hR.value)) {
        status.hyperliquid = "ok"; var meta = hR.value[0], ctx = hR.value[1], universe = (meta && meta.universe) ? meta.universe : [], mapped = [];
        for (var k = 0; k < universe.length; k++) mapped.push({ name: universe[k].name, funding: parseFloat((ctx[k] && ctx[k].funding) || 0), openInterest: parseFloat((ctx[k] && ctx[k].openInterest) || 0), markPx: parseFloat((ctx[k] && ctx[k].markPx) || 0) });
        setHlData(mapped);
      } else { status.hyperliquid = hR.status === "rejected" ? String((hR.reason && hR.reason.message) || "failed") : "no data"; }
      setApiStatus(status); setTs(new Date()); setLoading(false);
    }).catch(function(e) { setError(String(e.message || e)); setLoading(false); });
  }, []);

  var fetchDune = useCallback(function() {
    setDuneLoading(true);
    fetch("/api/dune").then(function(r) { return r.json(); }).then(function(data) {
      if (data.rows) {
        var byDate = {};
        for (var i = 0; i < data.rows.length; i++) { var row = data.rows[i], dt = row.dt.split(" ")[0]; if (!byDate[dt]) byDate[dt] = { dt: row.dt, borrow: 0, repay: 0, count: 0 }; byDate[dt].borrow += row.daily_borrow_usd || 0; byDate[dt].repay += row.daily_repay_usd || 0; byDate[dt].count += row.borrow_count || 0; }
        var arr = Object.values(byDate); arr.sort(function(a, b) { return a.dt < b.dt ? -1 : 1; }); setDuneData(arr);
      }
      setDuneLoading(false);
    }).catch(function() { setDuneLoading(false); });
  }, []);

  useEffect(function() { fetchAll(); fetchDune(); }, [fetchAll, fetchDune]);

  var duneMetrics = useMemo(function() {
    if (!duneData || duneData.length < 7) return null;
    var last7 = duneData.slice(-7), prev7 = duneData.slice(-14, -7);
    var sumB7 = 0, sumR7 = 0, sumBP = 0;
    for (var i = 0; i < last7.length; i++) { sumB7 += last7[i].borrow; sumR7 += last7[i].repay; }
    for (var i = 0; i < prev7.length; i++) { sumBP += prev7[i].borrow; }
    var avgB7 = sumB7 / 7, avgBP = prev7.length ? sumBP / prev7.length : avgB7;
    return { avgB7: avgB7, brRatio: sumR7 > 0 ? sumB7 / sumR7 : 1, volChange: avgBP > 0 ? ((avgB7 - avgBP) / avgBP) * 100 : 0, netFlow7: sumB7 - sumR7 };
  }, [duneData]);

  var m = useMemo(function() {
    if (!pools.length) return null;
    var totalW = 0; for (var i = 0; i < pools.length; i++) totalW += pools[i].totalBorrowUsd;
    var wBR = 0; if (totalW > 0) { var sumBR = 0; for (var i = 0; i < pools.length; i++) sumBR += pools[i].apyBorrow * pools[i].totalBorrowUsd; wBR = sumBR / totalW; }
    var brS = scoreLinear(wBR, 3, 7, 20, 45);
    var btcF = null, ethF = null;
    if (hlData) { for (var i = 0; i < hlData.length; i++) { if (hlData[i].name === "BTC") btcF = hlData[i]; if (hlData[i].name === "ETH") ethF = hlData[i]; } }
    var btcFA = btcF ? btcF.funding * 3 * 365 * 100 : null, ethFA = ethF ? ethF.funding * 3 * 365 * 100 : null;
    var fArr = []; if (btcFA != null) fArr.push(btcFA); if (ethFA != null) fArr.push(ethFA);
    var fAvg = fArr.length ? fArr.reduce(function(a, b) { return a + b; }, 0) / fArr.length : 0;
    var fS = scoreLinear(fAvg, -5, 5, 25, 70);
    var l1 = brS * 0.55 + fS * 0.45;
    var wU = 0; if (totalW > 0) { var sumU = 0; for (var i = 0; i < pools.length; i++) sumU += pools[i].utilization * pools[i].totalBorrowUsd; wU = sumU / totalW; }
    var uS = scoreLinear(wU, 55, 72, 87, 95), tB = totalW;
    var bMR = btcMcap ? (tB / btcMcap) * 100 : null, bMS = bMR != null ? scoreLinear(bMR, 0.2, 0.5, 1.2, 2.5) : 0;
    var bAS = scoreLinear(tB / 1e9, 2, 6, 15, 30);
    var volMomS = duneMetrics ? scoreLinear(duneMetrics.volChange, -30, 0, 30, 80) : 0;
    var l2 = uS * 0.25 + bMS * 0.25 + bAS * 0.3 + volMomS * 0.2;
    var tOI = 0; if (hlData) { for (var i = 0; i < hlData.length; i++) tOI += hlData[i].openInterest * hlData[i].markPx; }
    var btcOI = btcF ? btcF.openInterest * btcF.markPx : 0, ethOI = ethF ? ethF.openInterest * ethF.markPx : 0;
    var conc = tOI > 0 ? ((btcOI + ethOI) / tOI) * 100 : 0;
    var cS = tOI > 0 ? scoreLinear(100 - conc, 20, 35, 55, 75) : 0;
    var oiS = tOI > 0 ? scoreLinear(tOI / 1e9, 3, 8, 20, 40) : 0;
    var fDiv = (btcFA != null && ethFA != null) ? Math.abs(btcFA - ethFA) : 0, dS = scoreLinear(fDiv, 2, 8, 25, 60);
    var netFlowS = duneMetrics ? scoreLinear(duneMetrics.brRatio, 0.7, 0.95, 1.15, 1.5) : 0;
    var l3 = oiS * 0.35 + cS * 0.2 + dS * 0.2 + netFlowS * 0.25;
    var comp = l1 * 0.4 + l2 * 0.35 + l3 * 0.25;
    return { wBR: wBR, brS: brS, btcFA: btcFA, ethFA: ethFA, fAvg: fAvg, fS: fS, l1: l1, wU: wU, uS: uS, tB: tB, bMR: bMR, bMS: bMS, bAS: bAS, volMomS: volMomS, l2: l2, tOI: tOI, conc: conc, cS: cS, oiS: oiS, fDiv: fDiv, dS: dS, netFlowS: netFlowS, l3: l3, comp: comp };
  }, [pools, btcMcap, hlData, duneMetrics]);

  var regime = m ? getRegime(m.comp, t) : null;
  var signals = m ? getSignals(m, duneMetrics, t) : [];
  var f = "'IBM Plex Mono', 'SF Mono', 'Menlo', monospace";

  return (
    <div style={{ "--f": f, fontFamily: f, background: "#fafafa", minHeight: "100vh", padding: "16px 14px", color: "#333", fontSize: 12 }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111", letterSpacing: 0.3 }}>{t.title}</div>
          <div style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>{t.subtitle} &middot; {t.sources}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!loading && Object.keys(apiStatus).length > 0 && (
            <div style={{ display: "flex", gap: 5, fontSize: 8, marginRight: 4 }}>
              {[["LL", apiStatus.llama], ["CG", apiStatus.coingecko], ["HL", apiStatus.hyperliquid], ["DN", duneData ? "ok" : duneLoading ? "..." : "?"]].map(function(item) {
                return <span key={item[0]} style={{ color: item[1] === "ok" ? "#0ea371" : "#ccc", fontWeight: 600 }}>{item[0]}</span>;
              })}
            </div>
          )}
          <div style={{ display: "flex", border: "1px solid #ddd", borderRadius: 3, overflow: "hidden" }}>
            <button onClick={function() { setLang("en"); }} style={{ background: lang === "en" ? "#111" : "#fff", color: lang === "en" ? "#fff" : "#999", border: "none", padding: "2px 6px", fontSize: 9, fontFamily: f, cursor: "pointer", fontWeight: 600 }}>EN</button>
            <button onClick={function() { setLang("ko"); }} style={{ background: lang === "ko" ? "#111" : "#fff", color: lang === "ko" ? "#fff" : "#999", border: "none", padding: "2px 6px", fontSize: 9, fontFamily: f, cursor: "pointer", fontWeight: 600 }}>\uD55C</button>
          </div>
          {ts && <span style={{ fontSize: 9, color: "#bbb" }}>{ts.toLocaleTimeString()}</span>}
          <button onClick={function() { fetchAll(); fetchDune(); }} disabled={loading} style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 4, padding: "3px 10px", fontSize: 10, fontFamily: f, cursor: loading ? "wait" : "pointer", color: "#666" }}>{loading ? "..." : "\u21bb"}</button>
        </div>
      </div>

      {error && <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 11, color: "#c44" }}>{error}</div>}

      {loading ? <div style={{ textAlign: "center", padding: 60, color: "#bbb", fontSize: 11 }}>Fetching data...</div> : !m ? <div style={{ textAlign: "center", padding: 40, color: "#999", fontSize: 11 }}>No data loaded. Click refresh.</div> : (<>

        {/* ── REGIME PANEL ── */}
        {regime && (<div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 130 }}>
            <Gauge score={m.comp} size={140} />
            <div style={{ fontSize: 11, fontWeight: 700, color: regime.color, marginTop: 2, letterSpacing: 0.5 }}>{regime.emoji} {regime.label}</div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase" }}>{t.regime}</div>
            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.6, marginBottom: 8 }}>{regime.desc}</div>
            <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5, marginBottom: 8, padding: "6px 10px", background: regime.color + "08", borderLeft: "3px solid " + regime.color, borderRadius: "0 4px 4px 0" }}>
              <b style={{ color: regime.color }}>{t.action}:</b> {regime.act}
            </div>
            {signals.length > 0 && (<div style={{ fontSize: 10, color: "#888", lineHeight: 1.6 }}>
              <b style={{ color: "#999" }}>{t.signals}:</b> {signals.map(function(s, i) { return <span key={i} style={{ display: "inline-block", marginRight: 10 }}>&bull; {s}</span>; })}
            </div>)}
            <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, color: "#888" }}>
              {[[t.cost_title, m.l1], [t.cap_title, m.l2], [t.risk_title, m.l3]].map(function(item) {
                return <span key={item[0]}>{item[0]}: <b style={{ color: sColor(item[1]) }}>{item[1] > 0 ? "+" : ""}{item[1].toFixed(2)}</b></span>;
              })}
            </div>
          </div>
        </div>)}

        {/* ── CHART ── */}
        {duneData && duneData.length > 3 && (<div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
          <BorrowChart data={duneData} period={chartPeriod} setPeriod={setChartPeriod} t={t} />
          {duneMetrics && (<div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10, color: "#888", flexWrap: "wrap", borderTop: "1px solid #f0f0f2", paddingTop: 6 }}>
            <span>{t.chart_7d}: <b>${fmt(duneMetrics.avgB7)}/day</b></span>
            <span>{t.chart_br}: <b style={{ color: sColor(m.netFlowS) }}>{duneMetrics.brRatio.toFixed(2)}x</b></span>
            <span>{t.chart_wow}: <b style={{ color: sColor(m.volMomS) }}>{duneMetrics.volChange > 0 ? "+" : ""}{duneMetrics.volChange.toFixed(1)}%</b></span>
            <span>{t.chart_net}: <b style={{ color: duneMetrics.netFlow7 >= 0 ? "#0ea371" : "#d4522a" }}>${fmt(duneMetrics.netFlow7)}</b></span>
          </div>)}
        </div>)}

        {/* ── 3 LAYERS ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <Layer title={t.cost_title} wt={40} score={m.l1}>
            <Row label="Avg Borrow APY (weighted)" val={pct(m.wBR)} score={m.brS} sub="Aave/Compound/Morpho/Spark/Venus/Radiant/Fluid" exp={t.exp_borrow_rate} />
            <Row label="BTC Funding (ann)" val={m.btcFA != null ? pct(m.btcFA) : "\u2014"} score={null} sub="Hyperliquid" exp={t.exp_btc_funding} />
            <Row label="ETH Funding (ann)" val={m.ethFA != null ? pct(m.ethFA) : "\u2014"} score={null} exp={t.exp_eth_funding} />
            <Row label="Avg Funding" val={pct(m.fAvg)} score={m.fS} exp={t.exp_avg_funding} />
          </Layer>
          <Layer title={t.cap_title} wt={35} score={m.l2}>
            <Row label="Pool Utilization (weighted)" val={pct(m.wU)} score={m.uS} exp={t.exp_util} />
            <Row label="Total Borrows" val={"$" + fmt(m.tB)} score={m.bAS} sub="absolute size" exp={t.exp_total_borrows} />
            <Row label="Borrows / BTC Mcap" val={m.bMR != null ? pct(m.bMR, 3) : "\u2014"} score={m.bMS} sub={btcMcap ? "mcap $" + fmt(btcMcap) : ""} exp={t.exp_borrows_mcap} />
            {duneMetrics && <Row label="7d Vol Momentum" val={(duneMetrics.volChange > 0 ? "+" : "") + duneMetrics.volChange.toFixed(1) + "%"} score={m.volMomS} sub="Dune" exp={t.exp_vol_mom} />}
          </Layer>
          <Layer title={t.risk_title} wt={25} score={m.l3}>
            <Row label="HL Total OI" val={"$" + fmt(m.tOI)} score={m.oiS} sub="notional all pairs" exp={t.exp_hl_oi} />
            <Row label="BTC+ETH OI %" val={pct(m.conc, 1)} score={m.cS} sub="low = alt frenzy" exp={t.exp_oi_conc} />
            <Row label="BTC-ETH Fund. Div" val={pct(m.fDiv, 1)} score={m.dS} exp={t.exp_fund_div} />
            {duneMetrics && <Row label="Net Leverage Flow" val={duneMetrics.brRatio.toFixed(2) + "x"} score={m.netFlowS} sub="Dune" exp={t.exp_net_flow} />}
          </Layer>
        </div>

        {/* Scale */}
        <div style={{ display: "flex", gap: 2, marginBottom: 10, alignItems: "center", fontSize: 9, color: "#aaa", flexWrap: "wrap" }}>
          {[[-3, "FROZEN"], [-2, "COLD"], [-1, "COOL"], [0, "NEUT"], [1, "WARM"], [2, "HOT"], [3, "EXTR"]].map(function(item) {
            return <span key={item[0]} style={{ display: "flex", alignItems: "center", gap: 2, marginRight: 6 }}><span style={{ width: 6, height: 6, borderRadius: 1, background: sColor(item[0]), display: "inline-block" }} /><span style={{ color: sColor(item[0]), fontWeight: 600 }}>{item[0] > 0 ? "+" : ""}{item[0]}</span><span>{item[1]}</span></span>;
          })}
        </div>

        {/* Coverage & Pool Data */}
        <div style={{ background: "#fff", border: "1px solid #e8e8ec", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
          <div onClick={function() { setShowRaw(!showRaw); }} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: 10, color: "#999", userSelect: "none" }}>
            <span>{t.pool_data} &middot; {pools.length} {t.pools}</span><span>{showRaw ? "\u25b2" : "\u25bc"}</span>
          </div>
          {showRaw && (<div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead><tr style={{ color: "#aaa", borderBottom: "1px solid #eee", textAlign: "left" }}>
                {[t.protocol, t.asset, t.chain, t.borrow_pct, t.util_pct, t.borrows, t.supply].map(function(h) { return <th key={h} style={{ padding: "5px 8px", fontWeight: 500 }}>{h}</th>; })}
              </tr></thead>
              <tbody>{pools.slice(0, 40).map(function(p, i) {
                return <tr key={i} style={{ borderBottom: "1px solid #f5f5f7", color: "#555" }}>
                  <td style={{ padding: "4px 8px" }}>{p.project}</td><td style={{ padding: "4px 8px" }}>{p.symbol}</td>
                  <td style={{ padding: "4px 8px", color: "#aaa" }}>{p.chain}</td>
                  <td style={{ padding: "4px 8px", color: p.apyBorrow > 15 ? "#d4522a" : "#555" }}>{pct(p.apyBorrow)}</td>
                  <td style={{ padding: "4px 8px", color: p.utilization > 85 ? "#d4522a" : "#555" }}>{pct(p.utilization)}</td>
                  <td style={{ padding: "4px 8px" }}>{"$" + fmt(p.totalBorrowUsd)}</td>
                  <td style={{ padding: "4px 8px", color: "#aaa" }}>{"$" + fmt(p.totalSupplyUsd)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>)}
        </div>

        {/* Footer */}
        <div style={{ fontSize: 8.5, color: "#bbb", lineHeight: 1.8 }}>
          <b style={{ color: "#999" }}>{t.coverage}:</b> {t.coverage_desc}<br />
          <b style={{ color: "#999" }}>{t.methodology}:</b> Cost(40%): TVL weighted borrow rate + perp funding | Capacity(35%): util + borrows + borrows/BTC mcap + Dune vol momentum | Risk(25%): HL OI + concentration + funding divergence + Dune net flow | Cron: daily 06:00 UTC
        </div>
      </>)}
    </div>
  );
}
