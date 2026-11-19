'use strict';
/* The dashboard's API — everything here needs the admin to be signed in. */
const os = require('node:os');
const crypto = require('node:crypto');
const { db, getSettings, setSetting, SETTING_DEFAULTS } = require('../db');
const { localStamp } = require('../time');
const { PORT } = require('../config');
const orders = require('../services/orders');
const { getStats, getAnalytics } = require('../services/stats');
const { publicSupplies } = require('./public');
const auth = require('../auth');
const sse = require('../sse');
const qr = require('../qr');

const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const int = (v, d, min = 0) => { const x = Math.floor(Number(v)); return Number.isFinite(x) ? Math.max(min, x) : d; };

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) return n.address;
  return 'localhost';
}
function baseUrl(req) {
  const s = getSettings();
  if (s.public_base_url && s.public_base_url.trim()) return s.public_base_url.trim().replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  if (/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) return `http://${lanIp()}:${PORT}`;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${host}`;
}
function randomCode() { const A = 'abcdefghjkmnpqrstuvwxyz23456789', b = crypto.randomBytes(8); let s = ''; for (let i = 0; i < 8; i++) s += A[b[i] % A.length]; return s; }
const supplies = () => db.prepare('SELECT * FROM supplies ORDER BY sort_order ASC, id DESC').all();
const centers = () => db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.center_id = c.id) AS orders_count,
  (SELECT MAX(scanned_at) FROM qr_scans s WHERE s.center_id = c.id) AS last_scan FROM centers c ORDER BY c.id`).all();
function supplyChanged() { const st = getStats(); sse.toAdmin('supplies', { supplies: supplies(), stats: st }); sse.toAllCenters('supplies', { supplies: publicSupplies() }); }

