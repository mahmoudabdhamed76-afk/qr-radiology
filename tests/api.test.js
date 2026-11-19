'use strict';
/* node --test tests/  — boots the server on a temp folder and walks the main flows */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 3999, B = `http://127.0.0.1:${PORT}`, PW = 'test-password-123';
let proc, dir, cookie = '';
const req = async (m, p, body, ck) => {
  const r = await fetch(B + p, { method: m, headers: Object.assign(body ? { 'Content-Type': 'application/json' } : {}, ck ? { Cookie: ck } : {}), body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})), headers: r.headers };
};

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrr-'));
  proc = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: Object.assign({}, process.env, { PORT, DATA_DIR: dir, ADMIN_PASSWORD: PW, HOST: '127.0.0.1' }), stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(B + '/api/health')).ok) return; } catch (_) {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error('server did not start');
});
after(() => { proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

test('the dashboard API needs the password', async () => {
  assert.equal((await req('GET', '/api/admin/bootstrap')).status, 401);
  assert.equal((await req('POST', '/api/login', { password: 'wrong' })).status, 401);
  const r = await req('POST', '/api/login', { password: PW });
  assert.equal(r.status, 200);
  cookie = r.headers.get('set-cookie').split(';')[0];
  const b = await req('GET', '/api/admin/bootstrap', null, cookie);
  assert.equal(b.status, 200);
  assert.ok(b.json.centers.length >= 1 && b.json.supplies.length >= 1);
});

test('a center orders from its link, stock is reserved and comes back on cancel', async () => {
  const c = (await req('POST', '/api/admin/centers', { name: 'مركز التجربة' }, cookie)).json.center;
  assert.match(c.code, /^[a-z2-9]{8}$/);
  const s = (await req('POST', '/api/admin/supplies', { name: 'فيلم تجربة', category: 'أفلام أشعة', available_qty: 10, max_per_order: 4 }, cookie)).json.supply;
  const page = await req('GET', `/api/public/center/${c.code}`);
  assert.equal(page.status, 200);
  assert.equal(page.json.supplies.find(x => x.id === s.id).min_stock, undefined, 'internal fields stay private');
  assert.equal((await req('POST', `/api/public/center/${c.code}/orders`, { items: [{ supply_id: s.id, quantity: 5 }] })).status, 409, 'max per order');
  const o = (await req('POST', `/api/public/center/${c.code}/orders`, { items: [{ supply_id: s.id, quantity: 3 }], priority: 'urgent' })).json.order;
  assert.equal(o.status, 'pending');
  assert.match(o.order_code, /^EM-\d+$/);
  let list = (await req('GET', '/api/admin/bootstrap', null, cookie)).json;
  assert.equal(list.supplies.find(x => x.id === s.id).available_qty, 7);
  const other = list.centers.find(x => x.id !== c.id);
  const theirs = (await req('GET', `/api/public/center/${other.code}?silent=1`)).json.orders;
  assert.ok(!theirs.some(x => x.id === o.id), 'a center never sees another center\'s orders');
  const up = await req('PATCH', `/api/admin/orders/${o.id}`, { status: 'dispatched', driver_name: 'طارق', eta_minutes: 15 }, cookie);
  assert.equal(up.json.order.status, 'dispatched');
  await req('PATCH', `/api/admin/orders/${o.id}`, { status: 'rejected' }, cookie);
  list = (await req('GET', '/api/admin/bootstrap', null, cookie)).json;
  assert.equal(list.supplies.find(x => x.id === s.id).available_qty, 10);
});

test('writes must be JSON and an unknown center link is closed', async () => {
  const r = await fetch(B + '/api/admin/settings', { method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(r.status, 415);
  assert.equal((await req('GET', '/api/public/center/nope-nope')).status, 404);
});
