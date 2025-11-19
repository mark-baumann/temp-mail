export const config = { runtime: 'edge' };
export const runtime = 'edge';

export default async function handler(req: Request) {
  const url = new URL(req.url);
  console.log('[dropmail][index] hit', { path: url.pathname, search: url.search });
  return new Response(JSON.stringify({ ok: true, route: 'dropmail/index', path: url.pathname, search: url.search }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
