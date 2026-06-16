interface Env {
  DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  if (!id) return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });

  const payload = await request.json<any>();
  const current = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<any>();
  if (!current) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
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
    await env.DB.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).bind(...args).run();
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!id) return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });

  await env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
