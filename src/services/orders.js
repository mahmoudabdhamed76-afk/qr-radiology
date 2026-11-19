'use strict';
/* Supply orders ("missions"): create from a center's page (stock is reserved
   right away), move through the stages, cancel (stock goes back). */
const crypto = require('node:crypto');
const { db, tx } = require('../db');
const { localStamp } = require('../time');
const { HttpError } = require('../http');

const STAGES = {
  pending: { label: 'اتبعت — مستني الاعتماد', progress: 15 },
  approved: { label: 'اتعتمد واتحجزت الكميات', progress: 36 },
  preparing: { label: 'بيتجهز في المخزن', progress: 62 },
  dispatched: { label: 'خرج مع المندوب', progress: 84 },
  delivered: { label: 'اتسلّم', progress: 100 },
  rejected: { label: 'اتلغى ورجعت الكميات للمخزن', progress: 0 }
};
const FLOW = ['pending', 'approved', 'preparing', 'dispatched', 'delivered'];
const PRIORITY = ['normal', 'urgent', 'emergency'];
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

function hydrate(o) {
  if (!o) return null;
  let log = []; try { log = JSON.parse(o.stage_log || '[]'); } catch (_) {}
  const items = db.prepare('SELECT id, supply_id, supply_name, unit, category, quantity FROM order_items WHERE order_id = ? ORDER BY id').all(o.id);
  return { ...o, items, stage_log: log };
}
function byId(id) { return hydrate(db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id))); }
function list({ status, center_id, limit = 150 } = {}) {
  const w = [], p = [];
  if (status && status !== 'all') { w.push('status = ?'); p.push(String(status)); }
  if (center_id && center_id !== 'all') { w.push('center_id = ?'); p.push(Number(center_id)); }
  return db.prepare(`SELECT * FROM orders ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`).all(...p, Math.min(500, limit)).map(hydrate);
}

function create(center, body) {
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
  const want = new Map();
  for (const it of rawItems) {
    const id = Number(it && it.supply_id), q = Math.floor(Number(it && it.quantity));
    if (!id || !(q > 0)) continue;
    want.set(id, (want.get(id) || 0) + q);
  }
  if (!want.size) throw new HttpError(400, 'اختار صنف واحد على الأقل');
  const now = localStamp(), manager = str(body.manager_name, 80) || center.manager_name || '', phone = str(body.phone, 30).replace(/[^\d+]/g, '') || center.phone || '';
  const priority = PRIORITY.includes(body.priority) ? body.priority : 'normal';

  const id = tx(() => {
    const lines = [];
    for (const [sid, q] of want) {
      const s = db.prepare('SELECT * FROM supplies WHERE id = ? AND is_visible = 1').get(sid);
      if (!s) throw new HttpError(409, 'فيه صنف مبقاش متاح — حدّث الصفحة');
      if (q > s.available_qty) throw new HttpError(409, `المتاح من «${s.name}» ${s.available_qty} ${s.unit} بس`);
      if (s.max_per_order > 0 && q > s.max_per_order) throw new HttpError(409, `أقصى كمية من «${s.name}» في الطلب الواحد ${s.max_per_order} ${s.unit}`);
      lines.push({ s, q });
    }
    const log = [{ status: 'pending', label: STAGES.pending.label, time: now, note: 'اتبعت من صفحة المركز' + (manager ? ' بواسطة ' + manager : '') }];
    const units = lines.reduce((a, x) => a + x.q, 0);
    const r = db.prepare(`INSERT INTO orders (order_code, center_id, center_name, center_branch, manager_name, phone, priority, status, progress, notes, stage_log, total_items, total_units, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 15, ?, ?, ?, ?, ?, ?)`).run('TMP-' + crypto.randomBytes(6).toString('hex'), center.id, center.name, center.branch || '', manager, phone, priority, str(body.notes, 500), JSON.stringify(log), lines.length, units, now, now);
    const oid = Number(r.lastInsertRowid);
    db.prepare('UPDATE orders SET order_code = ? WHERE id = ?').run('EM-' + (2600 + oid), oid);
    const ins = db.prepare('INSERT INTO order_items (order_id, supply_id, supply_name, unit, category, quantity, icon) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const take = db.prepare('UPDATE supplies SET available_qty = available_qty - ?, updated_at = ? WHERE id = ?');
    for (const { s, q } of lines) { ins.run(oid, s.id, s.name, s.unit, s.category, q, ''); take.run(q, now, s.id); }
    return oid;
  });
  return byId(id);
}

function setStatus(id, body) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id));
  if (!o) throw new HttpError(404, 'الطلب ده مش موجود');
  const status = body.status || o.status;
  if (!STAGES[status]) throw new HttpError(400, 'حالة مش معروفة');
  if (o.status === 'rejected' && status !== 'rejected') throw new HttpError(409, 'الطلب ده اتلغى والكميات رجعت — اعمل طلب جديد');
  const now = localStamp();
  let log = []; try { log = JSON.parse(o.stage_log || '[]'); } catch (_) {}
  const driver = body.driver_name !== undefined ? str(body.driver_name, 60) : o.driver_name;
  const driverPhone = body.driver_phone !== undefined ? str(body.driver_phone, 30) : o.driver_phone;
  const eta = body.eta_minutes !== undefined ? Math.max(0, Math.min(1440, Math.floor(Number(body.eta_minutes) || 0))) : o.eta_minutes;
  const note = body.admin_note !== undefined ? str(body.admin_note, 400) : o.admin_note;
  if (status !== o.status) {
    let msg = str(body.log_note, 200);
    if (!msg) msg = status === 'dispatched' ? `مع ${driver || 'المندوب'}${eta ? ' — الوصول خلال ' + eta + ' دقيقة تقريبًا' : ''}` : '';
    log.push({ status, label: STAGES[status].label, time: now, note: msg });
  }
  tx(() => {
    if (status === 'rejected' && o.status !== 'rejected') {
      const back = db.prepare('UPDATE supplies SET available_qty = available_qty + ?, updated_at = ? WHERE id = ?');
      for (const it of db.prepare('SELECT supply_id, quantity FROM order_items WHERE order_id = ?').all(o.id)) if (it.supply_id) back.run(it.quantity, now, it.supply_id);
    }
    db.prepare('UPDATE orders SET status = ?, progress = ?, admin_note = ?, driver_name = ?, driver_phone = ?, eta_minutes = ?, stage_log = ?, updated_at = ? WHERE id = ?')
      .run(status, STAGES[status].progress, note, driver, driverPhone, eta, JSON.stringify(log.slice(-40)), now, o.id);
  });
  return byId(o.id);
}

function remove(id) {
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(id));
  if (!o) throw new HttpError(404, 'الطلب ده مش موجود');
  tx(() => {
    if (!['rejected', 'delivered'].includes(o.status)) {   // an open order still holds stock — give it back
      const back = db.prepare('UPDATE supplies SET available_qty = available_qty + ? WHERE id = ?');
      for (const it of db.prepare('SELECT supply_id, quantity FROM order_items WHERE order_id = ?').all(o.id)) if (it.supply_id) back.run(it.quantity, it.supply_id);
    }
    db.prepare('DELETE FROM orders WHERE id = ?').run(o.id);
  });
  return o;
}

module.exports = { STAGES, FLOW, PRIORITY, hydrate, byId, list, create, setStatus, remove };
