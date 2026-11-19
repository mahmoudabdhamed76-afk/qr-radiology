const express = require('express');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const { db } = require('./src/db');

const app = express();
const PORT = Number(process.env.PORT || 3450);

app.use(express.json({ limit: '5mb' }));
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules', 'gsap', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Real-Time SSE Clients Hub ───────────────────────────────
const sseClients = new Set();

function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(data);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client = {
    res,
    role: req.query.role || 'admin',
    centerCode: req.query.center || null
  };
  sseClients.add(client);
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, time: new Date().toISOString() })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (_) {
      clearInterval(keepAlive);
      sseClients.delete(client);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(client);
  });
});

// ─── Helpers ─────────────────────────────────────────────────
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function getSettingsMap() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

function getPublicBaseUrl(req) {
  const settings = getSettingsMap();
  if (settings.public_base_url && settings.public_base_url.trim()) {
    return settings.public_base_url.trim().replace(/\/+$/, '');
  }
  const host = req.get('host') || process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`;
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (isLocal) {
    const lanIp = getLanIp();
    return `http://${lanIp}:${PORT}`;
  }
  const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const proto = host.endsWith('.railway.app') ? 'https' : rawProto;
  return `${proto}://${host}`;
}

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function hydrateOrder(order) {
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id);
  let stageLog = [];
  try {
    stageLog = JSON.parse(order.stage_log || '[]');
  } catch (_) {
    stageLog = [];
  }
  return { ...order, items, stage_log: stageLog };
}

function getAllOrdersHydrated(filters = {}) {
  const clauses = [];
  const params = [];
  if (filters.status && filters.status !== 'all') {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.center_id && filters.center_id !== 'all') {
    clauses.push('center_id = ?');
    params.push(Number(filters.center_id));
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM orders ${where} ORDER BY datetime(created_at) DESC, id DESC LIMIT 120`).all(...params);
  return rows.map(hydrateOrder);
}

const STAGE_META = {
  pending: { label: 'تم استلام طلب التوريد', progress: 15 },
  approved: { label: 'تم اعتماد الطلب وحجز الكميات', progress: 36 },
  preparing: { label: 'جاري تجهيز وتعبئة المهمة', progress: 62 },
  dispatched: { label: 'المندوب في الطريق للمركز', progress: 84 },
  delivered: { label: 'تم التسليم بنجاح', progress: 100 },
  rejected: { label: 'تم إلغاء / رفض الطلب', progress: 0 }
};

function getAnalytics(range = '7d') {
  const scansTotal = db.prepare('SELECT COUNT(*) AS c FROM qr_scans').get().c;
  const scansToday = db.prepare("SELECT COUNT(*) AS c FROM qr_scans WHERE date(scanned_at) = date('now', 'localtime')").get().c;
  const scansYesterday = db.prepare("SELECT COUNT(*) AS c FROM qr_scans WHERE date(scanned_at) = date('now', 'localtime', '-1 day')").get().c;
  const scans7d = db.prepare("SELECT COUNT(*) AS c FROM qr_scans WHERE datetime(scanned_at) >= datetime('now', 'localtime', '-7 days')").get().c;
  const scans30d = db.prepare("SELECT COUNT(*) AS c FROM qr_scans WHERE datetime(scanned_at) >= datetime('now', 'localtime', '-30 days')").get().c;

  let series = [];
  if (range === 'today') {
    const hours = [8, 10, 12, 14, 16, 18, 20, 22];
    const scanRows = db.prepare(`
      SELECT CAST(strftime('%H', scanned_at) AS INTEGER) AS hr, COUNT(*) AS c
      FROM qr_scans WHERE date(scanned_at) = date('now', 'localtime')
      GROUP BY hr
    `).all();
    const orderRows = db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hr, COUNT(*) AS c
      FROM orders WHERE date(created_at) = date('now', 'localtime')
      GROUP BY hr
    `).all();
    series = hours.map((h) => {
      const s = scanRows.filter((r) => r.hr >= h - 1 && r.hr <= h).reduce((a, b) => a + b.c, 0);
      const o = orderRows.filter((r) => r.hr >= h - 1 && r.hr <= h).reduce((a, b) => a + b.c, 0);
      const label = h === 12 ? '12م' : h > 12 ? `${h - 12}م` : `${h}ص`;
      return { label, scans: s, orders: o };
    });
  } else {
    const days = range === '30d' ? 14 : 7;
    const dayNames = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const pad = (n) => String(n).padStart(2, '0');
      const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const s = db.prepare('SELECT COUNT(*) AS c FROM qr_scans WHERE date(scanned_at) = ?').get(isoDate).c;
      const o = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE date(created_at) = ?').get(isoDate).c;
      const label = range === '30d' ? `${d.getDate()}/${d.getMonth() + 1}` : dayNames[d.getDay()];
      series.push({ label, date: isoDate, scans: s, orders: o });
    }
  }

  return {
    scansTotal,
    scansToday,
    scansYesterday,
    scans7d,
    scans30d,
    series
  };
}

