'use strict';
/* ════════════════════════════════════════════════════════════════════
   QR Radiology — إمداد QR · v2
   Node 22+, no packages: node:http + node:sqlite.
   · /                 لوحة التحكم (بكلمة سر)
   · /c/<code>         صفحة المركز (متجر التوريدات) من الـ QR
   · /center           الكود العام: المدير يختار مركزه
   Code layout: src/{config,db,time,http,auth,sse,qr}.js, src/services/*, src/routes/*
════════════════════════════════════════════════════════════════════ */
const http = require('node:http');
const path = require('node:path');
const { PORT, HOST, PUBLIC_DIR, VERSION } = require('./src/config');
const { createApp } = require('./src/http');
require('./src/db');
const auth = require('./src/auth');

const app = createApp({ publicDir: PUBLIC_DIR });
require('./src/routes/admin').mount(app);
require('./src/routes/public').mount(app);

app.get('/api/health', (req, res) => res.ok({ version: VERSION, time: new Date().toISOString() }));
const page = f => (req, res) => res.file(path.join(PUBLIC_DIR, f));
app.get('/', page('panel/index.html'));
app.get('/admin', page('panel/index.html'));
['/center', '/center/:code', '/c/:code', '/order/:code'].forEach(p => app.get(p, page('store/index.html')));

const first = auth.initPassword();
http.createServer((req, res) => app.handle(req, res)).listen(PORT, HOST, () => {
  console.log(`\nإمداد QR v${VERSION} شغّال`);
  console.log(`  لوحة التحكم:  http://localhost:${PORT}/`);
  if (first) console.log(`  كلمة السر لأول مرة: ${first}   (اتحفظت كمان في data/ADMIN_PASSWORD.txt — غيّرها من الإعدادات)`);
  console.log('');
});
