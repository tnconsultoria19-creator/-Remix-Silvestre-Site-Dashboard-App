interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;

  if (!key) return new Response(JSON.stringify({ error: 'Missing Key' }), { status: 400 });

  const record = await env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind(key).first<{value: string}>();
  if (!record) {
    return new Response(JSON.stringify({ data: null }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    return new Response(JSON.stringify({ data: JSON.parse(record.value) }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ data: record.value }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;

  if (!key) return new Response(JSON.stringify({ error: 'Missing Key' }), { status: 400 });

  const body = await request.text();
  await env.DB.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
    .bind(key, body, body)
    .run();
    
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
