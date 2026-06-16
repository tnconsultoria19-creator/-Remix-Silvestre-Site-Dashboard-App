interface Env {
  FILES: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file' }), { status: 400 });
    }

    const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const arrayBuffer = await file.arrayBuffer();

    await env.FILES.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'application/pdf' }
    });
    
    // Construct the retrieval URL
    const url = new URL(request.url);
    const retrievalUrl = `${url.origin}/cdn/${key}`;
    
    return new Response(JSON.stringify({ success: true, url: retrievalUrl, key }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
