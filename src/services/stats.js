'use strict';
/* Numbers for the dashboard: counters + scans/orders series for the chart. */
const { db } = require('../db');
const { localDate, daysAgo } = require('../time');

const one = (sql, ...p) => db.prepare(sql).get(...p);

function getStats() {
  const today = localDate();
  const by = {}; for (const r of db.prepare('SELECT status, COUNT(*) AS c FROM orders GROUP BY status').all()) by[r.status] = r.c;
  const pending = by.pending || 0, approved = by.approved || 0, preparing = by.preparing || 0, dispatched = by.dispatched || 0;
  return {
    ordersToday: one('SELECT COUNT(*) AS c FROM orders WHERE substr(created_at,1,10) = ?', today).c,
    pendingCount: pending, approvedCount: approved, preparingCount: preparing, dispatchedCount: dispatched,
    deliveredCount: by.delivered || 0, rejectedCount: by.rejected || 0,
    activeMissions: pending + approved + preparing + dispatched,
    totalSupplies: one('SELECT COUNT(*) AS c FROM supplies WHERE is_visible = 1').c,
    lowStockCount: one('SELECT COUNT(*) AS c FROM supplies WHERE available_qty > 0 AND available_qty <= min_stock').c,
    outOfStockCount: one('SELECT COUNT(*) AS c FROM supplies WHERE available_qty <= 0').c,
    totalUnitsStock: one('SELECT COALESCE(SUM(available_qty), 0) AS s FROM supplies').s,
    totalUnitsOrderedToday: one("SELECT COALESCE(SUM(total_units), 0) AS s FROM orders WHERE substr(created_at,1,10) = ? AND status != 'rejected'", today).s,
    activeCenters: one('SELECT COUNT(*) AS c FROM centers WHERE is_active = 1').c,
    scansToday: one('SELECT COUNT(*) AS c FROM qr_scans WHERE substr(scanned_at,1,10) = ?', today).c,
    scansYesterday: one('SELECT COUNT(*) AS c FROM qr_scans WHERE substr(scanned_at,1,10) = ?', daysAgo(1)).c
  };
}

const DAY = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
function getAnalytics(range = '7d') {
  const days = range === '30d' ? 30 : range === '14d' ? 14 : 7, from = daysAgo(days - 1);
  const sc = {}, od = {};
  for (const r of db.prepare('SELECT substr(scanned_at,1,10) AS d, COUNT(*) AS c FROM qr_scans WHERE substr(scanned_at,1,10) >= ? GROUP BY d').all(from)) sc[r.d] = r.c;
  for (const r of db.prepare("SELECT substr(created_at,1,10) AS d, COUNT(*) AS c FROM orders WHERE substr(created_at,1,10) >= ? AND status != 'rejected' GROUP BY d").all(from)) od[r.d] = r.c;
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i), dt = new Date(d + 'T12:00:00Z');
    series.push({ date: d, label: days <= 7 ? DAY[dt.getUTCDay()] : dt.getUTCDate() + '/' + (dt.getUTCMonth() + 1), scans: sc[d] || 0, orders: od[d] || 0 });
  }
  const sum = k => series.reduce((s, x) => s + x[k], 0);
  const topCenters = db.prepare(`SELECT c.id, c.name, c.branch, COUNT(o.id) AS orders, COALESCE(SUM(o.total_units),0) AS units
    FROM centers c LEFT JOIN orders o ON o.center_id = c.id AND substr(o.created_at,1,10) >= ? AND o.status != 'rejected'
    GROUP BY c.id ORDER BY orders DESC, units DESC LIMIT 5`).all(from);
  return { range: days + 'd', series, scans: sum('scans'), orders: sum('orders'), topCenters };
}

module.exports = { getStats, getAnalytics };
