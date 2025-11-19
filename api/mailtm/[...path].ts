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
  const afterBase = url.pathname.split('/api/mailtm/')[1] || '';
  let targetUrl = `https://api.mail.tm/${afterBase}${url.search}`;
  const rid = Math.random().toString(36).slice(2, 8);
  console.log(`[mailtm][${rid}] incoming`, { method: req.method, path: url.pathname, search: url.search, targetUrl });

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
    passHeaders.set('user-agent', 'temp-mail-app/1.0');

    const init: RequestInit = {
      method: req.method,
      headers: passHeaders,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
      redirect: 'follow',
    };

    let resp = await fetch(targetUrl, init);
    console.log(`[mailtm][${rid}] response`, { status: resp.status, ok: resp.ok });
    // Retry once toggling trailing slash if 404/500 (some gateways are picky)
    if ((resp.status === 404 || resp.status === 500) && !afterBase.endsWith('/')) {
      const altUrl = `https://api.mail.tm/${afterBase}/${url.search}`.replace(/\?$/,'');
      console.log(`[mailtm][${rid}] retry`, { altUrl });
      resp = await fetch(altUrl, init);
      console.log(`[mailtm][${rid}] retry response`, { status: resp.status, ok: resp.ok });
    }
    const headers = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
    return new Response(resp.body, { status: resp.status, headers });
  } catch (err: any) {
    console.error(`[mailtm][${rid}] error`, err?.message || err);
    const headers = new Headers(corsHeaders(origin));
    headers.set('content-type', 'application/json');
    return new Response(JSON.stringify({ error: 'Bad Gateway', message: err?.message || 'Proxy request failed' }), { status: 502, headers });
  }
}
