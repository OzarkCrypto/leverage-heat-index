export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

  var apiKey = process.env.DUNE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'DUNE_API_KEY not set' });
  }

  var queryId = '6896576';

  try {
    var latestRes = await fetch(
      'https://api.dune.com/api/v1/query/' + queryId + '/results?limit=5000',
      { headers: { 'X-Dune-API-Key': apiKey } }
    );
    var latestData = await latestRes.json();

    if (latestData.result && latestData.result.rows && latestData.result.rows.length > 0) {
      return res.status(200).json({
        rows: latestData.result.rows,
        cached: true,
        executed_at: latestData.execution_ended_at || null
      });
    }

    var execRes = await fetch(
      'https://api.dune.com/api/v1/query/' + queryId + '/execute',
      {
        method: 'POST',
        headers: {
          'X-Dune-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    var execData = await execRes.json();

    if (!execData.execution_id) {
      return res.status(500).json({ error: 'Failed to execute', detail: execData });
    }

    var executionId = execData.execution_id;
    var attempts = 0;
    while (attempts < 10) {
      await new Promise(function(r) { setTimeout(r, 3000); });
      var pollRes = await fetch(
        'https://api.dune.com/api/v1/execution/' + executionId + '/results?limit=5000',
        { headers: { 'X-Dune-API-Key': apiKey } }
      );
      var pollData = await pollRes.json();

      if (pollData.state === 'QUERY_STATE_COMPLETED' && pollData.result) {
        return res.status(200).json({
          rows: pollData.result.rows || [],
          cached: false,
          executed_at: pollData.execution_ended_at || null
        });
      }
      if (pollData.state === 'QUERY_STATE_FAILED') {
        return res.status(500).json({ error: 'Query failed', detail: pollData.error });
      }
      attempts++;
    }

    return res.status(504).json({ error: 'Query timed out' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
