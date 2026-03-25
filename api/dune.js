export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DUNE_API_KEY not set' });

  var queryId = '6896576';
  var isCron = req.query.cron === '1';
  var PAGE_SIZE = 500;

  try {
    if (!isCron) {
      // Normal request: fetch cached results with pagination
      // Date-only aggregation: ~1900 rows (one per day since 2021-01-01)
      // Old format (per-project): ~9000 rows — pagination still works, just gets fewer days
      // CDN caches the aggregated response for 1 hour
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

      var allRows = [];
      var offset = 0;
      var maxPages = 5; // 5 × 500 = 2500 rows max (covers full date-only history)

      for (var page = 0; page < maxPages; page++) {
        var url = 'https://api.dune.com/api/v1/query/' + queryId + '/results?limit=' + PAGE_SIZE + '&offset=' + offset;
        var pageRes = await fetch(url, { headers: { 'X-Dune-API-Key': apiKey } });
        var pageData = await pageRes.json();

        // Datapoint limit hit — return whatever we have
        if (pageData.error) break;

        var rows = (pageData.result && pageData.result.rows) || [];
        if (rows.length === 0) break;

        allRows = allRows.concat(rows);
        offset += PAGE_SIZE;

        // Fewer than PAGE_SIZE = last page
        if (rows.length < PAGE_SIZE) break;
      }

      if (allRows.length > 0) {
        return res.status(200).json({
          rows: allRows,
          cached: true,
          row_count: allRows.length,
          pages_fetched: page + 1
        });
      }
      return res.status(200).json({ rows: [], cached: true, error: 'no cached results' });
    }

    // Cron request: force execute query (uses 1 credit per day)
    res.setHeader('Cache-Control', 'no-cache');
    var execRes = await fetch(
      'https://api.dune.com/api/v1/query/' + queryId + '/execute',
      { method: 'POST', headers: { 'X-Dune-API-Key': apiKey, 'Content-Type': 'application/json' } }
    );
    var execData = await execRes.json();
    if (!execData.execution_id) {
      return res.status(500).json({ error: 'Failed to execute', detail: execData });
    }

    // Poll for results (max 55s for Vercel serverless limit)
    var executionId = execData.execution_id;
    var attempts = 0;
    while (attempts < 18) {
      await new Promise(function(r) { setTimeout(r, 3000); });
      var pollRes = await fetch(
        'https://api.dune.com/api/v1/execution/' + executionId + '/results?limit=' + PAGE_SIZE,
        { headers: { 'X-Dune-API-Key': apiKey } }
      );
      var pollData = await pollRes.json();
      if (pollData.state === 'QUERY_STATE_COMPLETED' && pollData.result) {
        return res.status(200).json({
          rows: pollData.result.rows || [],
          cached: false,
          executed_at: pollData.execution_ended_at || null,
          row_count: (pollData.result.rows || []).length,
          cron: true
        });
      }
      if (pollData.state === 'QUERY_STATE_FAILED') {
        return res.status(500).json({ error: 'Query failed', detail: pollData.error });
      }
      attempts++;
    }
    return res.status(200).json({ message: 'Query still running, results will be cached when done', execution_id: executionId });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
