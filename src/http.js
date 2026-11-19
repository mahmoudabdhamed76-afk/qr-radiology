'use strict';
/* A small router on node:http — routes with :params, JSON bodies, static files
   (gzip + ETag, long cache for /vendor and /fonts). No packages. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json'
};
const GZIP = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function createApp({ publicDir }) {
  const routes = [];
  const add = (method, pattern, ...handlers) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push({ method, re, keys, handlers });
  };
  const app = {
    get: (p, ...h) => add('GET', p, ...h), post: (p, ...h) => add('POST', p, ...h), put: (p, ...h) => add('PUT', p, ...h),
    patch: (p, ...h) => add('PATCH', p, ...h), delete: (p, ...h) => add('DELETE', p, ...h),
    pages: {}, handle
  };

  async function readJson(req, limit) {
    if (req.method === 'GET' || req.method === 'HEAD') return {};
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > limit) throw new HttpError(413, 'البيانات كبيرة جدًا'); chunks.push(c); }
    if (!size) return {};
    try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); return v && typeof v === 'object' ? v : {}; }
    catch (e) { throw new HttpError(400, 'البيانات مش مفهومة'); }
  }

  function decorate(req, res) {
    res.json = (status, obj, headers) => {
      if (res.headersSent) return;
      const body = JSON.stringify(obj);
      res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, SEC, headers || {}));
      res.end(body);
    };
    res.ok = (obj) => res.json(200, Object.assign({ ok: true }, obj || {}));
    res.fail = (status, error) => res.json(status, { ok: false, error });
    res.file = (file, extra) => sendFile(req, res, file, extra);
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://local');
    req.path = decodeURIComponent(url.pathname);
    req.query = Object.fromEntries(url.searchParams);
    decorate(req, res);
    try {
      for (const r of routes) {
        if (r.method !== req.method && !(req.method === 'HEAD' && r.method === 'GET')) continue;
        const m = r.re.exec(req.path); if (!m) continue;
        req.params = {}; r.keys.forEach((k, i) => { req.params[k] = m[i + 1]; });
        req.body = await readJson(req, req.path.startsWith('/api/admin/supplies') || req.path.startsWith('/api/supplies') ? 3 * 1024 * 1024 : 256 * 1024);
        for (const h of r.handlers) { let next = false; await h(req, res, () => { next = true; }); if (!next) break; }
        return;
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (req.path.startsWith('/api/')) return res.fail(404, 'مش موجود');
        const rel = path.normalize(req.path).replace(/^([/\\])+/, '');
        if (rel.split(/[\\/]/).some(s => s.startsWith('.'))) return res.fail(404, 'مش موجود');
        const file = path.join(publicDir, rel);
        if (file.startsWith(publicDir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(req, res, file);
      }
      res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SEC)); res.end('مش موجود');
    } catch (e) {
      if (e instanceof HttpError) return res.fail(e.status, e.message);
      console.error('[http]', req.method, req.path, e);
      res.fail(500, 'حصل خطأ في السيرفر — جرّب تاني');
    }
  }
  return app;
}

const GZ = new Map();
function sendFile(req, res, file, extra) {
  const st = fs.statSync(file), ext = path.extname(file).toLowerCase();
  const etag = 'W/"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"';
  const longCache = /^\/(vendor|fonts)\//.test(req.path) || /[?&]v=/.test(req.url);
  const headers = Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag,
    'Cache-Control': ext === '.html' ? 'no-cache' : longCache ? 'public, max-age=31536000, immutable' : 'no-cache' }, SEC, extra || {});
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
  let body = fs.readFileSync(file);
  if (GZIP.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 1024) {
    const k = file + etag; let z = GZ.get(k); if (!z) { z = zlib.gzipSync(body); GZ.set(k, z); }
    body = z; headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding';
  }
  res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
}

module.exports = { createApp, HttpError };