function getStats() {
  const ordersToday = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE date(created_at) = date('now', 'localtime')").get().c;
  const pendingCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'pending'").get().c;
  const approvedCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'approved'").get().c;
  const preparingCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'preparing'").get().c;
  const dispatchedCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'dispatched'").get().c;
  const deliveredCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'delivered'").get().c;
  const activeMissions = pendingCount + approvedCount + preparingCount + dispatchedCount;
  const totalSupplies = db.prepare('SELECT COUNT(*) AS c FROM supplies WHERE is_visible = 1').get().c;
  const lowStockCount = db.prepare('SELECT COUNT(*) AS c FROM supplies WHERE available_qty > 0 AND available_qty <= min_stock').get().c;
  const outOfStockCount = db.prepare('SELECT COUNT(*) AS c FROM supplies WHERE available_qty <= 0').get().c;
  const totalUnitsStock = db.prepare('SELECT COALESCE(SUM(available_qty), 0) AS s FROM supplies').get().s;
  const totalUnitsOrderedToday = db.prepare("SELECT COALESCE(SUM(total_units), 0) AS s FROM orders WHERE date(created_at) = date('now', 'localtime') AND status != 'rejected'").get().s;
  const activeCenters = db.prepare('SELECT COUNT(*) AS c FROM centers WHERE is_active = 1').get().c;

  return {
    ordersToday,
    pendingCount,
    approvedCount,
    preparingCount,
    dispatchedCount,
    deliveredCount,
    activeMissions,
    totalSupplies,
    lowStockCount,
    outOfStockCount,
    totalUnitsStock,
    totalUnitsOrderedToday,
    activeCenters
  };
}

// ─── Bootstrap & Analytics ───────────────────────────────────
app.get('/api/bootstrap', (req, res) => {
  const centers = db.prepare('SELECT * FROM centers ORDER BY id ASC').all();
  const supplies = db.prepare('SELECT * FROM supplies ORDER BY sort_order ASC, id DESC').all();
  const orders = getAllOrdersHydrated();
  const stats = getStats();
  const analytics = getAnalytics(req.query.range || '7d');
  const settings = getSettingsMap();
  const baseUrl = getPublicBaseUrl(req);

  res.json({
    ok: true,
    baseUrl,
    lanIp: getLanIp(),
    port: PORT,
    settings,
    stats,
    analytics,
    centers,
    supplies,
    orders
  });
});

app.get('/api/analytics', (req, res) => {
  res.json({ ok: true, analytics: getAnalytics(req.query.range || '7d') });
});

// ─── Centers CRUD & QR Codes ─────────────────────────────────
app.get('/api/centers', (req, res) => {
  const centers = db.prepare('SELECT * FROM centers ORDER BY id ASC').all();
  res.json({ ok: true, centers, baseUrl: getPublicBaseUrl(req) });
});

