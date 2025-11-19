export const config = { runtime: 'edge' };
export const runtime = 'edge';

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
  const token = url.pathname.split('/api/tempmail/auth/')[1] || '';
  const targetUrl = `https://api.tempmail.lol/auth/${token}${url.search}`;
  const rid = Math.random().toString(36).slice(2, 8);
  console.log(`[tempmail-auth][${rid}] incoming`, { method: req.method, path: url.pathname, token, targetUrl });

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
    console.log(`[tempmail-auth][${rid}] response`, { status: resp.status, ok: resp.ok });

    if (req.method === 'GET' && resp.status === 404) {
      const headers = new Headers({ 'content-type': 'application/json' });
      for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
      return new Response(JSON.stringify({ email: [] }), { status: 200, headers });
    }

    const headers = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
    return new Response(resp.body, { status: resp.status, headers });
  } catch (err: any) {
    console.error(`[tempmail-auth][${rid}] error`, err?.message || err);
    const headers = new Headers(corsHeaders(origin));
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify({ error: 'Bad Gateway', message: err?.message || 'Proxy request failed' }), { status: 502, headers });
  }
}
