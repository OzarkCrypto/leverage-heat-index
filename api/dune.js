export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Dual API key + query redundancy
  // Primary: date-only aggregation (~1910 rows, 1 row per day)
  // Fallback: original query (per-project rows, more data but heavier)
  var SOURCES = [
    { key: process.env.DUNE_API_KEY_2 || 'lU25mqv3jmiIvv7MuiLgS8OUCboWRos8', query: '6904346' },
    { key: process.env.DUNE_API_KEY || 'tmHHeNfWxBGpriwS1p0oqcDC2fmb976x', query: '6896576' }
  ];

  var isCron = req.query.cron === '1';
  var PAGE_SIZE = 500;

  try {
    if (!isCron) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

      for (var si = 0; si < SOURCES.length; si++) {
        var src = SOURCES[si];
        var allRows = [];
        var ok = true;

        for (var page = 0; page < 5; page++) {
          var url = 'https://api.dune.com/api/v1/query/' + src.query + '/results?limit=' + PAGE_SIZE + '&offset=' + (page * PAGE_SIZE);
          var r = await fetch(url, { headers: { 'X-Dune-API-Key': src.key } });
          var d = await r.json();

          if (d.error) { ok = false; break; }
          var rows = (d.result && d.result.rows) || [];
          if (rows.length === 0) break;
          allRows = allRows.concat(rows);
          if (rows.length < PAGE_SIZE) break;
        }

        if (ok && allRows.length > 0) {
          return res.status(200).json({
            rows: allRows,
            cached: true,
            row_count: allRows.length,
            source: si
          });
        }
      }

      return res.status(200).json({ rows: [], cached: true, error: 'all sources failed' });
    }

    // Cron: execute with first working source
    res.setHeader('Cache-Control', 'no-cache');

    for (var si = 0; si < SOURCES.length; si++) {
      var src = SOURCES[si];
      var execRes = await fetch(
        'https://api.dune.com/api/v1/query/' + src.query + '/execute',
        { method: 'POST', headers: { 'X-Dune-API-Key': src.key, 'Content-Type': 'application/json' } }
      );
      var execData = await execRes.json();
      if (!execData.execution_id) continue;

      var exId = execData.execution_id;
      for (var att = 0; att < 18; att++) {
        await new Promise(function(r) { setTimeout(r, 3000); });
        var pollRes = await fetch(
          'https://api.dune.com/api/v1/execution/' + exId + '/results?limit=' + PAGE_SIZE,
          { headers: { 'X-Dune-API-Key': src.key } }
        );
        var pd = await pollRes.json();
        if (pd.state === 'QUERY_STATE_COMPLETED' && pd.result) {
          return res.status(200).json({
            rows: pd.result.rows || [],
            cached: false,
            row_count: (pd.result.rows || []).length,
            source: si,
            cron: true
          });
        }
        if (pd.state === 'QUERY_STATE_FAILED') break;
      }
    }

    return res.status(500).json({ error: 'All sources failed to execute' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
