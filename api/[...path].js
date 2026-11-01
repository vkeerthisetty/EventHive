module.exports = async function handler(req, res) {
  const base = (process.env.API_BACKEND_URL || '').replace(/\/$/, '');
  if (!base) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'API_NOT_CONFIGURED', message: 'API_BACKEND_URL is not configured on Vercel' } }));
    return;
  }
  try {
    const target = `${base}${req.url}`;
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];
    const init = { method: req.method, headers, redirect: 'manual' };
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      if (req.body !== undefined) {
        init.body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
      }
    }
    const upstream = await fetch(target, init);
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'set-cookie') res.setHeader(key, value);
    });
    if (typeof upstream.headers.getSetCookie === 'function') {
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) res.setHeader('set-cookie', cookies);
    } else {
      const cookie = upstream.headers.get('set-cookie');
      if (cookie) res.setHeader('set-cookie', cookie);
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    res.end(body);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'API_PROXY_FAILED', message: 'Unable to reach EventHive API' } }));
  }
};
