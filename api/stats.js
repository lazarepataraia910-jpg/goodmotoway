// Vercel serverless function: proxies the Vercel Web Analytics API for admin-stats.html.
// The Vercel token must never reach the browser, so every query runs here and the
// caller is verified as the admin through their Supabase session first.
//
// Required environment variables (Vercel -> Project -> Settings -> Environment Variables):
//   VERCEL_ANALYTICS_TOKEN  - a Vercel access token with read access to this project
//   VERCEL_PROJECT_ID       - the project id (Project -> Settings -> General)
//   VERCEL_TEAM_ID          - only if the project belongs to a team, not a personal account

const ADMIN_EMAIL = 'lazarepataraia910@gmail.com';
const SUPABASE_URL = 'https://lceebrhbvnyzoxkauugo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZWVicmhidm55em94a2F1dWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODkyNzAsImV4cCI6MjEwMTM2NTI3MH0.IeGvLg09wjni7OJdiLeAiO3pvrXxIUgzISNKnVKpXYI';
const AGGREGATE_URL = 'https://api.vercel.com/v1/query/web-analytics/visits/aggregate';

async function isAdminRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  const response = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_ANON_KEY }
  });
  if (!response.ok) return false;
  const user = await response.json();
  return typeof user.email === 'string' && user.email.toLowerCase() === ADMIN_EMAIL;
}

function rangeForDays(days) {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
}

async function aggregateBy(dimension, range, limit) {
  const params = new URLSearchParams({
    projectId: process.env.VERCEL_PROJECT_ID,
    since: range.since,
    until: range.until,
    limit: String(limit)
  });
  params.append('by', dimension);
  if (process.env.VERCEL_TEAM_ID) params.set('teamId', process.env.VERCEL_TEAM_ID);

  const response = await fetch(AGGREGATE_URL + '?' + params.toString(), {
    headers: { Authorization: 'Bearer ' + process.env.VERCEL_ANALYTICS_TOKEN }
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error('vercel_api_' + response.status + ': ' + body.slice(0, 200));
    error.status = response.status;
    throw error;
  }
  const json = await response.json();
  return Array.isArray(json.data) ? json.data : [];
}

function toList(rows, dimension) {
  return rows
    .map((row) => ({
      label: row[dimension] == null || row[dimension] === '' ? 'Others' : String(row[dimension]),
      pageviews: Number(row.pageviews) || 0,
      visitors: Number(row.visitors) || 0
    }))
    .sort((a, b) => b.pageviews - a.pageviews);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.VERCEL_ANALYTICS_TOKEN || !process.env.VERCEL_PROJECT_ID) {
    // names only — never the values — so a misconfigured deployment can say
    // which variable it is missing
    res.status(503).json({
      error: 'not_configured',
      missing: ['VERCEL_ANALYTICS_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID'].filter((n) => !process.env[n]),
      runtimeHasSystemEnv: !!process.env.VERCEL_ENV
    });
    return;
  }

  let admin = false;
  try {
    admin = await isAdminRequest(req);
  } catch (e) {
    admin = false;
  }
  if (!admin) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const requestedDays = Number((req.query && req.query.days) || 7);
  const days = Math.min(90, Math.max(1, Number.isFinite(requestedDays) ? requestedDays : 7));
  const range = rangeForDays(days);

  try {
    const [totalRows, series, pages, referrers, countries, devices, browsers, systems] = await Promise.all([
      aggregateBy('environment', range, 10),
      aggregateBy('day', range, 100),
      aggregateBy('requestPath', range, 10),
      aggregateBy('referrerHostname', range, 10),
      aggregateBy('country', range, 10),
      aggregateBy('deviceType', range, 10),
      aggregateBy('browserName', range, 10),
      aggregateBy('osName', range, 10)
    ]);

    res.status(200).json({
      range: { since: range.since, until: range.until, days },
      totals: totalRows.reduce(
        (sum, row) => ({
          pageviews: sum.pageviews + (Number(row.pageviews) || 0),
          visitors: sum.visitors + (Number(row.visitors) || 0)
        }),
        { pageviews: 0, visitors: 0 }
      ),
      series: series
        .map((row) => ({
          timestamp: row.timestamp,
          pageviews: Number(row.pageviews) || 0,
          visitors: Number(row.visitors) || 0
        }))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
      pages: toList(pages, 'requestPath'),
      referrers: toList(referrers, 'referrerHostname'),
      countries: toList(countries, 'country'),
      devices: toList(devices, 'deviceType'),
      browsers: toList(browsers, 'browserName'),
      systems: toList(systems, 'osName')
    });
  } catch (e) {
    res.status(502).json({ error: 'vercel_api_failed', message: e.message });
  }
};
