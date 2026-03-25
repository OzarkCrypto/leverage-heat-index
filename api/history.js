// api/history.js
// Aggregates historical lending data from DeFiLlama chartLendBorrow API
// + CoinGecko BTC price/mcap
// Caches for 6 hours to avoid rate limiting

var POOL_IDS = null; // discovered dynamically
var PROTOCOLS = ["aave-v3", "compound-v3", "morpho-v1", "sparklend"];
var STABLES = ["usdc", "usdt", "dai", "usds"];

async function discoverPools() {
  var res = await fetch("https://yields.llama.fi/poolsBorrow");
  var data = await res.json();
  if (!data.data) return [];
  var pools = [];
  for (var i = 0; i < data.data.length; i++) {
    var p = data.data[i];
    var proj = (p.project || "").toLowerCase();
    var sym = (p.symbol || "").toLowerCase();
    var matchP = PROTOCOLS.indexOf(proj) !== -1;
    var matchS = false;
    for (var j = 0; j < STABLES.length; j++) { if (sym.indexOf(STABLES[j]) !== -1) { matchS = true; break; } }
    if (matchP && matchS && (p.totalBorrowUsd || 0) > 50000000) {
      pools.push({ pool: p.pool, project: p.project, symbol: p.symbol, chain: p.chain, borrow: p.totalBorrowUsd || 0 });
    }
  }
  pools.sort(function(a, b) { return b.borrow - a.borrow; });
  return pools.slice(0, 8); // top 8 pools by borrow size
}

async function fetchPoolHistory(poolId) {
  try {
    var res = await fetch("https://yields.llama.fi/chartLendBorrow/" + poolId);
    var data = await res.json();
    if (data.status === "success" && data.data) return data.data;
    return [];
  } catch (e) { return []; }
}

async function fetchBtcHistory() {
  try {
    var res = await fetch("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily");
    var data = await res.json();
    if (!data.prices) return [];
    var result = [];
    for (var i = 0; i < data.prices.length; i++) {
      result.push({
        timestamp: new Date(data.prices[i][0]).toISOString().split("T")[0],
        price: data.prices[i][1],
        mcap: data.market_caps[i] ? data.market_caps[i][1] : null
      });
    }
    return result;
  } catch (e) { return []; }
}

async function fetchHlFunding() {
  try {
    var now = Date.now();
    var start = now - 90 * 86400000; // 90 days
    var results = [];
    for (var coin of ["BTC", "ETH"]) {
      var res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fundingHistory", coin: coin, startTime: start })
      });
      var data = await res.json();
      if (Array.isArray(data)) {
        for (var i = 0; i < data.length; i++) {
          var dt = new Date(parseInt(data[i].time)).toISOString().split("T")[0];
          var found = results.find(function(r) { return r.dt === dt && r.coin === coin; });
          if (!found) {
            results.push({ dt: dt, coin: coin, funding: parseFloat(data[i].fundingRate), count: 1 });
          } else {
            found.funding += parseFloat(data[i].fundingRate);
            found.count++;
          }
        }
      }
    }
    // Average daily funding per coin
    var daily = {};
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (!daily[r.dt]) daily[r.dt] = {};
      daily[r.dt][r.coin] = (r.funding / r.count) * 3 * 365 * 100; // annualized from 8h rate
    }
    return daily;
  } catch (e) { return {}; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=43200"); // 6h cache

  try {
    // 1. Discover top pools
    var pools = await discoverPools();
    if (pools.length === 0) {
      return res.status(200).json({ error: "No pools discovered", history: [] });
    }

    // 2. Fetch history for each pool in parallel
    var poolHistories = await Promise.all(pools.map(function(p) {
      return fetchPoolHistory(p.pool).then(function(hist) {
        return { pool: p, history: hist };
      });
    }));

    // 3. Aggregate by date: weighted avg borrow rate, total borrows, weighted utilization
    var byDate = {};
    for (var i = 0; i < poolHistories.length; i++) {
      var ph = poolHistories[i];
      for (var j = 0; j < ph.history.length; j++) {
        var row = ph.history[j];
        var dt = row.timestamp.split("T")[0];
        if (!byDate[dt]) {
          byDate[dt] = { dt: dt, totalBorrow: 0, totalSupply: 0, weightedRate: 0, poolCount: 0 };
        }
        var borrow = row.totalBorrowUsd || 0;
        var supply = row.totalSupplyUsd || 0;
        var rate = row.apyBaseBorrow || 0;
        byDate[dt].totalBorrow += borrow;
        byDate[dt].totalSupply += supply;
        byDate[dt].weightedRate += rate * borrow;
        byDate[dt].poolCount++;
      }
    }

    // 4. Compute final metrics
    var history = [];
    var dates = Object.keys(byDate).sort();
    for (var i = 0; i < dates.length; i++) {
      var d = byDate[dates[i]];
      var avgRate = d.totalBorrow > 0 ? d.weightedRate / d.totalBorrow : 0;
      var util = d.totalSupply > 0 ? (d.totalBorrow / d.totalSupply) * 100 : 0;
      history.push({
        dt: d.dt,
        borrowRate: Math.round(avgRate * 100) / 100,
        utilization: Math.round(util * 100) / 100,
        totalBorrow: Math.round(d.totalBorrow),
        totalSupply: Math.round(d.totalSupply),
        poolCount: d.poolCount
      });
    }

    // 5. Fetch BTC history
    var btcHistory = await fetchBtcHistory();
    var btcByDate = {};
    for (var i = 0; i < btcHistory.length; i++) {
      btcByDate[btcHistory[i].timestamp] = btcHistory[i];
    }

    // 6. Merge BTC data into history
    for (var i = 0; i < history.length; i++) {
      var btc = btcByDate[history[i].dt];
      if (btc) {
        history[i].btcPrice = Math.round(btc.price);
        history[i].btcMcap = Math.round(btc.mcap);
        history[i].borrowMcapRatio = btc.mcap > 0 ? Math.round((history[i].totalBorrow / btc.mcap) * 10000) / 100 : null;
      }
    }

    // 7. Fetch HL funding (90d)
    var hlFunding = await fetchHlFunding();
    for (var i = 0; i < history.length; i++) {
      var fd = hlFunding[history[i].dt];
      if (fd) {
        history[i].btcFunding = Math.round((fd.BTC || 0) * 100) / 100;
        history[i].ethFunding = Math.round((fd.ETH || 0) * 100) / 100;
      }
    }

    return res.status(200).json({
      history: history,
      pools: pools.map(function(p) { return { project: p.project, symbol: p.symbol, chain: p.chain, borrow: p.borrow }; }),
      generated: new Date().toISOString()
    });

  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
