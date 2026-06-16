import { verifyJWT } from '../_shared/jwt';

export const onRequest: PagesFunction<any> = async (context) => {
  const { request, next, data } = context;
  const url = new URL(request.url);

  // Skip auth for login and register
  if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/register' || url.pathname === '/api') {
    return await next();
  }

  // Authorization check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = await verifyJWT(token);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Store user in context data
  data.user = payload;
  return await next();
};
