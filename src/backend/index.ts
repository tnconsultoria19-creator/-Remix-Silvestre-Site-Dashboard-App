import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  JWT_SECRET: string;
  ASSETS: Fetcher;
};

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Optional: Auth Middleware for API routes
app.use('/api/*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/register' || url.pathname === '/api') {
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET || 'secret', 'HS256');
    c.set('user', payload);
    return await next();
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

app.get('/api', (c) => {
  return c.json({
    status: 'ok',
    service: 'CRM API is running on Hono Worker',
    version: '1.0',
    endpoints: '/api/*'
  });
});

// AUTH
app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT id, email, name, role FROM users WHERE email = ? AND password = ?')
    .bind(email, password)
    .first();
    
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await sign({ sub: user.id, role: user.role, email: user.email }, c.env.JWT_SECRET || 'secret');
  return c.json({ user, token });
});

app.post('/api/auth/register', async (c) => {
  const { name, email, password } = await c.req.json();
  
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first();
    
  if (existing) {
    return c.json({ error: 'User already exists' }, 400);
  }

  const id = `usr_${Date.now()}`;
  await c.env.DB.prepare('INSERT INTO users (id, email, name, password, role) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, name, password, 'agent')
    .run();

  const user = { id, email, name, role: 'agent' };
  const token = await sign({ sub: user.id, role: user.role, email: user.email }, c.env.JWT_SECRET || 'secret');
  return c.json({ user, token });
});

app.get('/api/auth/me', async (c) => {
  const payload = c.get('user');
  const user = await c.env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?')
    .bind(payload.sub)
    .first();
  return c.json({ user });
});

// TICKETS
app.get('/api/tickets', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all();
  return c.json(results);
});

app.post('/api/tickets', async (c) => {
  const item = await c.req.json();
  const id = `tkt_${Date.now()}`;
  
  await c.env.DB.prepare(
    'INSERT INTO tickets (id, subject, description, priority) VALUES (?, ?, ?, ?)'
  ).bind(id, item.subject, item.description, item.priority || 'Medium').run();
  
  return c.json({ id, success: true });
});

// LEADS
app.get('/api/leads', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const parsed = results.map((r: any) => ({
    ...r,
    contactPerson: r.contactPerson ? JSON.parse(r.contactPerson) : null,
    socials: r.socials ? JSON.parse(r.socials) : null,
    notes: r.notes ? JSON.parse(r.notes) : [],
    customFields: r.customFields ? JSON.parse(r.customFields) : [],
    uploads: r.uploads ? JSON.parse(r.uploads) : []
  }));
  return c.json(parsed);
});

