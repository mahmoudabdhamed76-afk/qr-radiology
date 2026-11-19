'use strict';
/* QR codes without packages: qrcode-generator (MIT, vendored) → SVG + GIF data URL. */
const qrcode = require('./vendor/qrcode-generator');

function make(text) { const q = qrcode(0, 'M'); q.addData(String(text)); q.make(); return q; }

function svg(text, { dark = '#1B2B44', light = '#FFFFFF', margin = 2 } = {}) {
  const q = make(text), n = q.getModuleCount(), size = n + margin * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
function dataUrl(text, cell = 8) { return make(text).createDataURL(cell, cell * 2); }

module.exports = { svg, dataUrl };
