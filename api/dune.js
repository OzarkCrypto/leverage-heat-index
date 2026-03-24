export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'DUNE_API_KEY not set' });

  var queryId = '6896576';
  var isCron = req.query.cron === '1';

  try {
    // Normal request: serve cached results only (no credits used)
    if (!isCron) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      var cachedRes = await fetch(
        'https://api.dune.com/api/v1/query/' + queryId + '/results?limit=50000',
        { headers: { 'X-Dune-API-Key': apiKey } }
      );
      var cachedData = await cachedRes.json();
      if (cachedData.result && cachedData.result.rows && cachedData.result.rows.length > 0) {
        return res.status(200).json({
          rows: cachedData.result.rows,
          cached: true,
          executed_at: cachedData.execution_ended_at || null,
          row_count: cachedData.result.rows.length
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
        'https://api.dune.com/api/v1/execution/' + executionId + '/results?limit=50000',
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
