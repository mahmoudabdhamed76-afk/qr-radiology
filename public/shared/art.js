/* ════════════════════════════════════════════════════════════════════
   إمداد QR · product art — one drawing per kind of supply (160×120),
   chosen from the item's name/category. Colours come from base.css (--pa-*),
   so day/night follow the theme. A real photo (image_url) wins when set.
════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var S = function (rx) { return '<ellipse class="s" cx="82" cy="106" rx="' + (rx || 56) + '" ry="6"/>'; };
  var BOX = function (front, top, side) {   /* an iso carton: front 30..120 × 52..100, top, right side */
    return '<path class="' + top + ' l" d="M30 52 L50 38 L140 38 L120 52 Z"/><rect class="' + front + ' l" x="30" y="52" width="90" height="48" rx="2"/><path class="' + side + ' l" d="M120 52 L140 38 L140 86 L120 100 Z"/>';
  };
  var A = {
    film: S(60) +
      '<g transform="rotate(-9 86 30)"><rect class="sh l" x="54" y="4" width="64" height="50" rx="3"/><path class="rb" d="M86 11v36M86 18c-6 0-12 1.5-15 5.5M86 18c6 0 12 1.5 15 5.5M86 26c-7 0-13 1.5-16 6M86 26c7 0 13 1.5 16 6M86 34c-6 0-12 1.5-14 5.5M86 34c6 0 12 1.5 14 5.5"/></g>' +
      BOX('fm', 'fm2', 'fm3') + '<rect x="40" y="62" width="46" height="11" rx="2" fill="rgba(255,255,255,.9)"/><rect class="ac" x="40" y="78" width="22" height="7" rx="2"/><path class="hl" d="M34 95h26" style="opacity:.35"/>',
    bottle: S(40) +
      '<rect class="pp l" x="58" y="38" width="44" height="64" rx="9"/><path class="lq" d="M59.6 58 H100.4 V93 a7.4 7.4 0 0 1 -7.4 7.4 H67 A7.4 7.4 0 0 1 59.6 93 Z"/>' +
      '<rect class="fm l" x="63" y="56" width="34" height="30" rx="3"/><path class="rb" d="M68 64h16M68 70h24M68 76h12"/>' +
      '<rect class="mt l" x="68" y="28" width="24" height="12" rx="2"/><rect class="ac l" x="64" y="14" width="32" height="15" rx="3"/><path class="hl" d="M62 44v10" style="opacity:.6"/>' +
      '<rect class="pp l" x="110" y="66" width="22" height="36" rx="6" style="opacity:.9"/><rect class="lq" x="111.5" y="80" width="19" height="20.5" rx="5"/><rect class="ac l" x="113" y="58" width="16" height="9" rx="2"/>',
    jug: S(52) +
      '<path class="gl2 l" d="M50 46 V28 a5 5 0 0 1 5 -5 H85 a5 5 0 0 1 5 5 V46 H80 V33 H60 V46 Z"/>' +
      '<path class="gl l" d="M42 46 H104 L122 62 V98 a4 4 0 0 1 -4 4 H46 a4 4 0 0 1 -4 -4 Z"/>' +
      '<rect class="pp l" x="104" y="42" width="15" height="12" rx="2" transform="rotate(42 111.5 48)"/>' +
      '<rect class="pp l" x="52" y="60" width="54" height="32" rx="3"/><rect class="gl2" x="57" y="66" width="20" height="5" rx="2"/><path class="l fl" d="M57 77h40M57 84h26" style="stroke-width:1.1;opacity:.5"/><path class="hl" d="M48 54v38" style="opacity:.4"/>',
    gloves: S(58) +
      '<path class="gv l" d="M72 46 C70 34 70 24 73 14 c1.5-4 6-3.5 6 1 l0 16 c0-14 0-20 1.5-24 c1.5-4 6-3.5 6 1 l0 22 c0.6-12 1-18 2.6-21 c1.6-3.6 6-3 6 1.4 l-0.6 23 c1.4-8 3-12 5-13.6 c3-2.4 6 0 5 3.6 c-2.4 9-4 16-5 26 Z"/>' +
      BOX('pp', 'pp2', 'pp3') + '<ellipse class="ik" cx="85" cy="45" rx="24" ry="5" style="opacity:.85"/><path class="gv2" d="M74 46 C76 40 96 39 98 45 Z"/>' +
      '<rect class="gv" x="40" y="62" width="40" height="8" rx="3"/><path class="l fl" d="M40 78h56M40 86h34" style="stroke-width:1.1;opacity:.45"/><rect class="ac" x="98" y="76" width="14" height="14" rx="3"/>',
    syringe: S(64) +
      '<rect class="mt l" x="12" y="61" width="14" height="8" rx="2"/><path class="l" d="M2 65 H12" style="stroke-width:1.4"/>' +
      '<rect class="cl l" x="26" y="52" width="82" height="26" rx="5"/><rect class="lq" x="27.5" y="53.5" width="44" height="23" rx="3.5" style="opacity:.85"/>' +
      '<path class="l fl" d="M40 52v7M50 52v5M60 52v7M70 52v5M80 52v7M90 52v5M100 52v7" style="stroke-width:1.1"/>' +
      '<rect class="ik l" x="71" y="55" width="7" height="20" rx="2"/><rect class="mt2 l" x="108" y="61" width="28" height="8" rx="2"/><rect class="ac l" x="136" y="50" width="8" height="30" rx="3"/>' +
      '<rect class="pp l" x="104" y="47" width="6" height="36" rx="2"/><path class="hl" d="M32 58h30" style="opacity:.5"/>' +
      '<path class="l fl" d="M30 96 c10 -12 30 -12 40 0 s30 12 44 0" style="stroke:var(--pa-gel);stroke-width:3"/>',
    paper: S(58) +
      '<path class="pp2 l" d="M30 54 L52 38 L138 38 L116 54 Z"/><path class="pp l" d="M38 50.5 L55 39 L131 39 L114 50.5 Z" style="stroke-width:1"/>' +
      '<rect class="pp l" x="30" y="54" width="86" height="46" rx="2"/><path class="pp3 l" d="M116 54 L138 38 L138 84 L116 100 Z"/>' +
      '<rect class="ac" x="30.8" y="67" width="84.4" height="20"/><path class="ac2" d="M116.8 67 L137.2 52 L137.2 72 L116.8 87 Z"/>' +
      '<rect class="pp" x="55" y="71" width="38" height="12" rx="2"/><path class="l fl" d="M60 77h22" style="stroke-width:1.2;opacity:.6"/><path class="l fl" d="M33 58.5h80M33 62h80" style="stroke-width:.8;opacity:.35"/>',
    bag: S(56) +
      '<rect class="pp2 l" x="46" y="18" width="82" height="82" rx="4" transform="rotate(6 87 59)"/>' +
      '<rect class="pp l" x="34" y="22" width="84" height="80" rx="4"/><rect class="pp2 l" x="62" y="30" width="28" height="9" rx="4.5"/>' +
      '<rect class="ac" x="46" y="56" width="60" height="30" rx="3"/><path class="rb" d="M54 66h26M54 74h40"/><circle cx="96" cy="70" r="5" fill="rgba(255,255,255,.85)"/><path class="hl" d="M40 48v40" style="stroke:var(--pa-line);opacity:.12"/>',
    disc: S(56) +
      '<rect class="pp2 l" x="26" y="26" width="70" height="70" rx="3"/><rect class="ac" x="34" y="78" width="30" height="8" rx="2"/><path class="l fl" d="M34 40h40M34 47h28" style="stroke-width:1.1;opacity:.5"/>' +
      '<circle class="mt l" cx="98" cy="60" r="38"/><circle class="cl" cx="98" cy="60" r="30" style="opacity:.8"/><path class="hl" d="M78 42 a28 28 0 0 1 22 -10" style="opacity:.9"/><path class="hl" d="M120 76 a28 28 0 0 1 -12 10" style="opacity:.6"/>' +
      '<circle class="pp l" cx="98" cy="60" r="11"/><circle class="s" cx="98" cy="60" r="4" style="fill:var(--pa-line);opacity:.8"/>',
    spray: S(40) +
      '<rect class="cl l" x="58" y="44" width="44" height="58" rx="9"/><rect class="lq" x="59.5" y="66" width="41" height="34.5" rx="7.5" style="opacity:.55"/>' +
      '<rect class="pp l" x="63" y="60" width="34" height="28" rx="3"/><rect class="ac" x="74" y="65" width="12" height="12" rx="2"/><path class="l fl" d="M80 67.5v7M76.5 71h7" style="stroke:#fff;stroke-width:1.8"/>' +
      '<path class="mt l" d="M70 44 V34 H90 V44 Z"/><path class="ac l" d="M66 20 H98 a4 4 0 0 1 4 4 V34 H66 Z"/><path class="ac2 l" d="M102 24 H114 V30 H102 Z"/><path class="ac l" d="M72 34 L66 46 H74 L80 34 Z"/>' +
      '<g class="l fl" style="stroke-width:1.4;opacity:.45"><path d="M120 22h6M119 28h10M120 34h6"/></g>',
    roll: S(60) + BOX('bx', 'bx2', 'bx3') +
      '<path class="ac" d="M70 52 L90 38 L101 38 L81 52 Z"/>' +
      '<g><circle class="pp l" cx="48" cy="76" r="12"/><circle class="pp3" cx="48" cy="76" r="4"/><circle class="pp l" cx="75" cy="76" r="12"/><circle class="pp3" cx="75" cy="76" r="4"/><circle class="pp l" cx="102" cy="76" r="12"/><circle class="pp3" cx="102" cy="76" r="4"/></g>',
    toner: S(62) +
      '<path class="ik l" d="M22 58 H128 a10 10 0 0 1 10 10 V84 a6 6 0 0 1 -6 6 H22 a6 6 0 0 1 -6 -6 V64 a6 6 0 0 1 6 -6 Z"/>' +
      '<path class="ik l" d="M40 58 V48 a4 4 0 0 1 4 -4 H92 a4 4 0 0 1 4 4 V58" style="opacity:.92"/><path class="l fl" d="M52 50h32" style="stroke:var(--pa-metal);stroke-width:3"/>' +
      '<rect class="ac" x="30" y="66" width="56" height="14" rx="2"/><path class="rb" d="M36 73h28"/><rect class="mt l" x="100" y="68" width="30" height="10" rx="5"/><path class="hl" d="M24 62h90" style="opacity:.25"/>',
    box: S(60) + BOX('bx', 'bx2', 'bx3') +
      '<path class="ac" d="M70 52 L90 38 L101 38 L81 52 Z"/><rect class="ac" x="70.8" y="52.8" width="10" height="15"/>' +
      '<rect class="pp l" x="40" y="72" width="34" height="19" rx="2"/><path class="l fl" d="M45 78h20M45 84h14" style="stroke-width:1.1;opacity:.5"/>' +
      '<path class="l fl" d="M97 86v-12M93 78l4-4 4 4M108 86v-12M104 78l4-4 4 4" style="stroke-width:1.3"/>'
  };
  var RULES = [
    [/شنط|شنطة|ظرف|أظرف|اظرف|كيس|أكياس|bag/i, 'bag'], [/جل|gel|جالون/i, 'jug'], [/قفاز|جوانتي|glove/i, 'gloves'], [/سرنج|syringe|حاقن/i, 'syringe'],
    [/حبر|خرطوش|toner|ink/i, 'toner'], [/\bcd\b|dvd|أسطوان|اسطوان|سي دي/i, 'disc'], [/كحول|تعقيم|مطهر|ديتول|sanit/i, 'spray'], [/ملاء|رول|roll/i, 'roll'],
    [/ورق|تقارير|paper/i, 'paper'], [/صبغ|omnipaque|contrast|محلول|زجاج/i, 'bottle'], [/فيلم|أفلام|افلام|film/i, 'film']
  ];
  function match(t) { for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(t)) return RULES[i][1]; return null; }
  function key(it) { return match((it && (it.name || it.supply_name)) || '') || match((it && it.category) || '') || 'box'; }
  function svg(k, cls) { return '<svg class="pa' + (cls ? ' ' + cls : '') + '" viewBox="0 0 160 120" aria-hidden="true">' + (A[k] || A.box) + '</svg>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function thumb(it, cls) {
    var u = it && it.image_url;
    if (u && /^(data:image\/|https:\/\/)/.test(u)) return '<img src="' + esc(u) + '" alt="" loading="lazy">';
    return svg(key(it), cls);
  }
  window.ART = { key: key, svg: svg, thumb: thumb, raw: A };
})();
