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

    if (event.httpMethod === 'GET' && action === 'gallery') {
      const { data, error } = await supabase
        .from('photo_uploads')
        .select('*, locations(name,address,notes)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return json(200, { photos: data || [] });
    }

    if (event.httpMethod === 'POST' && action === 'location') {
      const body = JSON.parse(event.body || '{}');
      if (!body.name || !body.name.trim()) return json(400, { error: 'Location name is required.' });
      const { data, error } = await supabase
        .from('locations')
        .insert({ name: body.name.trim(), address: body.address || '', notes: body.notes || '' })
        .select('*')
        .single();
      if (error) throw error;
      return json(200, { location: data });
    }

    if (event.httpMethod === 'DELETE' && action === 'location') {
      const id = event.queryStringParameters?.id;
      if (!id) return json(400, { error: 'Location id is required.' });
      const { error } = await supabase.from('locations').delete().eq('id', id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    if (event.httpMethod === 'POST' && action === 'upload') {
      const body = JSON.parse(event.body || '{}');
      if (!body.location_id) return json(400, { error: 'Location is required.' });
      if (!body.uploader_name || !body.uploader_name.trim()) return json(400, { error: 'Your name is required.' });
      if (!Array.isArray(body.files) || body.files.length === 0) return json(400, { error: 'At least one photo is required.' });

      const saved = [];
      for (const file of body.files) {
        const { mime, buffer } = dataUrlToBuffer(file.dataUrl);
        const safeName = (file.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${body.location_id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
        const upload = await supabase.storage.from('maintenance-photos').upload(path, buffer, { contentType: mime, upsert: false });
        if (upload.error) throw upload.error;
        const { data: publicData } = supabase.storage.from('maintenance-photos').getPublicUrl(path);
        const photoUrl = publicData.publicUrl;
        const insert = await supabase
          .from('photo_uploads')
          .insert({
            location_id: body.location_id,
            uploader_name: body.uploader_name.trim(),
            notes: body.notes || '',
            photo_url: photoUrl,
            file_name: safeName
          })
          .select('*')
          .single();
        if (insert.error) throw insert.error;
        saved.push(insert.data);
      }
      return json(200, { photos: saved });
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
