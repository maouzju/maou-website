import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { createSources } from './lib/sources.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
// 没指定 PORT 时从 5180 起找空闲端口，避免和 vite 等常用 5173 的开发服务撞车
const FIXED_PORT = Boolean(process.env.PORT);
const PORT_LIMIT = 5199;
let port = Number(process.env.PORT) || 5180;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};
const TEXT = 'text/plain; charset=utf-8';
const LONG_CACHE = new Set(['.woff2', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico']);
const COMPRESSIBLE = /^(text\/|application\/(json|xml)|image\/svg)/;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
};

const sources = createSources(path.join(PUBLIC, 'data'));

function send(req, res, status, body, headers = {}) {
  let payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const out = { ...SECURITY_HEADERS, ...headers };
  const type = out['Content-Type'] || '';
  if (payload.length > 1024 && COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    payload = zlib.gzipSync(payload);
    out['Content-Encoding'] = 'gzip';
    out.Vary = 'Accept-Encoding';
  }
  out['Content-Length'] = payload.length;
  res.writeHead(status, out);
  res.end(req.method === 'HEAD' ? undefined : payload);
}

async function handleApi(req, res, name) {
  const source = sources[name];
  if (!source) return send(req, res, 404, '{"error":"not_found"}', { 'Content-Type': MIME['.json'] });
  try {
    const envelope = await source.get();
    send(req, res, 200, JSON.stringify(envelope), {
      'Content-Type': MIME['.json'],
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
    });
  } catch {
    send(req, res, 502, '{"error":"upstream_unavailable"}', { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  }
}

async function handleStatic(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return send(req, res, 400, 'Bad Request', { 'Content-Type': TEXT });
  }
  if (relative.includes('\0')) return send(req, res, 400, 'Bad Request', { 'Content-Type': TEXT });

  let file = path.normalize(path.join(PUBLIC, relative));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) {
    return send(req, res, 403, 'Forbidden', { 'Content-Type': TEXT });
  }
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = path.join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  const ext = path.extname(file).toLowerCase();
  if (!info?.isFile() || !MIME[ext]) return send(req, res, 404, 'Not Found', { 'Content-Type': TEXT });

  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const cacheControl = LONG_CACHE.has(ext) ? 'public, max-age=86400' : 'no-cache';
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ...SECURITY_HEADERS, ETag: etag, 'Cache-Control': cacheControl });
    return res.end();
  }
  send(req, res, 200, await readFile(file), { 'Content-Type': MIME[ext], ETag: etag, 'Cache-Control': cacheControl });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(req, res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD', 'Content-Type': TEXT });
    }
    const { pathname } = new URL(`http://localhost${req.url}`);
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname.slice(5).replace(/\/$/, ''));
    return await handleStatic(req, res, pathname);
  } catch (error) {
    console.error(error);
    send(req, res, 500, 'Internal Server Error', { 'Content-Type': TEXT });
  }
});

function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && !FIXED_PORT && port < PORT_LIMIT) {
    server.listen(++port, HOST);
    return;
  }
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，可用 PORT=xxxx 换一个` : error);
  process.exit(1);
});

server.once('listening', () => {
  const url = `http://${HOST}:${port}`;
  console.log(`maou-website  ${url}`);
  if (process.env.OPEN_BROWSER) openBrowser(url);
  for (const source of Object.values(sources)) source.get().catch(() => {});
});

server.listen(port, HOST);
