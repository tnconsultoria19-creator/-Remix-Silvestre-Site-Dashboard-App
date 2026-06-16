interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const { results } = await env.DB.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const item = await request.json<any>();
  const id = `tkt_${Date.now()}`;
  
  await env.DB.prepare(
    'INSERT INTO tickets (id, subject, description, priority) VALUES (?, ?, ?, ?)'
  ).bind(id, item.subject, item.description, item.priority || 'Medium').run();
  
  return new Response(JSON.stringify({ id, success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
