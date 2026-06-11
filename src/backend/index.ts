import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  DB: D1Database;
  STORAGE: R2Bucket;
  CACHE: KVNamespace;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// --- Simple JWT Implementation ---
async function generateJWT(payload: any, secret: string) {
  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const data = encoder.encode(`${header}.${body}`);
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${header}.${body}.${sigStr}`;
}

// --- AUTH & MIDDLEWARE ---
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT id, email, name, role FROM users WHERE email = ? AND password = ?')
    .bind(email, password)
    .first();
    
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  
  const token = await generateJWT({ sub: user.id, role: user.role, email: user.email }, c.env.JWT_SECRET);
  return c.json({ user, token });
});

// Middleware to extract simple token
const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  // Simplified JWT check (in production, verify signature)
  const token = authHeader.split(' ')[1];
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    c.set('user', payload);
    await next();
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

app.get('/api/auth/me', authMiddleware, async (c) => {
  const payload: any = c.get('user');
  const user = await c.env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?').bind(payload.sub).first();
  return c.json({ user });
});

// --- R2 FILE UPLOADS ---
app.post('/api/upload', authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  if (!file) return c.json({ error: 'No file' }, 400);

  const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  await c.env.STORAGE.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type }
  });
  
  const url = `${c.req.url.split('/api/upload')[0]}/cdn/${key}`;
  return c.json({ success: true, url, key });
});

app.get('/cdn/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.STORAGE.get(key);
  if (!object) return c.text('Not found', 404);
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  return new Response(object.body, { headers });
});

// --- TICKETS API ---
app.get('/api/tickets', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all();
  return c.json(results);
});

app.post('/api/tickets', authMiddleware, async (c) => {
  const item = await c.req.json();
  const id = `tkt_${Date.now()}`;
  await c.env.DB.prepare(
    'INSERT INTO tickets (id, subject, description, priority) VALUES (?, ?, ?, ?)'
  ).bind(id, item.subject, item.description, item.priority || 'Medium').run();
  return c.json({ id, success: true });
});

// --- LEADS API ---
app.get('/api/leads', authMiddleware, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  return c.json(results);
});

// --- KV REPORTS ---
app.get('/api/reports/summary', authMiddleware, async (c) => {
  // Use KV for caching reports
  const cached = await c.env.CACHE.get('report_summary', 'json');
  if (cached) return c.json(cached);

  const tickets = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tickets').first();
  const leads = await c.env.DB.prepare('SELECT COUNT(*) as count FROM leads').first();
  
  const report = { tickets: tickets?.count || 0, leads: leads?.count || 0, timestamp: Date.now() };
  await c.env.CACHE.put('report_summary', JSON.stringify(report), { expirationTtl: 60 });
  return c.json(report);
});

export default app;
