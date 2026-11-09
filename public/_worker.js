/**
 * Cloudflare Advanced Worker (_worker.js)
 * Intercepts /2/* and /api-mpcfill/* while allowing static assets to be served.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/2/') || url.pathname.startsWith('/api-mpcfill/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      const forwardPath = url.pathname.startsWith('/api-mpcfill/')
        ? url.pathname.replace('/api-mpcfill', '')
        : url.pathname;

      const targetUrl = 'https://mpcfill.com' + forwardPath + url.search;

      const body =
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.arrayBuffer()
          : undefined;

      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/json',
          'Origin': 'https://mpcfill.com',
          'Referer': 'https://mpcfill.com/editor',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body,
      });

      const newHeaders = new Headers(response.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      newHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};
