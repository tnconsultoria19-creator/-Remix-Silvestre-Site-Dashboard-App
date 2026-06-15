import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// ✅ ADD THIS HERE
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'CRM API is running',
    version: '1.0',
    endpoints: '/api/*'
  });
});

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
  await c.env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type }
  });
  
  const url = `${c.req.url.split('/api/upload')[0]}/cdn/${key}`;
  return c.json({ success: true, url, key });
});

app.get('/cdn/:key', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.FILES.get(key);
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
  // Decode JSON fields since SQLite doesn't have native JSON arrays/objects
  const parsed = results.map(r => ({
    ...r,
    contactPerson: r.contactPerson ? JSON.parse(r.contactPerson as string) : null,
    socials: r.socials ? JSON.parse(r.socials as string) : null,
    notes: r.notes ? JSON.parse(r.notes as string) : [],
    customFields: r.customFields ? JSON.parse(r.customFields as string) : [],
    uploads: r.uploads ? JSON.parse(r.uploads as string) : []
  }));
  return c.json(parsed);
});

app.post('/api/leads', authMiddleware, async (c) => {
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

app.put('/api/leads/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const payload = await c.req.json();
  
  // Update logic handles merging or complete replacement depending on fields provided.
  // We'll simplisticly just update fields if present in a real app, but for this mock-turned-real,
  // let's grab the current, merge, then set.
  const current = await c.env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
  if (!current) return c.json({ error: 'Not found' }, 404);
  
  let notes = current.notes ? JSON.parse(current.notes as string) : [];
  if (payload.newNote) notes.push(payload.newNote);
  
  let uploads = current.uploads ? JSON.parse(current.uploads as string) : [];
  if (payload.newUpload) uploads.push(payload.newUpload);
  
  let customFields = current.customFields ? JSON.parse(current.customFields as string) : [];
  if (payload.newCustomField) customFields.push(payload.newCustomField);

  // Dynamic set builder
  const updates: string[] = [];
  const args: any[] = [];
  
  if (payload.status !== undefined) { updates.push('status = ?'); args.push(payload.status); }
  if (payload.claimedBy !== undefined) { updates.push('assigned_to = ?'); args.push(payload.claimedBy); }
  if (payload.commissionPaid !== undefined) { updates.push('commission paid = ?'); /* simplified */ }
  // Update JSON arrays
  if (payload.newNote) { updates.push('notes = ?'); args.push(JSON.stringify(notes)); }
  if (payload.newUpload) { updates.push('uploads = ?'); args.push(JSON.stringify(uploads)); }
  if (payload.newCustomField) { updates.push('customFields = ?'); args.push(JSON.stringify(customFields)); }

  if (updates.length > 0) {
    args.push(id);
    await c.env.DB.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).bind(...args).run();
  }
  
  return c.json({ success: true });
});

app.delete('/api/leads/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// --- REPORTS ---
app.get('/api/reports/summary', authMiddleware, async (c) => {
  const tickets = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tickets').first();
  const leads = await c.env.DB.prepare('SELECT COUNT(*) as count FROM leads').first();
  
  const report = { tickets: tickets?.count || 0, leads: leads?.count || 0, timestamp: Date.now() };
  return c.json(report);
});

// --- EMULATED KV API ---
app.get('/api/kv/:key', authMiddleware, async (c) => {
  const key = c.req.param('key');
  const record = await c.env.DB.prepare('SELECT value FROM kv_store WHERE key = ?').bind(key).first();
  if (!record) return c.json({ data: null });
  try {
    return c.json({ data: JSON.parse(record.value as string) });
  } catch (e) {
    return c.json({ data: record.value });
  }
});

app.put('/api/kv/:key', authMiddleware, async (c) => {
  const key = c.req.param('key');
  const body = await c.req.text();
  await c.env.DB.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
    .bind(key, body, body)
    .run();
  return c.json({ success: true });
});

export default app;
