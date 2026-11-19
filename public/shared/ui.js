/* ════════════════════════════════════════════════════════════════════
   إمداد QR · shared UI + motion (GSAP when present, plain CSS otherwise)
   Ripple, Animated Segmented Control, panels (Slide-In drawer / spring modal /
   Bottom Sheet with drag-to-close), toast, sun↔moon Icon Morphing, count-up,
   Scroll Reveal + Stagger, the order route, relative time.
════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = (!RM && window.gsap) ? window.gsap : null;
  if (!G) document.documentElement.classList.add('nomo');
  var MOB = function () { return matchMedia('(max-width:760px)').matches; };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(v) { return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function $(id) { return document.getElementById(id); }
  function qs(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function I(d, c) { return '<svg class="i' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>'; }
  var ICO = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    cart: '<path d="M3 4h2.2l2.3 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6.1"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17.5" cy="20.5" r="1.3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', arrow: '<path d="M19 12H5M11 18l-6-6 6-6"/>', send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    wa: '<path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.5A8.4 8.4 0 1 1 21 11.5z"/>', list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    store: '<path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    truck: '<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>', qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M17 21h4v-4M14 21v-3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    open: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>', print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    lens: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', pin: '<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', back: '<path d="m15 18-6-6 6-6"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'
  };
  var D_PLUS = 'M12 5 L12 19 M5 12 L19 12', D_CHECK = 'M5 12.5 L9.5 17 M9.5 17 L19 7';
  function morphIcon() { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path class="mph" d="' + D_PLUS + '"/></svg>'; }

  /* ripple */
  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest('.rp'); if (!t || t.disabled) return;
    var r = t.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, sp = document.createElement('span');
    sp.className = 'rp-i'; sp.style.width = sp.style.height = s + 'px'; sp.style.left = (e.clientX - r.left - s / 2) + 'px'; sp.style.top = (e.clientY - r.top - s / 2) + 'px';
    t.appendChild(sp); setTimeout(function () { sp.remove(); }, 650);
  });

  /* animated segmented control */
  function seg(id, items, on, cls) {
    return '<div class="seg' + (cls ? ' ' + cls : '') + '" id="' + id + '" role="tablist"><i class="seg-ind"></i>' + items.map(function (x) {
      return '<button type="button" role="tab" class="rp' + (x[0] === on ? ' on' : '') + '" data-v="' + esc(x[0]) + '" aria-selected="' + (x[0] === on) + '">' + x[1] + (x[2] != null ? '<span class="k n">' + x[2] + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function segMove(el, anim) {
    if (typeof el === 'string') el = $(el); if (!el) return;
    var b = qs('button.on', el), ind = qs('.seg-ind', el); if (!b || !ind) return;
    var x = b.offsetLeft, w = b.offsetWidth;
    if (G && anim) G.to(ind, { x: x, width: w, duration: .55, ease: 'back.out(1.25)' });
    else if (G) G.set(ind, { x: x, width: w }); else { ind.style.width = w + 'px'; ind.style.transform = 'translateX(' + x + 'px)'; }
    if (anim && el.scrollWidth > el.clientWidth) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }
  function segSet(el, v, anim) { if (typeof el === 'string') el = $(el); if (!el) return; qa('button', el).forEach(function (b) { var o = b.dataset.v === v; b.classList.toggle('on', o); b.setAttribute('aria-selected', o); }); segMove(el, anim); }
  window.addEventListener('resize', function () { qa('.seg').forEach(function (s) { segMove(s, false); }); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { qa('.seg').forEach(function (s) { segMove(s, false); }); });

  /* panels */
  var OPEN = [];
  function panelHTML(id, kind, title, w) {
    return '<div class="pn ' + kind + '" id="' + id + '" aria-hidden="true"' + (w ? ' style="--w:' + w + 'px"' : '') + '><div class="pn-bk" data-close></div><div class="pn-p" role="dialog" aria-modal="true">' +
      '<div class="pn-grab"></div>' + (title != null ? '<div class="pn-h"><div><b id="' + id + '-t">' + title + '</b><small id="' + id + '-n"></small></div><button class="ib rp" type="button" data-close aria-label="قفل">' + I(ICO.x) + '</button></div>' : '') +
      '<div class="pn-body" id="' + id + '-body"></div><div id="' + id + '-foot"></div></div></div>';
  }
  function openPanel(id, after) {
    var pn = $(id), p = qs('.pn-p', pn), bk = qs('.pn-bk', pn), side = pn.classList.contains('drawer');
    pn.classList.add('on'); pn.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    if (OPEN.indexOf(id) < 0) OPEN.push(id);
    if (G) {
      G.killTweensOf([p, bk]); G.to(bk, { opacity: 1, duration: .35, ease: 'power2.out' });
      if (MOB()) G.fromTo(p, { yPercent: 100, xPercent: 0, y: 0, scale: 1, opacity: 1 }, { yPercent: 0, duration: .55, ease: 'power4.out' });
      else if (side) G.fromTo(p, { xPercent: -105, yPercent: 0, opacity: 1 }, { xPercent: 0, duration: .6, ease: 'power4.out' });
      else G.fromTo(p, { scale: .92, opacity: 0, y: 24 }, { scale: 1, opacity: 1, y: 0, duration: .55, ease: 'back.out(1.5)' });
    } else bk.style.opacity = 1;
    if (after) after(p);
  }
  function closePanel(id, done) {
    var pn = $(id); if (!pn || !pn.classList.contains('on')) { if (done) done(); return; }
    var p = qs('.pn-p', pn), bk = qs('.pn-bk', pn), side = pn.classList.contains('drawer');
    OPEN = OPEN.filter(function (x) { return x !== id; });
    var fin = function () { pn.classList.remove('on'); pn.setAttribute('aria-hidden', 'true'); if (!OPEN.length) document.body.style.overflow = ''; if (G) G.set(p, { clearProps: 'transform,opacity' }); if (done) done(); };
    if (!G) { bk.style.opacity = 0; return fin(); }
    G.to(bk, { opacity: 0, duration: .3 });
    if (MOB()) G.to(p, { yPercent: 100, duration: .35, ease: 'power3.in', onComplete: fin });
    else if (side) G.to(p, { xPercent: -105, duration: .4, ease: 'power3.in', onComplete: fin });
    else G.to(p, { scale: .95, opacity: 0, y: 14, duration: .22, ease: 'power2.in', onComplete: fin });
  }
  function sheetDrag(id) {
    var pn = $(id), p = qs('.pn-p', pn), y0 = 0, dy = 0, t0 = 0, on = false;
    p.addEventListener('pointerdown', function (e) { if (!MOB() || !G || !e.target.closest('.pn-grab,.pn-h,.drag') || e.target.closest('button,input,textarea,select')) return; on = true; y0 = e.clientY; dy = 0; t0 = Date.now(); });
    p.addEventListener('pointermove', function (e) { if (!on) return; dy = Math.max(0, e.clientY - y0); G.set(p, { y: dy }); G.set(qs('.pn-bk', pn), { opacity: 1 - Math.min(.8, dy / 500) }); });
    var end = function () { if (!on) return; on = false; var v = dy / Math.max(1, Date.now() - t0); if (dy > 120 || v > .6) G.to(p, { y: p.offsetHeight, duration: .25, ease: 'power2.in', onComplete: function () { G.set(p, { y: 0 }); closePanel(id); } }); else { G.to(p, { y: 0, duration: .45, ease: 'back.out(1.6)' }); G.to(qs('.pn-bk', pn), { opacity: 1, duration: .2 }); } };
    p.addEventListener('pointerup', end); p.addEventListener('pointercancel', end);
  }
  document.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('[data-close]'); if (c) { var pn = c.closest('.pn'); if (pn) closePanel(pn.id); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && OPEN.length) closePanel(OPEN[OPEN.length - 1]); });

  /* toast */
  var tT;
  function toast(m, bad) { var t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = m; t.classList.toggle('bad', !!bad); t.classList.add('on'); clearTimeout(tT); tT = setTimeout(function () { t.classList.remove('on'); }, 3400); }

  /* theme: sun ↔ moon morph */
  function thmSVG() {
    var rays = ''; for (var a = 0; a < 8; a++) { var r = a * Math.PI / 4; rays += '<line class="ray" x1="' + (12 + Math.cos(r) * 8).toFixed(2) + '" y1="' + (12 + Math.sin(r) * 8).toFixed(2) + '" x2="' + (12 + Math.cos(r) * 10.5).toFixed(2) + '" y2="' + (12 + Math.sin(r) * 10.5).toFixed(2) + '"/>'; }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><mask id="thm-m"><rect x="-6" y="-6" width="36" height="36" fill="#fff"/><circle class="mc" cx="30" cy="-6" r="7" fill="#000"/></mask></defs><circle class="orb" cx="12" cy="12" r="5" mask="url(#thm-m)"/><g class="rays">' + rays + '</g></svg>';
  }
  function themeIcon(btn, anim) {
    var night = document.documentElement.classList.contains('night'); if (!btn) return;
    btn.setAttribute('aria-label', night ? 'الوضع النهاري' : 'الوضع الليلي');
    var orb = qs('.orb', btn), mc = qs('.mc', btn), rays = qs('.rays', btn);
    var to = night ? { r: 8.5, cx: 17, cy: 7, s: 0, rot: 90 } : { r: 5, cx: 30, cy: -6, s: 1, rot: 0 };
    if (G && anim) { G.to(orb, { attr: { r: to.r }, duration: .5, ease: 'back.out(1.7)' }); G.to(mc, { attr: { cx: to.cx, cy: to.cy }, duration: .5, ease: 'power3.inOut' }); G.to(rays, { scale: to.s, rotate: to.rot, opacity: to.s, transformOrigin: '50% 50%', duration: .45, ease: 'power3.inOut' }); }
    else { orb.setAttribute('r', to.r); mc.setAttribute('cx', to.cx); mc.setAttribute('cy', to.cy); rays.style.opacity = to.s; rays.style.transform = 'scale(' + to.s + ')'; rays.style.transformOrigin = '12px 12px'; }
    var m = qs('meta[name="theme-color"]'); if (m) m.content = night ? '#000000' : '#F7EBDB';
  }
  function toggleTheme(btn) { var on = !document.documentElement.classList.contains('night'); document.documentElement.classList.toggle('night', on); try { localStorage.setItem('qr_theme', on ? 'night' : 'day'); } catch (e) {} themeIcon(btn, true); }

  /* count-up, reveal */
  function countUp(els, delay) { (typeof els === 'string' ? qa(els) : Array.prototype.slice.call(els || [])).forEach(function (b) { var to = Number(b.dataset.count != null ? b.dataset.count : b.textContent.replace(/[^\d.]/g, '')) || 0; if (!G) { b.textContent = n(to); return; } var o = { v: 0 }; G.to(o, { v: to, duration: 1.1, delay: delay || .2, ease: 'power2.out', onUpdate: function () { b.textContent = n(Math.round(o.v)); } }); }); }
  var IO = null;
  function reveal(els) {
    els = typeof els === 'string' ? qa(els) : els;
    if (!G || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.remove('rv'); }); return; }
    if (!IO) IO = new IntersectionObserver(function (ents) {
      var show = ents.filter(function (e) { return e.isIntersecting; }).map(function (e) { IO.unobserve(e.target); return e.target; });
      if (show.length) G.to(show, { opacity: 1, y: 0, duration: .7, ease: 'power3.out', stagger: .06, onComplete: function () { show.forEach(function (e) { e.classList.remove('rv'); G.set(e, { clearProps: 'transform,opacity' }); }); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .06 });
    els.forEach(function (e) { IO.observe(e); });
  }
  function enter(els, opts) { els = typeof els === 'string' ? qa(els) : els; if (!G || !els.length) return; G.fromTo(els, { opacity: 0, y: (opts && opts.y) || 14 }, { opacity: 1, y: 0, duration: .55, ease: 'power3.out', stagger: { each: .04, amount: .45 }, delay: (opts && opts.delay) || 0, clearProps: 'opacity,transform' }); }

  /* order stages: the route */
  var STAGES = [['pending', 'اتبعت'], ['approved', 'اتعتمد'], ['preparing', 'بيتجهز'], ['dispatched', 'في الطريق'], ['delivered', 'اتسلّم']];
  var HEAD = { pending: 'اتبعت — مستني الاعتماد', approved: 'اتعتمد واتحجزت الكميات', preparing: 'بيتجهز في المخزن', dispatched: 'في الطريق للمركز', delivered: 'اتسلّم', rejected: 'اتلغى' };
  var TONE = { pending: 'warn', approved: 'acc', preparing: 'acc', dispatched: 'info', delivered: 'ok', rejected: 'bad' };
  var PRIO = { normal: ['عادي', ''], urgent: ['مستعجل', 'warn'], emergency: ['طارئ', 'bad'] };
  function pOf(st) { var i = STAGES.findIndex(function (s) { return s[0] === st; }); return st === 'rejected' || i < 0 ? 0 : i / (STAGES.length - 1) * 100; }
  function riderSVG(st) {
    if (st === 'dispatched') return '<svg viewBox="0 0 36 28" aria-hidden="true"><rect class="tk" x="11" y="6" width="23" height="15" rx="2"/><rect class="tp" x="11" y="15" width="23" height="2.5"/><path class="tk" d="M11 10H6l-4 5v6h9z"/><circle class="tk wl" cx="8" cy="22" r="3.2"/><circle class="tk wl" cx="28" cy="22" r="3.2"/></svg>';
    if (st === 'delivered') return '<svg viewBox="0 0 36 28" aria-hidden="true"><rect class="bx" x="6" y="7" width="22" height="18" rx="2"/><rect class="tp" x="15" y="7" width="4" height="18"/><circle cx="29" cy="8" r="6.5" style="fill:var(--ok)"/><path d="M26.2 8l2 2 3.6-3.8" style="stroke:var(--card);stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"/></svg>';
    return '<svg viewBox="0 0 36 28" aria-hidden="true"><path class="bx" d="M7 9l3-5h16l3 5" style="fill:var(--pa-box2)"/><rect class="bx" x="7" y="9" width="22" height="17" rx="2"/><rect class="tp" x="16" y="9" width="4" height="17"/></svg>';
  }
  function routeHTML(st) {
    var idx = STAGES.findIndex(function (s) { return s[0] === st; }), last = STAGES.length - 1, no = st === 'rejected', p = pOf(st);
    return '<div class="route' + (no ? ' no' : '') + '" data-p="' + p + '" role="img" aria-label="حالة الطلب: ' + (HEAD[st] || st) + '"><i class="r0"></i><i class="r1" style="width:' + p + '%"></i>' +
      STAGES.map(function (s, i) { return '<i class="stop' + (no ? '' : i < idx ? ' on' : i === idx ? ' cur' : '') + '" style="right:' + (i / last * 100) + '%"><span>' + s[1] + '</span></i>'; }).join('') +
      '<span class="rider" style="right:' + p + '%">' + riderSVG(st) + '</span></div>';
  }
  function routeGrow(el, from, delay) {   /* the fill and the rider glide from `from` to their place */
    if (!G || !el) return; var p = Number(el.dataset.p) || 0, r1 = qs('.r1', el), rd = qs('.rider', el);
    G.fromTo(r1, { width: (from || 0) + '%' }, { width: p + '%', duration: 1.1, ease: 'power3.inOut', delay: delay || 0 });
    G.fromTo(rd, { right: (from || 0) + '%' }, { right: p + '%', duration: 1.1, ease: 'power3.inOut', delay: delay || 0 });
    if (from) G.fromTo(qs('svg', rd), { y: 0 }, { y: -8, duration: .3, yoyo: true, repeat: 1, ease: 'power2.out', delay: delay || 0 });
  }
  function timelineHTML(log) {
    var ic = { pending: ICO.send, approved: ICO.check, preparing: ICO.box, dispatched: ICO.truck, delivered: ICO.check, rejected: ICO.ban };
    return '<div class="tl">' + (log || []).slice().reverse().map(function (x, i) {
      return '<div class="tl-i' + (i === 0 ? ' last' : '') + '"><span class="tl-d">' + I(ic[x.status] || ICO.clock) + '</span><div><b>' + esc(HEAD[x.status] || x.label) + '</b><small>' + esc(when(x.time)) + '</small>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  /* time: stored as 'YYYY-MM-DD HH:MM:SS' (Cairo) */
  function parse(s) { if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : new Date(s); }
  function when(s) { var d = parse(s); if (!d || isNaN(d)) return ''; return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' }); }
  function ago(s) {
    var d = parse(s); if (!d || isNaN(d)) return ''; var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })), m = Math.round((now - d) / 60000);
    if (m < 1) return 'دلوقتي'; if (m < 60) return 'من ' + m + ' دقيقة'; if (m < 1440) return 'من ' + Math.round(m / 60) + ' ساعة'; if (m < 2880) return 'امبارح';
    return when(s);
  }

  function api(method, url, body) {
    return fetch(url, { method: method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) { var e = new Error(j.error || 'محصلش — جرّب تاني'); e.status = r.status; e.j = j; throw e; } return j; }); });
  }
  function waNum(v) { return String(v || '').replace(/[^\d]/g, '').replace(/^00/, '').replace(/^0(?=1\d{9}$)/, '20'); }

  try { var t = localStorage.getItem('qr_theme'); if (t) document.documentElement.classList.toggle('night', t === 'night'); } catch (e) {}

  window.UI = { G: G, RM: RM, MOB: MOB, esc: esc, n: n, $: $, qs: qs, qa: qa, I: I, ICO: ICO, D_PLUS: D_PLUS, D_CHECK: D_CHECK, morphIcon: morphIcon,
    seg: seg, segMove: segMove, segSet: segSet, panelHTML: panelHTML, openPanel: openPanel, closePanel: closePanel, sheetDrag: sheetDrag, isOpen: function () { return OPEN.length > 0; },
    toast: toast, thmSVG: thmSVG, themeIcon: themeIcon, toggleTheme: toggleTheme, countUp: countUp, reveal: reveal, enter: enter,
    STAGES: STAGES, HEAD: HEAD, TONE: TONE, PRIO: PRIO, pOf: pOf, routeHTML: routeHTML, routeGrow: routeGrow, timelineHTML: timelineHTML, riderSVG: riderSVG,
    parse: parse, when: when, ago: ago, api: api, waNum: waNum };
})();