app.post('/api/centers', (req, res) => {
  const { name, branch = '', manager_name = '', phone = '', address = '', code = '' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'اسم المركز مطلوب' });
  }
  const cleanCode = (code || `ctr-${Date.now().toString(36).slice(-5)}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-');

  try {
    const info = db.prepare(`
      INSERT INTO centers (code, name, branch, manager_name, phone, address, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(cleanCode, name.trim(), branch.trim(), manager_name.trim(), phone.trim(), address.trim());

    const center = db.prepare('SELECT * FROM centers WHERE id = ?').get(info.lastInsertRowid);
    broadcast('center:changed', { action: 'created', center });
    res.json({ ok: true, center });
  } catch (err) {
    res.status(400).json({ ok: false, error: 'كود المركز مستخدم بالفعل، اختر كود آخر' });
  }
});

app.put('/api/centers/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM centers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'المركز غير موجود' });

  const {
    name = existing.name,
    branch = existing.branch,
    manager_name = existing.manager_name,
    phone = existing.phone,
    address = existing.address,
    is_active = existing.is_active
  } = req.body || {};

  db.prepare(`
    UPDATE centers SET name = ?, branch = ?, manager_name = ?, phone = ?, address = ?, is_active = ?
    WHERE id = ?
  `).run(name.trim(), branch.trim(), manager_name.trim(), phone.trim(), address.trim(), is_active ? 1 : 0, id);

  const center = db.prepare('SELECT * FROM centers WHERE id = ?').get(id);
  broadcast('center:changed', { action: 'updated', center });
  res.json({ ok: true, center });
});

app.delete('/api/centers/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM centers WHERE id = ?').run(id);
  broadcast('center:changed', { action: 'deleted', id });
  res.json({ ok: true });
});

app.get('/api/centers/:code/qr', async (req, res) => {
  const code = req.params.code;
  const baseUrl = getPublicBaseUrl(req);
  const targetUrl = code === 'all' ? `${baseUrl}/center` : `${baseUrl}/c/${encodeURIComponent(code)}`;

  try {
    const svg = await QRCode.toString(targetUrl, {
      type: 'svg',
      margin: 2,
      width: 280,
      color: { dark: '#1E1A16', light: '#FBF8F3' }
    });
    const pngDataUrl = await QRCode.toDataURL(targetUrl, {
      margin: 2,
      width: 520,
      color: { dark: '#1E1A16', light: '#FFFFFF' }
    });
    res.json({ ok: true, url: targetUrl, svg, pngDataUrl });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'تعذر توليد كود QR' });
  }
});

// ─── Supplies Catalog CRUD ───────────────────────────────────
app.get('/api/supplies', (req, res) => {
  const supplies = db.prepare('SELECT * FROM supplies ORDER BY sort_order ASC, id DESC').all();
  res.json({ ok: true, supplies });
});

app.post('/api/supplies', (req, res) => {
  const {
    name,
    category = 'مستلزمات طبية',
    description = '',
    unit = 'علبة',
    available_qty = 10,
    min_stock = 5,
    max_per_order = 20,
    icon = '📦',
    image_url = '',
    badge_tone = 'sage',
    is_visible = 1
  } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'اسم الصنف مطلوب' });
  }

  const sku = `SUP-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = nowLocal();

  const info = db.prepare(`
    INSERT INTO supplies (
      sku, name, category, description, unit, available_qty, min_stock, max_per_order,
      icon, image_url, badge_tone, is_visible, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sku, name.trim(), category.trim(), description.trim(), unit.trim(),
    Math.max(0, Number(available_qty) || 0),
    Math.max(0, Number(min_stock) || 0),
    Math.max(1, Number(max_per_order) || 10),
    icon || '📦',
    image_url || '',
    badge_tone || 'sage',
    is_visible ? 1 : 0,
    now, now
  );

  const supply = db.prepare('SELECT * FROM supplies WHERE id = ?').get(info.lastInsertRowid);
  broadcast('supply:changed', { action: 'created', supply, stats: getStats() });
  res.json({ ok: true, supply });
});

