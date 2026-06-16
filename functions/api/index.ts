export const onRequestGet: PagesFunction = async () => {
  return new Response(JSON.stringify({
    status: 'ok',
    service: 'CRM API is running on Pages Functions',
    version: '1.0',
    endpoints: '/api/*'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
