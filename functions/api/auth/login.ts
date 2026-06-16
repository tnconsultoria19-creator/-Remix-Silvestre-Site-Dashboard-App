import { generateJWT } from '../../_shared/jwt';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { email, password } = await request.json<any>();
    
    // Using D1 properly
    const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE email = ? AND password = ?')
      .bind(email, password)
      .first();
      
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = await generateJWT({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET || 'secret');
    return new Response(JSON.stringify({ user, token }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 });
  }
};