app.put('/api/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM supplies WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'الصنف غير موجود' });

  const b = req.body || {};
  const now = nowLocal();
  db.prepare(`
    UPDATE supplies SET
      name = ?, category = ?, description = ?, unit = ?,
      available_qty = ?, min_stock = ?, max_per_order = ?,
      icon = ?, image_url = ?, badge_tone = ?, is_visible = ?, updated_at = ?
    WHERE id = ?
  `).run(
    (b.name ?? existing.name).trim(),
    (b.category ?? existing.category).trim(),
    (b.description ?? existing.description).trim(),
    (b.unit ?? existing.unit).trim(),
    Math.max(0, Number(b.available_qty ?? existing.available_qty)),
    Math.max(0, Number(b.min_stock ?? existing.min_stock)),
    Math.max(1, Number(b.max_per_order ?? existing.max_per_order)),
    b.icon ?? existing.icon,
    b.image_url ?? existing.image_url,
    b.badge_tone ?? existing.badge_tone,
    b.is_visible !== undefined ? (b.is_visible ? 1 : 0) : existing.is_visible,
    now,
    id
  );

  const supply = db.prepare('SELECT * FROM supplies WHERE id = ?').get(id);
  broadcast('supply:changed', { action: 'updated', supply, stats: getStats() });
  res.json({ ok: true, supply });
});

app.patch('/api/supplies/:id/stock', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM supplies WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'الصنف غير موجود' });

  const { delta, set_qty } = req.body || {};
  const newQty = set_qty !== undefined
    ? Math.max(0, Number(set_qty))
    : Math.max(0, existing.available_qty + Number(delta || 0));

  db.prepare('UPDATE supplies SET available_qty = ?, updated_at = ? WHERE id = ?').run(newQty, nowLocal(), id);
  const supply = db.prepare('SELECT * FROM supplies WHERE id = ?').get(id);
  broadcast('supply:changed', { action: 'stock', supply, stats: getStats() });
  res.json({ ok: true, supply });
});

app.delete('/api/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM supplies WHERE id = ?').run(id);
  broadcast('supply:changed', { action: 'deleted', id, stats: getStats() });
  res.json({ ok: true });
});

// ─── Public Center Portal API ────────────────────────────────
app.get('/api/public/centers', (req, res) => {
  const centers = db.prepare('SELECT id, code, name, branch, manager_name, phone, address FROM centers WHERE is_active = 1 ORDER BY id ASC').all();
  res.json({ ok: true, centers });
});

app.get('/api/public/center/:code', (req, res) => {
  const code = req.params.code;
  const center = db.prepare('SELECT * FROM centers WHERE code = ? AND is_active = 1').get(code);
  if (!center) {
    return res.status(404).json({ ok: false, error: 'المركز غير موجود أو غير مفعل' });
  }

  // Record QR scan unless explicitly flagged as silent refresh
  if (req.query.silent !== '1') {
    db.prepare('UPDATE centers SET scan_count = scan_count + 1 WHERE id = ?').run(center.id);
    db.prepare('INSERT INTO qr_scans (center_id, scanned_at, user_agent) VALUES (?, ?, ?)').run(
      center.id,
      nowLocal(),
      String(req.headers['user-agent'] || '').slice(0, 160)
    );
    center.scan_count += 1;
    broadcast('scan:recorded', {
      center_id: center.id,
      center_name: center.name,
      scan_count: center.scan_count,
      analytics: getAnalytics('7d')
    });
  }

  const settings = getSettingsMap();
  const showOut = settings.show_out_of_stock !== 'false';
  const supplies = showOut
    ? db.prepare('SELECT * FROM supplies WHERE is_visible = 1 ORDER BY sort_order ASC, id DESC').all()
    : db.prepare('SELECT * FROM supplies WHERE is_visible = 1 AND available_qty > 0 ORDER BY sort_order ASC, id DESC').all();

  const orders = db
    .prepare('SELECT * FROM orders WHERE center_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 25')
    .all(center.id)
    .map(hydrateOrder);

  res.json({
    ok: true,
    center,
    supplies,
    orders,
    settings: {
      brand_name: settings.brand_name || 'إمداد QR',
      brand_subtitle: settings.brand_subtitle || 'بوابة طلب التوريدات الذكية'
    }
  });
});

