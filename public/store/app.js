/* ════════════════════════════════════════════════════════════════════
   إمداد QR · صفحة المركز — متجر التوريدات
   /c/<code>  → the center's store: catalog first, quick view, cart (drawer /
                bottom sheet), priority, the order flies to the warehouse,
                then «طلباتي» with a live route, driver card and timeline.
   /center    → the general QR: the manager picks his center.
   Motion: Mask Wipe headline, Magnifier Reveal + SVG Scan-Line on the shelf,
   Skeleton Shimmer, Scroll Reveal + Stagger, Hover Lift, Ripple, Spring Scale,
   fly-to-cart, Icon Morphing, Bottom Sheet, Morph (carton → check),
   Page Transitions (mask wipe) between المتجر and طلباتي.
════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var U = window.UI, A = window.ART, G = U.G, esc = U.esc, n = U.n, $ = U.$, qs = U.qs, qa = U.qa, I = U.I, ICO = U.ICO;
  var M = /^\/(?:c|center|order)\/([^/]+)\/?$/.exec(location.pathname), CODE = M ? decodeURIComponent(M[1]) : '';
  var API = '/api/public/center/' + encodeURIComponent(CODE);
  var HOVER = matchMedia('(hover:hover)').matches;
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  var S = { center: null, items: [], orders: [], brand: {}, cart: LS.get('qr_cart_' + CODE, {}) || {}, cat: 'all', q: '', view: 'store', of: 'all', seen: {}, fresh: null, sending: false, prio: 'normal' };
  var ME = LS.get('qr_me_' + CODE, {}) || {};

  function capOf(it) { return Math.max(0, Math.min(it.available_qty, it.max_per_order > 0 ? it.max_per_order : Infinity)); }
  function itemById(id) { id = Number(id); for (var i = 0; i < S.items.length; i++) if (S.items[i].id === id) return S.items[i]; return null; }
  function cartList() { return Object.keys(S.cart).map(function (id) { var it = itemById(id); return it && S.cart[id] > 0 ? { it: it, q: S.cart[id] } : null; }).filter(Boolean); }
  function saveCart() { LS.set('qr_cart_' + CODE, S.cart); }
  function stateOf(it) { if (it.available_qty <= 0) return ['bad', 'خلص']; if (it.available_qty <= 5) return ['warn', 'كمية محدودة']; return ['ok', 'متاح']; }
  function live(o) { return o.status !== 'delivered' && o.status !== 'rejected'; }

  /* ═════ the general QR: pick your center ═════ */
  function directory() {
    document.title = 'اختار مركزك';
    $('app').innerHTML = '<main class="main"><div class="dir"><span class="eyebrow"><i class="dt"></i><span>متجر التوريدات</span></span><h1>اختار مركزك</h1><p>اختار اسم المركز وهتفتح صفحة الطلب بتاعته. الأحسن تمسح الكود اللي على باب مركزك.</p>' +
      '<label class="search">' + I(ICO.search) + '<input id="dq" type="search" placeholder="اسم المركز أو الفرع"></label><div class="dl" id="dl">' + [0, 1, 2, 3].map(function () { return '<i class="sk" style="height:72px;border-radius:16px"></i>'; }).join('') + '</div></div></main>';
    U.api('GET', '/api/public/directory').then(function (j) {
      if (!j.enabled) { $('dl').innerHTML = '<div class="empty">' + A.svg('box') + '<b>امسح الكود اللي على باب مركزك</b>كل مركز ليه كود خاص بيه</div>'; return; }
      var draw = function () {
        var q = ($('dq').value || '').trim(), list = j.centers.filter(function (c) { return !q || (c.name + ' ' + c.branch).indexOf(q) >= 0; });
        $('dl').innerHTML = list.length ? list.map(function (c) { return '<a class="rp" href="/c/' + encodeURIComponent(c.code) + '"><span class="mk">' + I(ICO.store) + '</span><span><b>' + esc(c.name) + '</b><small>' + esc(c.branch || '') + '</small></span><span class="go">' + I(ICO.back) + '</span></a>'; }).join('') : '<div class="empty"><b>مفيش مركز بالاسم ده</b></div>';
        U.enter(qa('#dl > *'));
      };
      $('dq').addEventListener('input', draw); draw();
    }).catch(function (e) { $('dl').innerHTML = '<div class="empty"><b>' + esc(e.message) + '</b></div>'; });
  }

  /* ═════ shell ═════ */
  function shell() {
    var views = [['store', 'المتجر'], ['orders', 'طلباتي', 0]];
    $('app').innerHTML =
      '<header class="top" id="top"><div class="top-in">' +
        '<div class="brand"><span class="mk">' + I(ICO.store) + '</span><div style="min-width:0"><b>' + esc(S.center.name) + '</b><small>' + esc(S.center.branch ? S.center.branch + ' · ' : '') + esc(S.brand.brand_name || 'متجر التوريدات') + '</small></div></div>' +
        U.seg('seg-view', views, 'store') +
        '<div class="act"><button class="ib thm rp" id="thm" type="button">' + U.thmSVG() + '</button>' +
          '<button class="cartbtn rp" id="cartbtn" type="button" aria-label="السلة"><span class="ico">' + I(ICO.cart, 'ct') + I(ICO.check, 'ck') + '</span><span class="lb">السلة</span><span class="badge z n" id="badge">0</span></button></div>' +
      '</div><div class="mnav">' + U.seg('seg-view-m', views, 'store') + '</div></header>' +
      '<main class="main"><section id="v-store"></section><section id="v-orders" hidden></section></main>' +
      U.panelHTML('cart', 'drawer', 'السلة') + U.panelHTML('qv', 'modal', null, 880) +
      '<div class="pill" id="pill"><div class="t"><b id="pill-t"></b><small id="pill-s"></small></div><button class="b rp" type="button" data-open-cart>' + I(ICO.cart) + 'السلة</button></div>';
    U.themeIcon($('thm'), false);
    document.title = 'متجر ' + S.center.name;
  }

  /* ═════ hero shelf (base + film negative under the magnifier) ═════ */
  var SLOTS = [[130, 150], [260, 150], [390, 150], [130, 272], [260, 272], [390, 272]];
  function shelf(neg) {
    var list = S.items.slice(0, 6), dflt = ['film', 'bottle', 'gloves', 'jug', 'syringe', 'paper'];
    var out = '<svg class="layer pa' + (neg ? ' neg' : '') + '" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    out += neg ? '<rect class="bgn" width="520" height="400"/>' : '<path class="wall" d="M0 52h520M0 336h520M70 0v52M180 0v52M300 0v52M420 0v52"/>';
    out += '<path class="shelf" d="M40 40v332M480 40v332M40 150h440M40 272h440M10 372h500"/>';
    SLOTS.forEach(function (s, k) {
      var it = list[k], key = it ? A.key(it) : dflt[k];
      out += '<g transform="translate(' + (s[0] - 52) + ' ' + (s[1] - 72.8) + ') scale(.65)">' + A.raw[key] + '</g>';
      if (neg && it) {
        var nm = it.name.length > 16 ? it.name.slice(0, 15) + '…' : it.name;
        out += '<g class="tg" transform="translate(' + s[0] + ' ' + (s[1] - 92) + ')"><rect x="-62" y="-26" width="124" height="34" rx="8"/><text x="0" y="-12" text-anchor="middle" direction="rtl" font-size="10.5">' + esc(nm) + '</text>' +
          '<text x="0" y="3" text-anchor="middle" direction="rtl" font-size="11.5" font-weight="600" style="fill:' + (it.available_qty > 0 ? '#8C350E' : '#B91C1C') + '">' + (it.available_qty > 0 ? n(it.available_qty) + ' ' + esc(it.unit) : 'خلص') + '</text></g>';
      }
    });
    out += '<g transform="translate(96 312) scale(.55)">' + A.raw.box + '</g><g transform="translate(176 316) scale(.48)">' + A.raw.roll + '</g><g transform="translate(330 310) scale(.56)">' + A.raw.film + '</g>';
    return out + '</svg>';
  }
  function cats() {
    var c = {}, order = []; S.items.forEach(function (it) { if (!c[it.category]) { c[it.category] = 0; order.push(it.category); } c[it.category]++; });
    return [['all', 'الكل', S.items.length]].concat(order.map(function (k) { return [k, k, c[k]]; }));
  }
  function liveStrip() {
    var o = S.orders.filter(live)[0]; if (!o) return '';
    var extra = o.status === 'dispatched' && o.eta_minutes ? ' · الوصول خلال ' + o.eta_minutes + ' دقيقة تقريبًا' : '';
    return '<a class="live rp" href="#orders" id="livestrip"><span class="rd">' + U.riderSVG(o.status) + '</span><span style="min-width:0"><b>' + esc(U.HEAD[o.status]) + '</b><small>طلب <span class="n">' + esc(o.order_code) + '</span>' + esc(extra) + '</small><span class="bar"><i style="width:' + U.pOf(o.status) + '%"></i></span></span><span class="b g sm">تابع الطلب ' + I(ICO.arrow) + '</span></a>';
  }
  function storeHTML() {
    var inStock = S.items.filter(function (i) { return i.available_qty > 0; }).length, open = S.orders.filter(live).length;
    return '<div class="hero"><div>' +
        '<span class="eyebrow hi"><i class="dt"></i><span>' + esc(S.center.branch || S.center.name) + ' · الطلبات مفتوحة</span></span>' +
        '<h1 class="h1"><span class="ln">كل توريدات مركزك</span><span class="ln">في <em>مكان واحد</em></span></h1>' +
        '<p class="lead hi">اختار الأصناف والكمية من المتاح دلوقتي، والطلب بيوصل للمخزن على طول وتتابعه لحد باب المركز</p>' +
        '<div class="cta hi"><button class="b lg rp" type="button" data-go-grid>تصفّح الأصناف ' + I(ICO.arrow) + '</button>' + (open ? '<a class="b g lg rp" href="#orders">' + I(ICO.truck) + 'طلباتك الشغالة</a>' : '') + '</div>' +
        '<div class="facts hi"><div><b class="n" data-count="' + inStock + '">' + inStock + '</b><small>صنف متاح</small></div><div><b class="n" data-count="' + (cats().length - 1) + '">' + (cats().length - 1) + '</b><small>أقسام</small></div>' +
          (S.orders.length ? '<a href="#orders"><b class="n" data-count="' + open + '">' + open + '</b><small>طلب شغال</small></a>' : '') + '</div>' +
      '</div><div class="art" id="art">' + shelf(false) + shelf(true) + '<div class="scan" id="scan"></div><div class="lens"></div><span class="lens-tip">' + I(ICO.lens) + (HOVER ? 'حرّك العدسة على الرف تشوف المتاح' : 'العدسة بتوريك المتاح على الرف') + '</span></div></div>' +
      '<div id="livewrap">' + liveStrip() + '</div>' +
      '<div class="sbar" id="sbar">' + U.seg('seg-cat', cats(), S.cat) + '<label class="search">' + I(ICO.search) + '<input id="q" type="search" placeholder="دوّر على صنف" autocomplete="off" value="' + esc(S.q) + '"><span class="sr">بحث</span></label></div>' +
      '<div class="h2"><h2>الأصناف</h2><small id="shown"></small></div><div class="grid" id="grid">' + skel(8) + '</div>';
  }
  function skel(k) { var s = ''; for (var i = 0; i < k; i++) s += '<div class="sk-card sk" aria-hidden="true"><i class="a"></i><i class="t1"></i><i class="t2"></i><i class="t3"></i></div>'; return s; }
  function ctl(it) {
    var q = S.cart[it.id] || 0, cap = capOf(it);
    if (cap <= 0) return '<button class="add" type="button" disabled aria-label="خلص">' + I(ICO.x) + '</button>';
    if (q > 0) return '<div class="stp" data-stp><button type="button" class="rp" data-inc="1" aria-label="زوّد"' + (q >= cap ? ' disabled' : '') + '>' + I(ICO.plus) + '</button><input class="n" inputmode="numeric" data-qty value="' + q + '" aria-label="الكمية"><button type="button" class="rp" data-inc="-1" aria-label="قلّل">' + I(ICO.minus) + '</button></div>';
    return '<button class="add rp" type="button" data-add aria-label="أضف ' + esc(it.name) + ' للسلة">' + I(ICO.plus) + '</button>';
  }
  function card(it) {
    var st = stateOf(it), q = S.cart[it.id] || 0;
    return '<article class="pc rv' + (q ? ' in' : '') + (st[0] === 'bad' ? ' out' : '') + '" data-id="' + it.id + '" tabindex="0" aria-label="' + esc(it.name) + '">' +
      '<div class="pc-art">' + A.thumb(it) + '<span class="tag pc-tag ' + st[0] + '"><i></i>' + st[1] + '</span></div>' +
      '<div class="pc-b"><span class="pc-cat">' + esc(it.category) + ' · ' + esc(it.unit) + '</span><h3>' + esc(it.name) + '</h3>' +
      '<div class="pc-f"><div class="pc-av">' + (st[0] === 'bad' ? '<b>خلص</b>هيتوفر قريب' : '<b class="n">' + n(it.available_qty) + '</b>' + esc(it.unit) + ' متاح') + '</div>' + ctl(it) + '</div></div></article>';
  }
  function visible() { var q = S.q.trim(); return S.items.filter(function (it) { return (S.cat === 'all' || it.category === S.cat) && (!q || (it.name + ' ' + it.description + ' ' + it.category).indexOf(q) >= 0); }); }
  function grid() {
    var el = $('grid'); if (!el) return; var list = visible();
    $('shown').textContent = list.length !== S.items.length ? list.length + ' من ' + S.items.length : S.items.length + ' صنف';
    if (!list.length) { el.innerHTML = '<div class="empty" style="grid-column:1/-1">' + A.svg('box') + '<b>' + (S.items.length ? 'مفيش صنف بالاسم ده' : 'لسه مفيش أصناف') + '</b>' + (S.items.length ? 'جرّب كلمة تانية أو قسم تاني' : 'كلّم المورد ويجهزلك اللي محتاجه') + '</div>'; U.enter([el.firstChild]); return; }
    el.innerHTML = list.map(card).join('');
    U.reveal(qa('.pc.rv', el));
  }
  function swapGrid() {
    var cards = qa('#grid .pc'); if (!G || !cards.length) return grid();
    G.to(cards, { opacity: 0, y: -10, scale: .97, duration: .18, ease: 'power2.in', stagger: .015, onComplete: grid });
  }
  function refreshCard(id, spring) {
    var el = qs('.pc[data-id="' + id + '"]'), it = itemById(id); if (!el || !it) return;
    el.classList.toggle('in', (S.cart[id] || 0) > 0);
    var f = qs('.pc-f', el), old = f.lastElementChild, tmp = document.createElement('div'); tmp.innerHTML = ctl(it);
    var nw = tmp.firstChild, wasStp = old.hasAttribute('data-stp'), isStp = nw.hasAttribute('data-stp');
    if (wasStp && isStp) { var inp = qs('input', old); if (document.activeElement !== inp) inp.value = S.cart[id] || 0; qs('[data-inc="1"]', old).disabled = (S.cart[id] || 0) >= capOf(it); return; }
    old.replaceWith(nw);
    if (G && spring) { if (isStp) G.fromTo(nw, { width: 44, opacity: .4 }, { width: 'auto', opacity: 1, duration: .5, ease: 'back.out(1.6)', clearProps: 'width' }); else G.fromTo(nw, { scale: .5, rotate: -90 }, { scale: 1, rotate: 0, duration: .5, ease: 'back.out(2)' }); }
  }

  /* ═════ hero motion ═════ */
  var heroT = [];
  function heroIn() {
    heroT.forEach(function (t) { try { t.kill(); } catch (e) {} }); heroT = [];
    if (G) {
      G.fromTo(qa('.h1 .ln'), { clipPath: 'inset(0% 0% 0% 100%)', y: 14 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1, ease: 'power4.out', stagger: .14, delay: .05, clearProps: 'clipPath' });
      G.from(qa('.hero .hi'), { opacity: 0, y: 18, duration: .8, ease: 'power3.out', stagger: .08, delay: .25 });
      G.from('#art', { opacity: 0, scale: .96, duration: 1, ease: 'power3.out', delay: .1 });
      G.from('#sbar,#livewrap', { opacity: 0, y: 12, duration: .6, ease: 'power3.out', delay: .45 });
    }
    U.countUp(qa('.facts [data-count]'), .5);
    var bar = qs('#livestrip .bar i'); if (bar && G) G.from(bar, { width: 0, duration: 1.2, ease: 'power3.inOut', delay: .6 });
    magnifier();
  }
  function magnifier() {
    var el = $('art'); if (!el) return;
    var scan = $('scan'), tip = qs('.lens-tip', el), st = { x: el.clientWidth * .5, y: el.clientHeight * .4, r: 0 };
    var put = function () { el.style.setProperty('--x', st.x + 'px'); el.style.setProperty('--y', st.y + 'px'); el.style.setProperty('--r', st.r + 'px'); };
    if (!G) { st.r = 64; st.x = el.clientWidth * .5; st.y = el.clientHeight * .2; put(); return; }
    put();
    heroT.push(G.fromTo(scan, { y: -80 }, { y: function () { return el.clientHeight + 10; }, duration: 3.4, ease: 'none', repeat: -1, repeatDelay: 1.2 }));
    var R = function () { return Math.max(52, Math.min(84, el.clientWidth * .13)); };
    var tour = G.timeline({ repeat: -1, paused: true, onUpdate: put });
    SLOTS.slice(0, Math.max(1, Math.min(6, S.items.length))).forEach(function (s) {
      tour.to(st, { x: function () { return s[0] / 520 * el.clientWidth; }, y: function () { return (s[1] - 70) / 400 * el.clientHeight; }, duration: 1.1, ease: 'power3.inOut' }).to({}, { duration: .9 });
    });
    heroT.push(tour);
    var grow = function (to) { G.to(st, { r: to, duration: .6, ease: to ? 'back.out(1.8)' : 'power2.in', onUpdate: put }); };
    heroT.push(G.delayedCall(1.1, function () { grow(R()); tour.play(); }));
    if (HOVER) {
      var qx = G.quickTo(st, 'x', { duration: .35, ease: 'power3.out', onUpdate: put }), qy = G.quickTo(st, 'y', { duration: .35, ease: 'power3.out', onUpdate: put });
      el.addEventListener('pointerenter', function () { tour.pause(); G.to(tip, { opacity: 0, duration: .3 }); grow(R() * 1.08); });
      el.addEventListener('pointermove', function (e) { var b = el.getBoundingClientRect(); qx(e.clientX - b.left); qy(e.clientY - b.top); });
      el.addEventListener('pointerleave', function () { grow(R()); tour.play(); G.to(tip, { opacity: 1, duration: .3 }); });
    }
  }

  /* ═════ views (page transitions) ═════ */
  function goView(v, push) {
    if (v === S.view) return;
    var from = $('v-' + S.view), to = $('v-' + v);
    S.view = v; U.segSet('seg-view', v, true); U.segSet('seg-view-m', v, true);
    if (push !== false) history.pushState({ v: v }, '', v === 'orders' ? '#orders' : location.pathname);
    var show = function () {
      from.hidden = true; to.hidden = false; window.scrollTo(0, 0);
      if (v === 'orders') ordersView(true); else renderStore(false);
      if (G) G.fromTo(to, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .75, ease: 'power3.inOut', clearProps: 'clipPath' });
      pill();
    };
    if (G) G.to(from, { opacity: 0, x: 24, duration: .25, ease: 'power2.in', onComplete: function () { G.set(from, { clearProps: 'opacity,transform' }); show(); } }); else show();
  }
  function renderStore(first) {
    $('v-store').innerHTML = storeHTML(); U.segMove('seg-cat', false); heroIn();
    if (first) setTimeout(grid, 450); else grid();
  }

  /* ═════ cart: counts, fly, quantities ═════ */
  function counts() {
    var L = cartList(), b = $('badge'); b.textContent = L.length; b.classList.toggle('z', !L.length); pill();
    var cn = $('cart-n'); if (cn) cn.textContent = L.length ? L.length + (L.length === 1 ? ' صنف' : ' أصناف') : '';
  }
  function bump() {
    var b = $('badge'), btn = $('cartbtn');
    if (G) G.fromTo(b, { scale: 1.7 }, { scale: 1, duration: .7, ease: 'elastic.out(1,.4)' });
    btn.classList.add('done'); clearTimeout(btn._t); btn._t = setTimeout(function () { btn.classList.remove('done'); }, 1100);
  }
  function flyFrom(src) {
    if (!G || !src) return bump();
    var target = (U.MOB() && S.view === 'store' && cartList().length) ? qs('#pill .b') : $('cartbtn');
    var a = src.getBoundingClientRect(), b = target.getBoundingClientRect();
    var f = document.createElement('div'); f.className = 'fly'; f.innerHTML = src.innerHTML.replace(/<span class="tag[\s\S]*?<\/span>/, ''); document.body.appendChild(f);
    var sx = a.left + a.width / 2 - 38, sy = a.top + a.height / 2 - 28, ex = b.left + b.width / 2 - 38, ey = b.top + b.height / 2 - 28, cx = (sx + ex) / 2, cy = Math.min(sy, ey) - 140, o = { t: 0 };
    G.set(f, { x: sx, y: sy, scale: Math.min(1.6, a.width / 76) });
    G.to(f, { scale: .3, opacity: .6, duration: .8, ease: 'power2.in' });
    G.to(o, { t: 1, duration: .8, ease: 'power2.inOut', onUpdate: function () { var t = o.t, u = 1 - t; G.set(f, { x: u * u * sx + 2 * u * t * cx + t * t * ex, y: u * u * sy + 2 * u * t * cy + t * t * ey, rotate: t * -20 }); }, onComplete: function () { f.remove(); bump(); } });
  }
  function setQty(id, q, o) {
    o = o || {}; var it = itemById(id); if (!it) return; var prev = S.cart[id] || 0;
    q = Math.max(0, Math.min(capOf(it), Math.floor(Number(q) || 0)));
    if (q > 0) S.cart[id] = q; else delete S.cart[id];
    saveCart();
    if (o.typing) { var el = qs('.pc[data-id="' + id + '"]'); if (el) el.classList.toggle('in', q > 0); } else refreshCard(id, (prev > 0) !== (q > 0));
    counts();
    if ($('cart').classList.contains('on') && !o.fromCart) cartBody();
    if (q > prev && !o.typing && o.src) flyFrom(o.src);
  }
  function pill() {
    var p = $('pill'), L = cartList(), on = L.length > 0 && S.view === 'store' && U.MOB();
    $('pill-t').textContent = L.length + (L.length === 1 ? ' صنف في السلة' : ' أصناف في السلة');
    $('pill-s').textContent = L.slice(0, 3).map(function (x) { return x.it.name; }).join('، ') + (L.length > 3 ? '…' : '');
    if (p._on === on) return; p._on = on;
    if (G) G.to(p, { y: on ? '0%' : '170%', duration: on ? .6 : .35, ease: on ? 'back.out(1.4)' : 'power2.in' }); else p.style.transform = on ? 'none' : '';
  }

  /* ═════ quick view ═════ */
  var QV = { id: null, q: 1 };
  function openQV(id) {
    var it = itemById(id); if (!it) return; var cap = capOf(it), st = stateOf(it), inCart = S.cart[id] || 0;
    QV.id = it.id; QV.q = inCart || (cap > 0 ? 1 : 0);
    $('qv-body').innerHTML = '<div class="qv"><div class="qv-art drag">' + A.thumb(it) + '<div class="scan" id="qv-scan" style="opacity:0;height:90px"></div></div>' +
      '<div class="qv-b"><button class="ib bd qv-x rp" type="button" data-close aria-label="قفل">' + I(ICO.x) + '</button>' +
        '<span class="pc-cat">' + esc(it.category) + ' · ' + esc(it.unit) + '</span><h2>' + esc(it.name) + '</h2>' + (it.description ? '<p>' + esc(it.description) + '</p>' : '') +
        '<div class="meter"><div class="meter-r"><span class="tag ' + st[0] + '"><i></i>' + st[1] + '</span><span id="qv-mt"></span></div><div class="meter-t"><i id="qv-bar"></i></div>' +
          (it.max_per_order > 0 ? '<div class="meter-r"><span>أقصى كمية في الطلب الواحد</span><b class="n">' + n(it.max_per_order) + ' ' + esc(it.unit) + '</b></div>' : '') + '</div>' +
        '<div class="qv-q">' + (cap > 0 ? '<div class="stp lt"><button type="button" class="rp" data-qvinc="1" aria-label="زوّد">' + I(ICO.plus) + '</button><input class="n" id="qv-in" inputmode="numeric" value="' + QV.q + '" aria-label="الكمية"><button type="button" class="rp" data-qvinc="-1" aria-label="قلّل">' + I(ICO.minus) + '</button></div>' +
          '<button class="b lg rp" type="button" id="qv-add">' + U.morphIcon() + '<span>' + (inCart ? 'حدّث الكمية' : 'أضف للسلة') + '</span></button>' : '<button class="b lg w" type="button" disabled>خلص — هيتوفر قريب</button>') + '</div></div></div>';
    U.openPanel('qv', function () {
      qvMeter(false); if (!G) return;
      G.fromTo(qs('.qv-art > svg, .qv-art > img', $('qv')), { scale: .7, y: 30, opacity: 0, rotate: -6 }, { scale: 1, y: 0, opacity: 1, rotate: 0, duration: .8, ease: 'back.out(1.6)', delay: .1 });
      G.fromTo('#qv-scan', { y: -90, opacity: 1 }, { y: function () { return qs('.qv-art', $('qv')).clientHeight; }, duration: 1.3, ease: 'power1.inOut', delay: .35, onComplete: function () { G.set('#qv-scan', { opacity: 0 }); } });
      G.from(qa('.qv-b > *:not(.qv-x)', $('qv')), { opacity: 0, y: 14, duration: .5, ease: 'power3.out', stagger: .05, delay: .15 });
    });
  }
  function qvMeter(anim) {
    var it = itemById(QV.id), b = $('qv-bar'); if (!it || !b) return; var cap = capOf(it), p = cap ? Math.min(100, QV.q / cap * 100) : 0;
    $('qv-mt').innerHTML = 'هتطلب <b class="n">' + n(QV.q) + '</b> من <b class="n">' + n(it.available_qty) + '</b> متاح';
    if (G) G.to(b, { width: p + '%', duration: anim ? .45 : .9, ease: 'power3.out', delay: anim ? 0 : .3 }); else b.style.width = p + '%';
  }
  function qvAdd() {
    if (!(QV.q > 0)) return; var btn = $('qv-add'), src = qs('.qv-art', $('qv'));
    setQty(QV.id, QV.q); qs('span', btn).textContent = 'اتضاف للسلة';
    if (G) { G.to(qs('.mph', btn), { attr: { d: U.D_CHECK }, duration: .35, ease: 'power2.out' }); G.fromTo(btn, { scale: .96 }, { scale: 1, duration: .5, ease: 'elastic.out(1,.5)' }); setTimeout(function () { U.closePanel('qv'); flyFrom(src); }, 520); }
    else { U.closePanel('qv'); bump(); }
  }

  /* ═════ cart panel ═════ */
  function cartBody() {
    var L = cartList(), body = $('cart-body'), foot = $('cart-foot'); counts();
    if (!L.length) { body.innerHTML = '<div class="ce">' + A.svg('box') + '<b>السلة فاضية</b>اختار الأصناف من المتجر وهتلاقيها هنا</div>'; foot.innerHTML = '<div class="pn-foot"><button class="b g rp" type="button" data-close>رجوع للمتجر</button></div>'; return; }
    var f = function (k, lbl, attrs) { return '<div class="f"><label for="cf-' + k + '">' + lbl + '</label><input class="fld" id="cf-' + k + '" data-f="' + k + '" value="' + esc(ME[k] != null ? ME[k] : (k === 'manager_name' ? S.center.manager_name : k === 'phone' ? S.center.phone : '') || '') + '" ' + (attrs || '') + '></div>'; };
    body.innerHTML = L.map(function (x) {
      var cap = capOf(x.it);
      return '<div class="ci" data-id="' + x.it.id + '"><div class="ci-art">' + A.thumb(x.it) + '</div><div class="ci-t"><b>' + esc(x.it.name) + '</b><small>' + esc(x.it.unit) + ' · متاح <span class="n">' + n(x.it.available_qty) + '</span></small></div>' +
        '<div class="stp lt"><button type="button" class="rp" data-cinc="1" aria-label="زوّد"' + (x.q >= cap ? ' disabled' : '') + '>' + I(ICO.plus) + '</button><input class="n" inputmode="numeric" data-cqty value="' + x.q + '" aria-label="الكمية"><button type="button" class="rp" data-cinc="-1" aria-label="' + (x.q <= 1 ? 'شيل' : 'قلّل') + '">' + I(x.q <= 1 ? ICO.trash : ICO.minus) + '</button></div></div>';
    }).join('') +
      '<div class="cf"><div class="f"><label>أولوية الطلب</label>' + U.seg('seg-prio', [['normal', 'عادي'], ['urgent', 'مستعجل'], ['emergency', 'طارئ']], S.prio) + '</div>' +
        '<div class="g2">' + f('manager_name', 'اسمك', 'autocomplete="name"') + f('phone', 'موبايل', 'inputmode="tel" autocomplete="tel" dir="ltr"') + '</div>' +
        '<div class="f"><label for="cf-notes">ملاحظة للمخزن</label><textarea class="fld" id="cf-notes" data-f="notes" placeholder="مثلاً: التسليم لمسؤول المخزن قبل 5 المغرب">' + esc(ME.notes || '') + '</textarea></div>' +
        '<div class="cf-err" id="cf-err" role="alert"></div></div>';
    foot.innerHTML = '<div class="pn-foot"><button class="b lg rp" type="button" id="send">' + I(ICO.send) + '<span>ابعت الطلب · <span class="n">' + L.length + '</span> ' + (L.length === 1 ? 'صنف' : 'أصناف') + '</span></button></div>';
    requestAnimationFrame(function () { U.segMove('seg-prio', false); });
  }
  function openCart() { cartBody(); U.openPanel('cart', function () { U.segMove('seg-prio', false); if (G) G.from(qa('#cart-body > *'), { opacity: 0, x: -24, duration: .5, ease: 'power3.out', stagger: .05, delay: .15 }); }); }

  function send() {
    if (S.sending) return; var L = cartList(); if (!L.length) return;
    var v = {}; qa('#cart [data-f]').forEach(function (el) { v[el.dataset.f] = el.value.trim(); });
    ME = { manager_name: v.manager_name, phone: v.phone, notes: v.notes }; LS.set('qr_me_' + CODE, ME);
    S.sending = true; var btn = $('send'); btn.disabled = true; qs('span', btn).textContent = 'بيتبعت…'; var t0 = Date.now();
    U.api('POST', API + '/orders', { items: L.map(function (x) { return { supply_id: x.it.id, quantity: x.q }; }), manager_name: v.manager_name, phone: v.phone, notes: v.notes, priority: S.prio })
      .then(function (j) { S.items = j.supplies || S.items; setTimeout(function () { sent(j.order); }, Math.max(0, 500 - (Date.now() - t0))); })
      .catch(function (e) {
        S.sending = false; var b2 = $('send'); if (b2) { b2.disabled = false; qs('span', b2).textContent = 'جرّب تاني'; }
        var er = $('cf-err'); if (er) er.textContent = e.message;
        if (e.status === 409) U.api('GET', API + '?silent=1').then(function (j) { S.items = j.supplies; Object.keys(S.cart).forEach(function (id) { var it = itemById(id); if (!it) delete S.cart[id]; else if (S.cart[id] > capOf(it)) S.cart[id] = capOf(it); }); saveCart(); grid(); });
      });
  }
  var D_BOX = 'M60 34 C90 34 90 34 90 64 C90 94 90 94 60 94 C30 94 30 94 30 64 C30 34 30 34 60 34 Z';
  var D_RING = 'M60 20 C83.2 20 102 38.8 102 62 C102 85.2 83.2 104 60 104 C36.8 104 18 85.2 18 62 C18 38.8 36.8 20 60 20 Z';
  function sent(o) {
    S.sending = false; S.cart = {}; saveCart(); ME.notes = ''; LS.set('qr_me_' + CODE, ME); S.prio = 'normal';
    upsert(o); S.seen[o.id] = o.status; S.fresh = o.id;
    $('cart-body').innerHTML = '<div class="okv"><svg viewBox="0 0 120 120" aria-hidden="true"><path class="mo" id="ok-mo" d="' + D_BOX + '"/><rect class="tp" id="ok-tp" x="56" y="34" width="8" height="60"/><path class="ck" id="ok-ck" d="M40 63 L54 77 L82 47"/></svg>' +
      '<h3 class="okt">طلبك وصل المخزن</h3><div class="no okt">رقم الطلب<b class="n">' + esc(o.order_code) + '</b></div><p class="okt">هيتعتمد ويتجهز، وكل خطوة هتظهرلك في «طلباتي» لحد ما يوصل المركز</p>' +
      '<div class="oka okt"><button class="b lg rp" type="button" data-go-orders>' + I(ICO.list) + 'تابع الطلب</button><button class="b g lg rp" type="button" data-close>رجوع للمتجر</button></div></div>';
    $('cart-foot').innerHTML = ''; counts(); grid(); viewCount(); liveRefresh();
    var ck = $('ok-ck'), len = ck.getTotalLength ? ck.getTotalLength() : 60; ck.style.strokeDasharray = len; ck.style.strokeDashoffset = len;
    if (!G) { $('ok-mo').setAttribute('d', D_RING); $('ok-tp').style.opacity = 0; ck.style.strokeDashoffset = 0; return; }
    G.timeline().from('#ok-mo,#ok-tp', { y: -40, opacity: 0, duration: .5, ease: 'back.out(1.8)' })
      .to('#ok-mo', { rotate: 6, duration: .12, yoyo: true, repeat: 3, transformOrigin: '50% 100%', ease: 'sine.inOut' })
      .to('#ok-tp', { opacity: 0, scaleY: 0, transformOrigin: '50% 50%', duration: .3, ease: 'power2.in' }, '+=.05')
      .to('#ok-mo', { attr: { d: D_RING }, duration: .7, ease: 'power3.inOut' }, '<')
      .to(ck, { strokeDashoffset: 0, duration: .45, ease: 'power2.out' }, '-=.15')
      .from(qa('.okt'), { opacity: 0, y: 16, duration: .5, ease: 'power3.out', stagger: .08 }, '-=.2');
  }

  /* ═════ orders ═════ */
  function upsert(o) { var i = S.orders.findIndex(function (x) { return x.id === o.id; }); if (i >= 0) S.orders[i] = o; else S.orders.unshift(o); S.orders.sort(function (a, b) { return b.id - a.id; }); }
  function orderCard(o) {
    var pr = U.PRIO[o.priority] || U.PRIO.normal;
    return '<article class="oc rv' + (S.fresh === o.id ? ' fresh' : '') + '" data-o="' + o.id + '">' +
      '<div class="oc-h"><div>' + (live(o) ? '<span class="tag live ' + U.TONE[o.status] + '"><i></i>بيتحدث لوحده</span> ' : '') + (o.priority !== 'normal' ? '<span class="tag ' + pr[1] + '">' + pr[0] + '</span>' : '') +
        '<b class="' + o.status + '">' + esc(U.HEAD[o.status] || o.status) + '</b><small>' + esc(U.when(o.created_at)) + (o.manager_name ? ' · ' + esc(o.manager_name) : '') + '</small></div>' +
        '<div class="oc-no">طلب<b class="n">' + esc(o.order_code) + '</b></div></div>' +
      U.routeHTML(o.status) +
      (o.status === 'dispatched' && (o.driver_name || o.eta_minutes) ? '<div class="drv"><span class="av">' + I(ICO.truck) + '</span><div><b>' + esc(o.driver_name || 'المندوب') + '</b><small>' + (o.eta_minutes ? 'الوصول خلال ' + o.eta_minutes + ' دقيقة تقريبًا' : 'في الطريق ليكم') + '</small></div>' + (o.driver_phone ? '<a class="b sm g rp" href="tel:' + esc(o.driver_phone) + '">' + I(ICO.phone) + 'اتصل</a>' : '') + '</div>' : '') +
      '<div class="oc-i">' + o.items.map(function (x) { var it = itemById(x.supply_id) || { name: x.supply_name, category: x.category }; return '<span><i>' + A.thumb(it) + '</i><b class="n">' + n(x.quantity) + '</b> ' + esc(x.unit + ' ' + x.supply_name) + '</span>'; }).join('') + '</div>' +
      (o.admin_note ? '<div class="rp-note">' + I(ICO.msg) + '<div><small>رد المخزن</small>' + esc(o.admin_note) + '</div></div>' : '') +
      (o.notes ? '<div class="pc-cat">ملاحظتك: ' + esc(o.notes) + '</div>' : '') +
      '<div><button class="oc-more rp" type="button" data-tl>' + I(ICO.back) + 'كل الخطوات</button><div class="oc-tl" hidden>' + U.timelineHTML(o.stage_log) + '</div></div></article>';
  }
  function ordersView(enter) {
    var v = $('v-orders'), list = S.orders;
    var F = { all: ['كلها', function () { return true; }], live: ['الشغالة', live], done: ['اتسلّمت', function (o) { return o.status === 'delivered'; }] };
    var shown = list.filter(F[S.of][1]);
    var old = {}; qa('.oc', v).forEach(function (el) { var r = qs('.route', el); old[el.dataset.o] = r ? Number(r.dataset.p) : null; });
    var openTl = {}; qa('.oc', v).forEach(function (el) { if (!qs('.oc-tl', el).hidden) openTl[el.dataset.o] = 1; });
    v.innerHTML = '<div class="ovh"><div><h1>طلباتي</h1><p>' + (list.length ? 'كل طلب ليه مسار، والحالة بتتغير لوحدها أول ما المخزن يحدّثها' : 'هنا هتتابع كل طلب لحد ما يوصل المركز') + '</p></div>' +
      (list.length ? U.seg('seg-of', Object.keys(F).map(function (k) { return [k, F[k][0], list.filter(F[k][1]).length]; }), S.of) : '') + '</div>' +
      (shown.length ? '<div class="ol">' + shown.map(orderCard).join('') + '</div>' : '<div class="empty">' + A.svg('box') + '<b>' + (list.length ? 'مفيش طلبات هنا' : 'لسه مفيش طلبات') + '</b>' + (list.length ? '' : 'اختار الأصناف من المتجر وابعت أول طلب') + '<div><button class="b lg rp" type="button" data-view-store>' + I(ICO.store) + 'افتح المتجر</button></div></div>');
    U.segMove('seg-of', false);
    Object.keys(openTl).forEach(function (id) { var el = qs('.oc[data-o="' + id + '"]', v); if (el) { qs('.oc-tl', el).hidden = false; qs('[data-tl]', el).classList.add('open'); } });
    var cards = qa('.oc', v);
    if (!G) { cards.forEach(function (c) { c.classList.remove('rv'); }); return; }
    if (enter) {
      G.from(qa('.ovh > *', v), { opacity: 0, y: 16, duration: .6, ease: 'power3.out', stagger: .08, delay: .2 });
      G.to(cards, { opacity: 1, y: 0, duration: .7, ease: 'power3.out', stagger: .08, delay: .3, onComplete: function () { cards.forEach(function (c) { c.classList.remove('rv'); G.set(c, { clearProps: 'transform,opacity' }); }); } });
      cards.forEach(function (c, i) { U.routeGrow(qs('.route', c), 0, .4 + i * .08); });
      var e = qs('.empty', v); if (e) G.from(e, { opacity: 0, y: 20, duration: .6, ease: 'power3.out', delay: .3 });
    } else cards.forEach(function (c) { c.classList.remove('rv'); var was = old[c.dataset.o], r = qs('.route', c); if (was != null && was !== Number(r.dataset.p)) U.routeGrow(r, was, 0); });
  }
  function viewCount() {
    var open = S.orders.filter(live).length;
    qa('#seg-view [data-v="orders"] .k, #seg-view-m [data-v="orders"] .k').forEach(function (k) { k.textContent = open || S.orders.length; });
    U.segMove('seg-view', false); U.segMove('seg-view-m', false);
  }
  function liveRefresh() { var w = $('livewrap'); if (!w) return; var had = w.innerHTML; w.innerHTML = liveStrip(); if (G && w.firstChild && !had) G.from(w.firstChild, { opacity: 0, y: -10, duration: .5, ease: 'back.out(1.6)' }); }

  /* ═════ live updates (SSE, with a polling fallback) ═════ */
  function onOrder(o) {
    var prev = S.seen[o.id]; upsert(o); S.seen[o.id] = o.status;
    if (prev && prev !== o.status) U.toast('طلب ' + o.order_code + ': ' + U.HEAD[o.status]);
    viewCount(); liveRefresh(); if (S.view === 'orders') ordersView(false);
  }
  function onSupplies(list) {
    S.items = list; var ae = document.activeElement;
    if (S.view === 'store' && !(ae && ae.matches && ae.matches('[data-qty]'))) { grid(); var c = $('seg-cat'); if (c && c.children.length - 1 !== cats().length) { c.outerHTML = U.seg('seg-cat', cats(), S.cat); U.segMove('seg-cat', false); } }
  }
  function connect() {
    if (!window.EventSource) return poll();
    var es = new EventSource(API + '/events'), last = Date.now();
    es.addEventListener('order:updated', function (e) { last = Date.now(); onOrder(JSON.parse(e.data).order); });
    es.addEventListener('order:deleted', function (e) { var id = JSON.parse(e.data).id; S.orders = S.orders.filter(function (o) { return o.id !== id; }); viewCount(); liveRefresh(); if (S.view === 'orders') ordersView(false); });
    es.addEventListener('supplies', function (e) { last = Date.now(); onSupplies(JSON.parse(e.data).supplies); });
    es.addEventListener('connected', function () { last = Date.now(); });
    es.onerror = function () { last = 0; };
    setInterval(function () { if (!document.hidden && Date.now() - last > 60000) refresh(); }, 30000);
  }
  function poll() { setInterval(function () { if (!document.hidden) refresh(); }, 20000); }
  function refresh() {
    U.api('GET', API + '?silent=1').then(function (j) {
      j.orders.forEach(function (o) { var p = S.seen[o.id]; if (p && p !== o.status) U.toast('طلب ' + o.order_code + ': ' + U.HEAD[o.status]); S.seen[o.id] = o.status; });
      S.orders = j.orders; viewCount(); liveRefresh(); if (S.view === 'orders') ordersView(false); onSupplies(j.supplies);
    }).catch(function () {});
  }

  /* ═════ events ═════ */
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target, b = t.closest('button,a');
      if (b) {
        var sg = b.closest('.seg');
        if (sg && b.dataset.v) {
          if (sg.id === 'seg-view' || sg.id === 'seg-view-m') return goView(b.dataset.v);
          if (sg.id === 'seg-cat') { if (S.cat === b.dataset.v) return; S.cat = b.dataset.v; U.segSet(sg, S.cat, true); return swapGrid(); }
          if (sg.id === 'seg-of') { S.of = b.dataset.v; U.segSet(sg, S.of, true); return setTimeout(function () { ordersView(true); }, 120); }
          if (sg.id === 'seg-prio') { S.prio = b.dataset.v; return U.segSet(sg, S.prio, true); }
        }
        if (b.id === 'cartbtn' || b.hasAttribute('data-open-cart')) return openCart();
        if (b.id === 'thm') return U.toggleTheme(b);
        if (b.hasAttribute('data-go-grid')) return window.scrollTo({ top: $('sbar').getBoundingClientRect().top + scrollY - (U.MOB() ? 116 : 70), behavior: G ? 'smooth' : 'auto' });
        if (b.hasAttribute('data-go-orders')) return U.closePanel('cart', function () { goView('orders'); });
        if (b.hasAttribute('data-view-store')) return goView('store');
        if (b.getAttribute('href') === '#orders') { e.preventDefault(); return goView('orders'); }
        if (b.id === 'qv-add') return qvAdd();
        if (b.dataset.qvinc) { var it0 = itemById(QV.id); QV.q = Math.max(1, Math.min(capOf(it0), (Number(QV.q) || 0) + Number(b.dataset.qvinc))); $('qv-in').value = QV.q; return qvMeter(true); }
        if (b.id === 'send') return send();
        if (b.hasAttribute('data-tl')) { var box = b.nextElementSibling, open = box.hidden; box.hidden = !open; b.classList.toggle('open', open); if (open && G) { G.from(box, { height: 0, opacity: 0, duration: .45, ease: 'power3.out', clearProps: 'height,opacity' }); G.from(qa('.tl-i', box), { opacity: 0, x: -12, duration: .4, stagger: .05, ease: 'power3.out' }); } return; }
        var ci = b.closest('.ci');
        if (ci && b.dataset.cinc) {
          var id2 = Number(ci.dataset.id), nq = (S.cart[id2] || 0) + Number(b.dataset.cinc);
          if (nq <= 0 && G) return G.to(ci, { opacity: 0, x: -40, height: 0, paddingTop: 0, paddingBottom: 0, duration: .35, ease: 'power2.in', onComplete: function () { setQty(id2, 0, { fromCart: true }); cartBody(); } });
          setQty(id2, nq, { fromCart: true }); return cartBody();
        }
        var pc = b.closest('.pc');
        if (pc) { var id = Number(pc.dataset.id); if (b.hasAttribute('data-add')) return setQty(id, 1, { src: qs('.pc-art', pc) }); if (b.dataset.inc) return setQty(id, (S.cart[id] || 0) + Number(b.dataset.inc)); }
        return;
      }
      var card = t.closest('.pc'); if (card && !t.closest('input')) openQV(card.dataset.id);
    });
    document.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('pc')) { e.preventDefault(); openQV(e.target.dataset.id); } });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.id === 'q') { S.q = el.value; clearTimeout(el._t); el._t = setTimeout(grid, 160); return; }
      if (el.hasAttribute('data-qty')) return setQty(Number(el.closest('.pc').dataset.id), el.value.replace(/\D/g, ''), { typing: true });
      if (el.hasAttribute('data-cqty')) return setQty(Number(el.closest('.ci').dataset.id), el.value.replace(/\D/g, ''), { typing: true, fromCart: true });
      if (el.id === 'qv-in') { var it = itemById(QV.id); QV.q = Math.max(0, Math.min(capOf(it), Number(el.value.replace(/\D/g, '')) || 0)); return qvMeter(true); }
      if (el.dataset.f) { ME[el.dataset.f] = el.value; LS.set('qr_me_' + CODE, ME); }
    });
    document.addEventListener('change', function (e) {
      var el = e.target, pc = el.closest && el.closest('.pc');
      if (pc && el.hasAttribute('data-qty')) { var id = Number(pc.dataset.id), it = itemById(id), v = Number(el.value.replace(/\D/g, '')) || 0; if (it && v > capOf(it)) U.toast('أقصى كمية من ' + it.name + ': ' + n(capOf(it))); refreshCard(id, !S.cart[id]); }
      if (el.hasAttribute && el.hasAttribute('data-cqty')) cartBody();
      if (el.id === 'qv-in') el.value = QV.q;
    });
    window.addEventListener('scroll', function () { $('top').classList.toggle('sc', scrollY > 4); }, { passive: true });
    window.addEventListener('resize', pill);
    window.addEventListener('popstate', function () { goView(location.hash === '#orders' ? 'orders' : 'store', false); });
    U.sheetDrag('cart'); U.sheetDrag('qv');
  }

  /* ═════ boot ═════ */
  if (!CODE) return directory();
  $('app').innerHTML = '<main class="main" style="padding-top:40px"><div class="grid">' + skel(8) + '</div></main>';
  U.api('GET', API).catch(function (e) {
    $('app').innerHTML = '<main class="main"><div class="dir"><div class="empty">' + A.svg('box') + '<b>' + esc(e.message) + '</b>امسح الكود تاني أو كلّم المورد</div></div></main>';
    throw e;
  }).then(function (j) {
    S.center = j.center; S.items = j.supplies; S.orders = j.orders; S.brand = j.settings || {};
    S.orders.forEach(function (o) { S.seen[o.id] = o.status; });
    Object.keys(S.cart).forEach(function (id) { var it = itemById(id); if (!it) delete S.cart[id]; else if (S.cart[id] > capOf(it)) S.cart[id] = capOf(it); }); saveCart();
    shell(); bind(); renderStore(true); counts(); viewCount();
    requestAnimationFrame(function () { U.segMove('seg-view', false); U.segMove('seg-view-m', false); U.segMove('seg-cat', false); });
    if (G) { G.from('.top', { y: -20, opacity: 0, duration: .6, ease: 'power3.out' }); G.set('#pill', { y: '170%' }); }
    if (location.hash === '#orders') setTimeout(function () { goView('orders', false); }, 300);
    connect();
  }).catch(function (e) { if (!e.status) console.error(e); });
})();
