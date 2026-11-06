import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultStore } from './src/store.js';
import { createApiHandler } from './src/router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.csv': 'text/csv; charset=utf-8'
};

export function createAppServer(store = defaultStore) {
  const apiHandler = createApiHandler(store);

  return http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/api/')) {
      return apiHandler(req, res);
    }

    let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    if (safePath === '/' || safePath === '' || safePath === '/app') {
      safePath = '/index.html';
    }

    let filePath = path.join(PUBLIC_DIR, safePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    try {
      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(fs.readFileSync(filePath));
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Internal Server Error');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createAppServer();
  server.listen(PORT, HOST, () => {
    console.log(`Aesthetic Revenue OS listening on http://${HOST}:${PORT}`);
  });
}
