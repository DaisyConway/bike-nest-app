const https = require('https');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function requestSupabase(path) {
  return new Promise((resolve, reject) => {
    const baseUrl = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!baseUrl || !key) {
      reject(new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'));
      return;
    }

    const url = new URL(baseUrl + path);

    const req = https.request(url, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    const action = event.queryStringParameters?.action;

    if (event.httpMethod === 'GET' && action === 'locations') {
      const result = await requestSupabase('/rest/v1/locations?select=*&order=created_at.desc');
      return json(200, {
        supabaseStatus: result.status,
        result: result.body
      });
    }

    return json(404, { error: 'Unknown action.' });
  } catch (err) {
    return json(500, {
      error: err.message || String(err),
      code: err.code || null,
      hostname: err.hostname || null,
      urlPrefix: (process.env.SUPABASE_URL || '').slice(0, 45),
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      keyStarts: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 10)
    });
  }
};
