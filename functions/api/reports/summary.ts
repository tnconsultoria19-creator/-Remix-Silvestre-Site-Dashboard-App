interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  
  const tickets = await env.DB.prepare('SELECT COUNT(*) as count FROM tickets').first<{count: number}>();
  const leads = await env.DB.prepare('SELECT COUNT(*) as count FROM leads').first<{count: number}>();
  
  const report = { 
    tickets: tickets?.count || 0, 
    leads: leads?.count || 0, 
    timestamp: Date.now() 
  };
  
  return new Response(JSON.stringify(report), {
    headers: { 'Content-Type': 'application/json' }
  });
};
