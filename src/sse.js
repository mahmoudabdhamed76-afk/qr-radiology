'use strict';
/* Live updates (Server-Sent Events) on two kinds of channels:
   · 'admin'        — the dashboard (signed in only): everything
   · 'center:<id>'  — one center's page: only its own orders + the public catalog */
const clients = new Set();

function open(req, res, channel) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 4000\n');
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, time: Date.now() })}\n\n`);
  const c = { res, channel };
  clients.add(c);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) { done(); } }, 25000);
  const done = () => { clearInterval(ping); clients.delete(c); };
  req.on('close', done);
}

function send(channel, event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of clients) {
    if (c.channel !== channel && !(channel === '*' && c.channel.startsWith('center:'))) continue;
    try { c.res.write(data); } catch (_) { clients.delete(c); }
  }
}

module.exports = { open, toAdmin: (e, p) => send('admin', e, p), toCenter: (id, e, p) => send('center:' + id, e, p), toAllCenters: (e, p) => send('*', e, p), count: () => clients.size };
