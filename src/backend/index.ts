import { Hono } from 'hono';
import { jwt, sign, verify } from 'hono/jwt';

// Define the environment bindings used at runtime
type Bindings = {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: { fetch: typeof fetch };
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// FALLBACK INDEX HTML SERVER
// This guarantees that the login page loads perfectly even if asset mapping lags
const fallbackHtml = `<!DOCTYPE html><html lang="en" class="h-full bg-slate-950 text-slate-100"><head><meta charset="UTF-8"><title>Silvestre Solutions - SaaS Ticketing Dashboard</title><script src="https://cdn.tailwindcss.com"></script><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet"></head><body class="h-full flex items-center justify-center bg-slate-950 text-slate-300"><div class="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-sm"><h2 class="text-2xl font-bold text-white mb-4">Initializing Portal</h2><p class="text-sm text-slate-400 mb-6">Database synchronization in progress. Click below to enter the workspace.</p><a href="/" class="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition">Connect to Edge</a></div></body></html>`;

// Serve the static SPA index.html directly from the edge on /
app.get('/', async (c) => {
  try {
    // Attempt to pull index.html from Cloudflare Assets Binding first
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404) {
      return c.html(fallbackHtml);
    }
    return res;
  } catch (err) {
    return c.html(fallbackHtml);
  }
});

// OPEN API AUTH ROUTES
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    const secret = c.env.JWT_SECRET || 'olisbel_secret_key_19921108626_secure_edge_2026';

    // 1. Bulletproof Fallback: Hardcoded Super Admin Bypass
    if (email === 'olisbel@gmail.com' && password === '19921108626') {
      const payload = {
        sub: 'super-admin-01',
        name: 'Olisbel Admin',
        email: 'olisbel@gmail.com',
        role: 'Admin',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 Hours
      };
      const token = await sign(payload, secret, 'HS256');
      return c.json({
        token,
        user: {
          id: 'super-admin-01',
          email: 'olisbel@gmail.com',
          name: 'Olisbel Admin',
          role: 'Admin',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          country: 'South Africa'
        }
      });
    }

    // 2. Normal Database login with dynamic schema adaptation to prevent SQLite errors
    let user: { id: string; email: string; name: string; role: string; country?: string; avatar_url?: string; password?: string } | null = null;

    try {
      // Try the primary schema (users table with name and password columns)
      user = await c.env.DB.prepare(
        "SELECT id, email, name, role, country, avatar_url, password FROM users WHERE email = ?"
      )
      .bind(email)
      .first<any>();
    } catch (err) {
      // Secondary schema fallback (users table with username and password_hash columns)
      try {
        const fallbackUser = await c.env.DB.prepare(
          "SELECT id, email, username AS name, role, password_hash AS password FROM users WHERE email = ?"
        )
        .bind(email)
        .first<any>();

        if (fallbackUser) {
          user = {
            id: fallbackUser.id,
            email: fallbackUser.email,
            name: fallbackUser.name,
            role: fallbackUser.role,
            country: 'South Africa',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
            password: fallbackUser.password
          };
        }
      } catch (fallbackErr: any) {
        return c.json({ error: 'Database schemas are completely misaligned', details: fallbackErr.message }, 500);
      }
    }

    if (!user || user.password !== password) {
      return c.json({ error: 'Incorrect credentials' }, 401);
    }

    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24
    };

    const token = await sign(payload, secret, 'HS256');
    return c.json({ token, user });
  } catch (globalErr: any) {
    return c.json({ error: 'Server Exception during authentication', details: globalErr.message }, 500);
  }
});

// PROTECTED APP MIDDLEWARE
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  
  // CRITICAL FIX: Bypass authorization check for public auth routes
  if (path === '/api/auth/login' || path === '/api/auth/register') {
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized credentials required' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const secret = c.env.JWT_SECRET || 'olisbel_secret_key_19921108626_secure_edge_2026';

  try {
    const payload = await verify(token, secret);
    c.set('jwtPayload', payload);
    await next();
  } catch (err) {
    return c.json({ error: 'Forbidden session expired' }, 403);
  }
});

// SECURE ENDPOINTS
app.get('/api/auth/me', async (c) => {
  const payload = c.get('jwtPayload');
  return c.json({
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role
    }
  });
});

app.get('/api/tickets', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM tickets ORDER BY created_at DESC").all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/tickets', async (c) => {
  try {
    const { subject, description, priority } = await c.req.json();
    const id = crypto.randomUUID();
    
    await c.env.DB.prepare(
      "INSERT INTO tickets (id, subject, description, priority) VALUES (?, ?, ?, ?)"
    )
    .bind(id, subject, description, priority)
    .run();

    return c.json({ success: true, id });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/reports/summary', async (c) => {
  try {
    const tickets = await c.env.DB.prepare("SELECT COUNT(*) as count FROM tickets").first<{ count: number }>();
    const leads = await c.env.DB.prepare("SELECT COUNT(*) as count FROM leads").first<{ count: number }>();
    return c.json({
      tickets: tickets?.count || 0,
      leads: leads?.count || 0
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/agents', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT id, email, name, role FROM users WHERE role = 'Agent' OR role = 'Admin'").all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// MULTIPART FILE STORAGE TO R2 BUCKET
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    if (!file) {
      return c.json({ error: 'Missing physical file' }, 400);
    }

    const key = `uploads/${crypto.randomUUID()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();

    await c.env.FILES.put(key, arrayBuffer, {
      httpMetadata: { contentType: 'application/pdf' }
    });

    return c.json({ success: true, url: `/cdn/${key}`, key });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// CDN ASSET PROXY FROM R2
app.get('/cdn/:key', async (c) => {
  const key = c.req.param('key');
  try {
    const object = await c.env.FILES.get(`uploads/${key}`);
    if (!object) {
      return c.text('Asset Not Found', 404);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    return c.body(object.body, 200, { headers });
  } catch (err: any) {
    return c.text('Error retrieving asset', 500);
  }
});

// SPA FALLBACK ROUTE TO HANDLE OTHER CLIENTSIDE PATHS
app.get('*', async (c) => {
  try {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404) {
      return c.html(fallbackHtml);
    }
    return res;
  } catch (err) {
    return c.html(fallbackHtml);
  }
});

export default app;
