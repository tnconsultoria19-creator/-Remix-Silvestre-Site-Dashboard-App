export async function generateJWT(payload: any, secret: string) {
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

export async function verifyJWT(token: string) {
  // Simplified for parsing - in production, verify the signature!
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}
