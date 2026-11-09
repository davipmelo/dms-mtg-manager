/**
 * Cloudflare Worker Proxy for MPCFill API
 * Forwards requests to https://mpcfill.com with full CORS support for davimelo.com and other origins.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle MPCFill API routes
    if (url.pathname.startsWith('/2/') || url.pathname.startsWith('/api-mpcfill/')) {
      // Handle CORS preflight
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

    // Serve static assets if deployed with Cloudflare Workers Assets
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('DMS MTG Manager - MPCFill Proxy Active', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