app.post('/api/leads', async (c) => {
  const payload = await c.req.json();
  const id = `lead_${Date.now()}`;
  
  await c.env.DB.prepare(`
    INSERT INTO leads (id, title, value, currency, status, assigned_to, contactPerson, socials, notes, customFields, uploads)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, payload.name || 'New Lead', payload.estValue || 0, payload.earningsCurrency || 'USD',
    payload.status || 'Available', payload.claimedBy || null,
    JSON.stringify(payload.contactPerson || {}),
    JSON.stringify(payload.socials || {}),
    JSON.stringify(payload.notes || []),
    JSON.stringify(payload.customFields || []),
    JSON.stringify(payload.uploads || [])
  ).run();
  
  return c.json({ id, success: true });
});

app.put('/api/leads/:id', async (c) => {
  const id = c.req.param('id');
  const payload = await c.req.json();
  
  const current = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<any>();
  if (!current) {
    return c.json({ error: 'Not found' }, 404);
  }

  let notes = current.notes ? JSON.parse(current.notes as string) : [];
  if (payload.newNote) notes.push(payload.newNote);

  let uploads = current.uploads ? JSON.parse(current.uploads as string) : [];
  if (payload.newUpload) uploads.push(payload.newUpload);

  let customFields = current.customFields ? JSON.parse(current.customFields as string) : [];
  if (payload.newCustomField) customFields.push(payload.newCustomField);

  const updates: string[] = [];
  const args: any[] = [];

  if (payload.status !== undefined) { updates.push('status = ?'); args.push(payload.status); }
  if (payload.claimedBy !== undefined) { updates.push('assigned_to = ?'); args.push(payload.claimedBy); }
  if (payload.commissionPaid !== undefined) { updates.push('"commission paid" = ?'); args.push(payload.commissionPaid ? 1 : 0); }
  
  if (payload.newNote) { updates.push('notes = ?'); args.push(JSON.stringify(notes)); }
  if (payload.newUpload) { updates.push('uploads = ?'); args.push(JSON.stringify(uploads)); }
  if (payload.newCustomField) { updates.push('customFields = ?'); args.push(JSON.stringify(customFields)); }

  if (updates.length > 0) {
    args.push(id);
    await c.env.DB.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).bind(...args).run();
  }

  return c.json({ success: true });
});

app.delete('/api/leads/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// AGENTS
app.get('/api/agents', async (c) => {
  const { results: users } = await c.env.DB.prepare('SELECT * FROM users').all();
  
  const agents = users.map((u: any) => ({
    name: u.name,
    email: u.email,
    isAdmin: u.role === 'admin' || u.role === 'superadmin',
    isApproved: true,
    didPassQuiz: true,
    isFrozen: false,
    avatarUrl: u.avatar_url || `https://ui-avatars.com/api/?name=${u.name}`,
    joinedDate: u.created_at,
    country: u.country || 'USA',
    completedCount: 0,
    rating: 5.0,
    earnings: 0,
    metrics: { accuracy: 100, speed: "Fast", reliability: 100 },
    certifications: []
  }));
  
  return c.json(agents);
});

app.put('/api/agents/:email', async (c) => {
  const email = decodeURIComponent(c.req.param('email'));
  const payload = await c.req.json();
  
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
    await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE email = ?`)
      .bind(...args)
      .run();
  }
  return c.json({ success: true });
});

app.delete('/api/agents/:email', async (c) => {
  const email = decodeURIComponent(c.req.param('email'));
  await c.env.DB.prepare('DELETE FROM users WHERE email = ?').bind(email).run();
  return c.json({ success: true });
});

// REPORTS
app.get('/api/reports/summary', async (c) => {
  const tickets = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tickets').first<{count: number}>();
  const leads = await c.env.DB.prepare('SELECT COUNT(*) as count FROM leads').first<{count: number}>();
  
  return c.json({ 
    tickets: tickets?.count || 0, 
    leads: leads?.count || 0, 
    timestamp: Date.now() 
  });
});

// KV STORE
app.get('/api/kv/:key', async (c) => {
  const key = c.req.param('key');
  const record = await c.env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind(key).first<{value: string}>();
  
  if (!record) {
    return c.json({ data: null });
  }

  try {
    return c.json({ data: JSON.parse(record.value) });
  } catch (e) {
    return c.json({ data: record.value });
  }
});

app.put('/api/kv/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.text();
  await c.env.DB.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
    .bind(key, body, body)
    .run();
  return c.json({ success: true });
});

// UPLOADS
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    if (!file) {
      return c.json({ error: 'No file' }, 400);
    }

    const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const arrayBuffer = await file.arrayBuffer();

    await c.env.FILES.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'application/pdf' }
    });
    
    const url = new URL(c.req.url);
    const retrievalUrl = `${url.origin}/cdn/${key}`;
    return c.json({ success: true, url: retrievalUrl, key });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// CDN FILES
app.get('/cdn/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.FILES.get(key);
  
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/pdf');
  }

  return new Response(object.body as any, { headers });
});

// SPA Fallback for generic routes managed by React Router
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/index.html';
  
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
  }
  return new Response("Not found", { status: 404 });
});

export default app;
