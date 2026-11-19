'use strict';
/* Admin sign-in: one password (scrypt), a long-lived HttpOnly cookie, and a
   throttle on wrong tries. First run: ADMIN_PASSWORD from the environment, or a
   random one written to data/ADMIN_PASSWORD.txt and printed in the log. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { db, getSecret, setSecret } = require('./db');
const { ADMIN_PASSWORD, DATA_DIR } = require('./config');

const COOKIE = 'qr_admin';
const MAX_AGE = 90 * 86400;   // stays signed in for 90 days, renewed on every visit

function hash(pw) { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex'); }
function verify(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, h] = stored.split(':'); const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(String(pw), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const sha = t => crypto.createHash('sha256').update(t).digest('hex');

function initPassword() {
  if (ADMIN_PASSWORD) { if (!verify(ADMIN_PASSWORD, getSecret('admin_pw'))) setSecret('admin_pw', hash(ADMIN_PASSWORD)); return null; }
  if (getSecret('admin_pw')) return null;
  const pw = crypto.randomBytes(9).toString('base64url');
  setSecret('admin_pw', hash(pw));
  try { fs.writeFileSync(path.join(DATA_DIR, 'ADMIN_PASSWORD.txt'), 'كلمة سر لوحة التحكم: ' + pw + '\nغيّرها من الإعدادات وامسح الملف ده.\n'); } catch (_) {}
  return pw;
}

function cookieOf(req) { const m = /(?:^|;\s*)qr_admin=([a-f0-9]{64})/.exec(req.headers.cookie || ''); return m ? m[1] : null; }
const isHttps = req => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || !!(req.socket && req.socket.encrypted);
function cookieHeader(req, token) {
  return COOKIE + '=' + (token || '') + '; Path=/; HttpOnly; SameSite=Lax' + (isHttps(req) ? '; Secure' : '') + '; Max-Age=' + (token ? MAX_AGE : 0);
}

function session(req) {
  const t = cookieOf(req); if (!t) return null;
  const row = db.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(sha(t));
  if (!row || Date.now() - row.last_at > MAX_AGE * 1000) return null;
  if (Date.now() - row.last_at > 3600e3) db.prepare('UPDATE admin_sessions SET last_at = ? WHERE token_hash = ?').run(Date.now(), row.token_hash);
  return { token: t };
}

const FAILS = new Map();
const ipOf = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
function throttled(req) { const f = (FAILS.get(ipOf(req)) || []).filter(t => Date.now() - t < 15 * 60e3); FAILS.set(ipOf(req), f); return f.length >= 8; }

function login(req, res) {
  if (throttled(req)) return res.fail(429, 'محاولات كتير غلط — استنى ربع ساعة وجرّب تاني');
  if (!verify(String(req.body.password || '').slice(0, 200), getSecret('admin_pw'))) {
    FAILS.get(ipOf(req)).push(Date.now());
    return res.fail(401, 'كلمة السر غلط');
  }
  FAILS.delete(ipOf(req));
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO admin_sessions (token_hash, created_at, last_at, ua) VALUES (?, ?, ?, ?)').run(sha(token), Date.now(), Date.now(), String(req.headers['user-agent'] || '').slice(0, 160));
  db.prepare('DELETE FROM admin_sessions WHERE last_at < ?').run(Date.now() - MAX_AGE * 1000);
  res.json(200, { ok: true }, { 'Set-Cookie': cookieHeader(req, token) });
}
function logout(req, res) {
  const t = cookieOf(req); if (t) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha(t));
  res.json(200, { ok: true }, { 'Set-Cookie': cookieHeader(req, null) });
}
function changePassword(req, res) {
  const { current, next } = req.body;
  if (!verify(String(current || ''), getSecret('admin_pw'))) return res.fail(400, 'كلمة السر الحالية غلط');
  if (String(next || '').length < 8) return res.fail(400, 'كلمة السر الجديدة 8 حروف على الأقل');
  setSecret('admin_pw', hash(next));
  const keep = cookieOf(req);
  db.prepare('DELETE FROM admin_sessions WHERE token_hash != ?').run(keep ? sha(keep) : '');
  try { fs.unlinkSync(path.join(DATA_DIR, 'ADMIN_PASSWORD.txt')); } catch (_) {}
  res.ok();
}

/* guard for every /api/admin route: signed in, and writes must be JSON (stops cross-site form posts) */
function requireAdmin(req, res, next) {
  if (!session(req)) return res.fail(401, 'سجّل دخول الأول');
  if (req.method !== 'GET' && !/application\/json/.test(req.headers['content-type'] || '') && req.method !== 'DELETE') return res.fail(415, 'نوع الطلب مش مدعوم');
  next();
}

module.exports = { initPassword, session, login, logout, changePassword, requireAdmin, ipOf };
