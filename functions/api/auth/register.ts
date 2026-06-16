import { generateJWT } from '../../_shared/jwt';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { name, email, password } = await request.json<any>();
    
    // Check if user exists
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();
      
    if (existing) {
      return new Response(JSON.stringify({ error: 'User already exists' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const id = `usr_${Date.now()}`;
    await env.DB.prepare('INSERT INTO users (id, email, name, password, role) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, name, password, 'agent')
      .run();

    const user = { id, email, name, role: 'agent' };
    const token = await generateJWT({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET || 'secret');
    return new Response(JSON.stringify({ user, token }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
};
