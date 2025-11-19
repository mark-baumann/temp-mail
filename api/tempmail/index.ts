export const config = { runtime: 'edge' };
export const runtime = 'edge';

export default async function handler(req: Request) {
  const url = new URL(req.url);
  console.log('[tempmail][index] hit', { path: url.pathname, search: url.search });
  return new Response(JSON.stringify({ ok: true, route: 'tempmail/index', path: url.pathname, search: url.search }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
