interface Env {
  FILES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.FILES.get(key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/pdf');
  }

  return new Response(object.body, { headers });
};