function mount(app) {
  app.post('/api/login', auth.login);
  app.post('/api/logout', auth.logout);
  app.get('/api/me', (req, res) => auth.session(req) ? res.ok({ admin: true }) : res.fail(401, 'سجّل دخول الأول'));

  const A = auth.requireAdmin;
  app.get('/api/admin/events', A, (req, res) => sse.open(req, res, 'admin'));
  app.post('/api/admin/password', A, auth.changePassword);

  app.get('/api/admin/bootstrap', A, (req, res) => res.ok({
    baseUrl: baseUrl(req), settings: getSettings(), stats: getStats(), analytics: getAnalytics(req.query.range || '7d'),
    centers: centers(), supplies: supplies(), orders: orders.list()
  }));
  app.get('/api/admin/analytics', A, (req, res) => res.ok({ analytics: getAnalytics(req.query.range || '7d') }));

  /* centers */
  app.post('/api/admin/centers', A, (req, res) => {
    const b = req.body, name = str(b.name, 120);
    if (!name) return res.fail(400, 'اكتب اسم المركز');
    let code = str(b.code, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!code) do { code = randomCode(); } while (db.prepare('SELECT 1 FROM centers WHERE code = ?').get(code));
    if (db.prepare('SELECT 1 FROM centers WHERE code = ?').get(code)) return res.fail(409, 'الكود ده مستخدم لمركز تاني');
    const r = db.prepare('INSERT INTO centers (code, name, branch, manager_name, phone, address, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
      .run(code, name, str(b.branch, 120), str(b.manager_name, 80), str(b.phone, 30), str(b.address, 200), localStamp());
    sse.toAdmin('centers', { centers: centers() });
    res.ok({ center: db.prepare('SELECT * FROM centers WHERE id = ?').get(r.lastInsertRowid) });
  });
  app.put('/api/admin/centers/:id', A, (req, res) => {
    const c = db.prepare('SELECT * FROM centers WHERE id = ?').get(Number(req.params.id)); if (!c) return res.fail(404, 'المركز ده مش موجود');
    const b = req.body, pick = (k, n) => b[k] !== undefined ? str(b[k], n) : c[k];
    const name = pick('name', 120); if (!name) return res.fail(400, 'اكتب اسم المركز');
    db.prepare('UPDATE centers SET name = ?, branch = ?, manager_name = ?, phone = ?, address = ?, is_active = ? WHERE id = ?')
      .run(name, pick('branch', 120), pick('manager_name', 80), pick('phone', 30), pick('address', 200), b.is_active !== undefined ? (b.is_active ? 1 : 0) : c.is_active, c.id);
    sse.toAdmin('centers', { centers: centers() });
    res.ok({ center: db.prepare('SELECT * FROM centers WHERE id = ?').get(c.id) });
  });
  /* a new secret code: the old QR stops working (lost or leaked sticker) */
  app.post('/api/admin/centers/:id/code', A, (req, res) => {
    const c = db.prepare('SELECT * FROM centers WHERE id = ?').get(Number(req.params.id)); if (!c) return res.fail(404, 'المركز ده مش موجود');
    let code; do { code = randomCode(); } while (db.prepare('SELECT 1 FROM centers WHERE code = ?').get(code));
    db.prepare('UPDATE centers SET code = ? WHERE id = ?').run(code, c.id);
    sse.toAdmin('centers', { centers: centers() });
    res.ok({ center: db.prepare('SELECT * FROM centers WHERE id = ?').get(c.id) });
  });
  app.delete('/api/admin/centers/:id', A, (req, res) => {
    const id = Number(req.params.id);
    const open = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE center_id = ? AND status IN ('pending','approved','preparing','dispatched')").get(id).c;
    if (open) return res.fail(409, `المركز ده عنده ${open} طلب شغال — خلّصهم أو الغيهم الأول`);
    db.prepare('DELETE FROM centers WHERE id = ?').run(id);
    sse.toAdmin('centers', { centers: centers() });
    res.ok();
  });
  app.get('/api/admin/qr/:code', A, (req, res) => {
    const code = String(req.params.code);
    const url = code === 'all' ? `${baseUrl(req)}/center` : `${baseUrl(req)}/c/${encodeURIComponent(code)}`;
    res.ok({ url, svg: qr.svg(url), pngDataUrl: qr.dataUrl(url) });
  });

  /* supplies */
  function readSupply(b, ex = {}) {
    const name = str(b.name !== undefined ? b.name : ex.name, 120);
    if (!name) return null;
    return {
      name, category: str(b.category !== undefined ? b.category : ex.category, 60) || 'مستلزمات طبية',
      description: str(b.description !== undefined ? b.description : ex.description, 300), unit: str(b.unit !== undefined ? b.unit : ex.unit, 24) || 'علبة',
      available_qty: int(b.available_qty, ex.available_qty || 0), min_stock: int(b.min_stock, ex.min_stock != null ? ex.min_stock : 5),
      max_per_order: int(b.max_per_order, ex.max_per_order != null ? ex.max_per_order : 50, 0),
      image_url: b.image_url !== undefined ? (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(String(b.image_url)) && String(b.image_url).length < 600000 ? String(b.image_url) : (/^https:\/\/\S+$/.test(String(b.image_url)) ? str(b.image_url, 500) : '')) : (ex.image_url || ''),
      is_visible: b.is_visible !== undefined ? (b.is_visible ? 1 : 0) : (ex.is_visible != null ? ex.is_visible : 1)
    };
  }
  app.post('/api/admin/supplies', A, (req, res) => {
    const s = readSupply(req.body); if (!s) return res.fail(400, 'اكتب اسم الصنف');
    let sku; do { sku = 'SUP-' + (1000 + crypto.randomInt(9000)); } while (db.prepare('SELECT 1 FROM supplies WHERE sku = ?').get(sku));
    const now = localStamp(), so = (db.prepare('SELECT MIN(sort_order) AS m FROM supplies').get().m || 0) - 1;
    const r = db.prepare(`INSERT INTO supplies (sku, name, category, description, unit, available_qty, min_stock, max_per_order, icon, image_url, badge_tone, is_visible, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, 'sage', ?, ?, ?, ?)`).run(sku, s.name, s.category, s.description, s.unit, s.available_qty, s.min_stock, s.max_per_order, s.image_url, s.is_visible, so, now, now);
    supplyChanged();
    res.ok({ supply: db.prepare('SELECT * FROM supplies WHERE id = ?').get(r.lastInsertRowid) });
  });
  app.put('/api/admin/supplies/:id', A, (req, res) => {
    const ex = db.prepare('SELECT * FROM supplies WHERE id = ?').get(Number(req.params.id)); if (!ex) return res.fail(404, 'الصنف ده مش موجود');
    const s = readSupply(req.body, ex); if (!s) return res.fail(400, 'اكتب اسم الصنف');
    db.prepare('UPDATE supplies SET name=?, category=?, description=?, unit=?, available_qty=?, min_stock=?, max_per_order=?, image_url=?, is_visible=?, updated_at=? WHERE id=?')
      .run(s.name, s.category, s.description, s.unit, s.available_qty, s.min_stock, s.max_per_order, s.image_url, s.is_visible, localStamp(), ex.id);
    supplyChanged();
    res.ok({ supply: db.prepare('SELECT * FROM supplies WHERE id = ?').get(ex.id) });
  });
  app.patch('/api/admin/supplies/:id/stock', A, (req, res) => {
    const ex = db.prepare('SELECT * FROM supplies WHERE id = ?').get(Number(req.params.id)); if (!ex) return res.fail(404, 'الصنف ده مش موجود');
    const q = req.body.set_qty !== undefined ? int(req.body.set_qty, ex.available_qty) : Math.max(0, ex.available_qty + Math.floor(Number(req.body.delta) || 0));
    db.prepare('UPDATE supplies SET available_qty = ?, updated_at = ? WHERE id = ?').run(q, localStamp(), ex.id);
    supplyChanged();
    res.ok({ supply: db.prepare('SELECT * FROM supplies WHERE id = ?').get(ex.id) });
  });
  app.post('/api/admin/supplies/sort', A, (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 1000) : [];
    const up = db.prepare('UPDATE supplies SET sort_order = ? WHERE id = ?'); ids.forEach((id, i) => up.run(i, Number(id)));
    supplyChanged(); res.ok();
  });
  app.delete('/api/admin/supplies/:id', A, (req, res) => {
    db.prepare('DELETE FROM supplies WHERE id = ?').run(Number(req.params.id));
    supplyChanged(); res.ok();
  });

  /* orders */
  app.get('/api/admin/orders', A, (req, res) => res.ok({ orders: orders.list(req.query), stats: getStats() }));
  app.patch('/api/admin/orders/:id', A, (req, res) => {
    const order = orders.setStatus(req.params.id, req.body);
    sse.toAdmin('order:updated', { order, stats: getStats() });
    sse.toCenter(order.center_id, 'order:updated', { order });
    if (req.body.status === 'rejected') supplyChanged();
    res.ok({ order });
  });
  app.delete('/api/admin/orders/:id', A, (req, res) => {
    const o = orders.remove(req.params.id);
    sse.toAdmin('order:deleted', { id: o.id, stats: getStats() });
    sse.toCenter(o.center_id, 'order:deleted', { id: o.id });
    supplyChanged();
    res.ok();
  });

  /* settings */
  app.put('/api/admin/settings', A, (req, res) => {
    for (const k of Object.keys(SETTING_DEFAULTS)) if (req.body[k] !== undefined) setSetting(k, str(req.body[k], 300));
    res.ok({ settings: getSettings(), baseUrl: baseUrl(req) });
  });
}

module.exports = { mount };
