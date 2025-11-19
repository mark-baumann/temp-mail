export const config = { runtime: 'edge' };

function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
    'Access-Control-Max-Age': '86400',
  } as Record<string, string>;
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const origin = req.headers.get('origin') || undefined;
  const afterBase = url.pathname.split('/api/dropmail/')[1] || '';
  const targetUrl = `https://dropmail.me/${afterBase}`.replace(/\/+$/,'');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const passHeaders = new Headers();
    const ct = req.headers.get('content-type');
    const auth = req.headers.get('authorization');
    if (ct) passHeaders.set('content-type', ct);
    if (auth) passHeaders.set('authorization', auth);
    passHeaders.set('accept', 'application/json, text/plain, */*');

    const init: RequestInit = {
      method: req.method,
      headers: passHeaders,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      redirect: 'follow',
    };

    const resp = await fetch(targetUrl, init);
    const headers = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
    return new Response(resp.body, { status: resp.status, headers });
  } catch (err: any) {
    const headers = new Headers(corsHeaders(origin));
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify({ error: 'Bad Gateway', message: err?.message || 'Proxy request failed' }), { status: 502, headers });
  }
}
