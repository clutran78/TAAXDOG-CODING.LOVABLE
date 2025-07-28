// Apply server-side polyfills before anything else
require('./lib/polyfills/server-polyfills.js');

const { createServer } = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Use WHATWG URL API with proper fallback
      const baseUrl = `http://${req.headers.host || `${hostname}:${port}`}`;
      const parsedUrl = new URL(req.url, baseUrl);

      // Convert to the format Next.js expects
      const query = Object.fromEntries(parsedUrl.searchParams);
      const urlObject = {
        pathname: parsedUrl.pathname,
        query: query,
      };

      await handle(req, res, urlObject);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
