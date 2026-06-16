interface Env {
  DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;
  const email = decodeURIComponent(emailParam);
  
  const payload = await request.json<any>();
  
  let updates = [];
  let args = [];
  
  if (payload.avatarUrl !== undefined) {
    updates.push('avatar_url = ?');
    args.push(payload.avatarUrl);
  }
  if (payload.isAdmin !== undefined) {
    updates.push('role = ?');
    args.push(payload.isAdmin ? 'admin' : 'agent');
  }
  
  if (updates.length > 0) {
    args.push(email);
    await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE email = ?`)
      .bind(...args)
      .run();
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;
  const email = decodeURIComponent(emailParam);
  
  await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(email).run();
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
