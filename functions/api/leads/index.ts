interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const { results } = await env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  
  const parsed = results.map((r: any) => ({
    ...r,
    contactPerson: r.contactPerson ? JSON.parse(r.contactPerson) : null,
    socials: r.socials ? JSON.parse(r.socials) : null,
    notes: r.notes ? JSON.parse(r.notes) : [],
    customFields: r.customFields ? JSON.parse(r.customFields) : [],
    uploads: r.uploads ? JSON.parse(r.uploads) : []
  }));
  
  return new Response(JSON.stringify(parsed), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const payload = await request.json<any>();
  const id = `lead_${Date.now()}`;
  
  await env.DB.prepare(`
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
  
  return new Response(JSON.stringify({ id, success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
