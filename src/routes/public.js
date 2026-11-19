'use strict';
/* What a center's page can reach — scoped by the center's code in its QR link. */
const { db, getSettings } = require('../db');
const { localStamp } = require('../time');
const orders = require('../services/orders');
const { getStats } = require('../services/stats');
const sse = require('../sse');
const auth = require('../auth');

const SUPPLY_COLS = 'id, sku, name, category, description, unit, available_qty, max_per_order, image_url, sort_order';
function publicSupplies() {
  const showOut = getSettings().show_out_of_stock !== 'false';
  return db.prepare(`SELECT ${SUPPLY_COLS} FROM supplies WHERE is_visible = 1 ${showOut ? '' : 'AND available_qty > 0'} ORDER BY sort_order ASC, id DESC`).all();
}
function centerByCode(code) { return db.prepare('SELECT * FROM centers WHERE code = ? AND is_active = 1').get(String(code || '').slice(0, 64)); }
const publicCenter = c => ({ code: c.code, name: c.name, branch: c.branch, manager_name: c.manager_name, phone: c.phone, address: c.address });
function brand() { const s = getSettings(); return { brand_name: s.brand_name, brand_subtitle: s.brand_subtitle }; }

const POSTS = new Map();
function limited(key) {
  const now = Date.now(), t = (POSTS.get(key) || []).filter(x => now - x < 3600e3);
  if (t.length >= 12) return true;
  t.push(now); POSTS.set(key, t);
  if (POSTS.size > 5000) for (const [k, v] of POSTS) if (!v.some(x => now - x < 3600e3)) POSTS.delete(k);
  return false;
}

function mount(app) {
  /* the general QR: centers by name only (when the admin leaves it on) */
  app.get('/api/public/directory', (req, res) => {
    const s = getSettings();
    if (s.public_directory === 'false') return res.ok({ enabled: false, centers: [], ...brand() });
    res.ok({ enabled: true, ...brand(), centers: db.prepare('SELECT code, name, branch FROM centers WHERE is_active = 1 ORDER BY name').all() });
  });

  app.get('/api/public/center/:code', (req, res) => {
    const c = centerByCode(req.params.code);
    if (!c) return res.fail(404, 'اللينك ده مش شغال — كلّم المورد يبعتلك لينك جديد');
    if (req.query.silent !== '1') {
      db.prepare('UPDATE centers SET scan_count = scan_count + 1 WHERE id = ?').run(c.id);
      db.prepare('INSERT INTO qr_scans (center_id, scanned_at, user_agent) VALUES (?, ?, ?)').run(c.id, localStamp(), String(req.headers['user-agent'] || '').slice(0, 160));
      sse.toAdmin('scan', { center_id: c.id, center_name: c.name, scan_count: c.scan_count + 1 });
    }
    res.ok({ center: publicCenter(c), supplies: publicSupplies(), orders: orders.list({ center_id: c.id, limit: 30 }), settings: brand() });
  });

  app.post('/api/public/center/:code/orders', (req, res) => {
    const c = centerByCode(req.params.code);
    if (!c) return res.fail(404, 'اللينك ده مش شغال');
    if (limited(c.id + ':' + auth.ipOf(req))) return res.fail(429, 'بعتّوا طلبات كتير في وقت قصير — كلّمونا لو مستعجلين');
    const order = orders.create(c, req.body);
    const supplies = publicSupplies();
    sse.toAdmin('order:created', { order, stats: getStats() });
    sse.toCenter(c.id, 'order:updated', { order });
    sse.toAllCenters('supplies', { supplies });
    res.ok({ order, supplies });
  });

  app.get('/api/public/center/:code/events', (req, res) => {
    const c = centerByCode(req.params.code);
    if (!c) return res.fail(404, 'اللينك ده مش شغال');
    sse.open(req, res, 'center:' + c.id);
  });
}

module.exports = { mount, publicSupplies };
