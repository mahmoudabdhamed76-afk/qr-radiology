'use strict';
/* Egypt's clock, even on a UTC server (Railway). Stored as 'YYYY-MM-DD HH:MM:SS'. */
const { TZ } = require('./config');

function parts(d) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const o = {}; for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
}
function localStamp(d = new Date()) { const p = parts(d); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`; }
function localDate(d = new Date()) { return localStamp(d).slice(0, 10); }
function daysAgo(n) { return localDate(new Date(Date.now() - n * 86400000)); }

module.exports = { localStamp, localDate, daysAgo };