// ─── Orders / Supply Missions API ────────────────────────────
app.get('/api/orders', (req, res) => {
  const orders = getAllOrdersHydrated({
    status: req.query.status,
    center_id: req.query.center_id
  });
  res.json({ ok: true, orders, stats: getStats() });
});

app.post('/api/orders', (req, res) => {
  const { center_code, center_id, manager_name = '', phone = '', priority = 'normal', notes = '', items = [] } = req.body || {};

  const center = center_code
    ? db.prepare('SELECT * FROM centers WHERE code = ?').get(center_code)
    : db.prepare('SELECT * FROM centers WHERE id = ?').get(Number(center_id));

  if (!center) {
    return res.status(404).json({ ok: false, error: 'لم يتم العثور على المركز' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, error: 'اختر صنفاً واحداً على الأقل قبل إرسال الطلب' });
  }

  // Validate live stock before committing
  const validated = [];
  for (const reqItem of items) {
    const qty = Math.floor(Number(reqItem.quantity) || 0);
    if (qty <= 0) continue;
    const supply = db.prepare('SELECT * FROM supplies WHERE id = ?').get(Number(reqItem.supply_id));
    if (!supply) {
      return res.status(400).json({ ok: false, error: 'أحد الأصناف المطلوبة لم يعد متوفراً' });
    }
    if (supply.available_qty < qty) {
      return res.status(400).json({
        ok: false,
        error: `الكمية المتاحة من "${supply.name}" هي ${supply.available_qty} ${supply.unit} فقط`
      });
    }
    validated.push({ supply, qty });
  }

  if (validated.length === 0) {
    return res.status(400).json({ ok: false, error: 'الكميات المطلوبة غير صالحة' });
  }

  const now = nowLocal();
  const lastId = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM orders').get().m;
  const orderCode = `EM-${2601 + lastId}`;
  const totalUnits = validated.reduce((s, x) => s + x.qty, 0);
  const initialLog = [
    {
      status: 'pending',
      label: STAGE_META.pending.label,
      time: now,
      note: `تم إرسال الطلب بواسطة ${manager_name.trim() || center.manager_name || 'مدير المركز'} عبر بوابة QR`
    }
  ];

  let orderId;
  db.exec('BEGIN');
  try {
    const info = db.prepare(`
      INSERT INTO orders (
        order_code, center_id, center_name, center_branch, manager_name, phone,
        priority, status, progress, notes, stage_log, total_items, total_units, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 15, ?, ?, ?, ?, ?, ?)
    `).run(
      orderCode,
      center.id,
      center.name,
      center.branch || '',
      manager_name.trim() || center.manager_name || '',
      phone.trim() || center.phone || '',
      ['normal', 'urgent', 'emergency'].includes(priority) ? priority : 'normal',
      notes.trim(),
      JSON.stringify(initialLog),
      validated.length,
      totalUnits,
      now,
      now
    );
    orderId = info.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, supply_id, supply_name, unit, category, quantity, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const deductStock = db.prepare('UPDATE supplies SET available_qty = available_qty - ?, updated_at = ? WHERE id = ?');

    for (const { supply, qty } of validated) {
      insertItem.run(orderId, supply.id, supply.name, supply.unit, supply.category, qty, supply.icon);
      deductStock.run(qty, now, supply.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ ok: false, error: 'حدث خطأ أثناء تسجيل الطلب' });
  }

  const order = hydrateOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));
  const updatedSupplies = db.prepare('SELECT * FROM supplies WHERE is_visible = 1 ORDER BY sort_order ASC, id DESC').all();

  broadcast('order:created', {
    order,
    center_code: center.code,
    supplies: updatedSupplies,
    stats: getStats(),
    analytics: getAnalytics('7d')
  });

  res.json({ ok: true, order, supplies: updatedSupplies });
});

