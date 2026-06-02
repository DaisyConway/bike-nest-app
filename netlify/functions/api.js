const { createClient } = require('@supabase/supabase-js');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify environment variables.');
  return createClient(url, key, { auth: { persistSession: false } });
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl || '');
  if (!match) throw new Error('Invalid image data.');
  return { mime: match[1] || 'application/octet-stream', buffer: Buffer.from(match[2], 'base64') };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  try {
    const supabase = getSupabase();
    const action = event.queryStringParameters?.action;

    if (event.httpMethod === 'GET' && action === 'locations') {
      const { data, error } = await supabase.from('locations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return json(200, { locations: data || [] });
    }

    return json(404, { error: 'Unknown action.' });
  } catch (err) {
    return json(500, {
      error: err.message || String(err),
      cause: err.cause?.message || null,
      code: err.code || null,
      urlPrefix: (process.env.SUPABASE_URL || '').slice(0, 35),
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      keyStarts: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 10)
    });
  }
};
