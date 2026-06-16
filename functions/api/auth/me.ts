interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env, any, { user: any }> = async (context) => {
  const { env, data } = context;
  const payload = data.user;
  
  const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .bind(payload.sub)
    .first();
    
  return new Response(JSON.stringify({ user }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