app.patch('/api/orders/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'الطلب غير موجود' });

  const { status, admin_note, driver_name, driver_phone, eta_minutes } = req.body || {};
  if (!STAGE_META[status]) {
    return res.status(400).json({ ok: false, error: 'حالة غير صالحة' });
  }

  const now = nowLocal();
  let stageLog = [];
  try {
    stageLog = JSON.parse(existing.stage_log || '[]');
  } catch (_) {
    stageLog = [];
  }

  let logNote = admin_note?.trim() || '';
  if (!logNote) {
    if (status === 'approved') logNote = 'تم اعتماد الطلب وتأكيد توفر كامل الأصناف';
    else if (status === 'preparing') logNote = 'بدأ فريق المخزن تجهيز وتعبئة الأصناف وفحص الباركود';
    else if (status === 'dispatched') {
      const drv = driver_name?.trim() || existing.driver_name || 'مندوب التوصيل';
      const eta = Number(eta_minutes || existing.eta_minutes || 25);
      logNote = `انطلقت الشحنة مع ${drv} — وقت الوصول المتوقع ${eta} دقيقة`;
    } else if (status === 'delivered') logNote = 'تم تسليم الشحنة بالكامل للمركز بنجاح';
    else if (status === 'rejected') logNote = 'تم إلغاء المهمة وإرجاع الكميات تلقائياً للمخزن';
  }

  stageLog.push({
    status,
    label: STAGE_META[status].label,
    time: now,
    note: logNote
  });

  db.exec('BEGIN');
  try {
    // Restore stock if transitioning into rejected from a non-rejected status
    if (status === 'rejected' && existing.status !== 'rejected') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
      const restore = db.prepare('UPDATE supplies SET available_qty = available_qty + ?, updated_at = ? WHERE id = ?');
      for (const it of items) {
        if (it.supply_id) restore.run(it.quantity, now, it.supply_id);
      }
    }

    db.prepare(`
      UPDATE orders SET
        status = ?,
        progress = ?,
        admin_note = ?,
        driver_name = ?,
        driver_phone = ?,
        eta_minutes = ?,
        stage_log = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      status,
      STAGE_META[status].progress,
      admin_note !== undefined ? admin_note.trim() : existing.admin_note,
      driver_name !== undefined ? driver_name.trim() : existing.driver_name,
      driver_phone !== undefined ? driver_phone.trim() : existing.driver_phone,
      eta_minutes !== undefined ? Number(eta_minutes) || 0 : existing.eta_minutes,
      JSON.stringify(stageLog),
      now,
      id
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ ok: false, error: 'تعذر تحديث حالة المهمة' });
  }

  const order = hydrateOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
  const center = db.prepare('SELECT code FROM centers WHERE id = ?').get(order.center_id);
  const supplies = db.prepare('SELECT * FROM supplies ORDER BY sort_order ASC, id DESC').all();

  broadcast('order:updated', {
    order,
    center_code: center?.code || null,
    supplies,
    stats: getStats()
  });

  res.json({ ok: true, order });
});

app.delete('/api/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ ok: false, error: 'الطلب غير موجود' });

  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  broadcast('order:deleted', { id, stats: getStats() });
  res.json({ ok: true });
});

// ─── Settings ────────────────────────────────────────────────
app.put('/api/settings', (req, res) => {
  const allowed = ['brand_name', 'brand_subtitle', 'public_base_url', 'sound_alerts', 'show_out_of_stock'];
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const k of allowed) {
    if (req.body && req.body[k] !== undefined) {
      upsert.run(k, String(req.body[k]));
    }
  }
  res.json({ ok: true, settings: getSettingsMap(), baseUrl: getPublicBaseUrl(req) });
});

// ─── Page Routes ─────────────────────────────────────────────
app.get(['/', '/admin'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get(['/center', '/center/:code', '/c/:code', '/order', '/order/:code'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'center.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanIp();
  console.log(`\n🚀 إمداد QR (EmdadX Supply Portal) يعمل الآن!`);
  console.log(`   لوحة التحكم (Admin):   http://localhost:${PORT}/`);
  console.log(`   بوابة المركز (Demo):   http://localhost:${PORT}/c/sama-zaytoun`);
  console.log(`   رابط الشبكة للموبايل:  http://${lanIp}:${PORT}/c/sama-zaytoun\n`);
});
