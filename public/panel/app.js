/* ════════════════════════════════════════════════════════════════════
   إمداد QR · لوحة التحكم
   Sections: الرئيسية · الطلبات · الأصناف · المراكز · الإعدادات (one nav, no
   duplicate tabs). Live over SSE. Motion: animated nav indicator (segmented
   control), Skeleton Shimmer, Fade In Up + Stagger, Scroll Reveal, Hover Lift,
   Ripple, Spring Scale, count-up, drawn chart, route glide, panels.
════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var U = window.UI, A = window.ART, G = U.G, esc = U.esc, n = U.n, $ = U.$, qs = U.qs, qa = U.qa, I = U.I, ICO = U.ICO;
  var S = { sec: 'home', d: null, of: 'all', ocenter: 'all', oq: '', sel: null, cf: 'all', cq: '', range: '7d', live: false };
  var NAV = [['home', 'الرئيسية', ICO.home], ['orders', 'الطلبات', ICO.truck], ['catalog', 'الأصناف', ICO.box], ['centers', 'المراكز', ICO.qr], ['settings', 'الإعدادات', ICO.gear]];
  var OF = [['all', 'الكل'], ['pending', 'جديدة'], ['approved', 'معتمدة'], ['preparing', 'بتتجهز'], ['dispatched', 'في الطريق'], ['delivered', 'اتسلّمت'], ['rejected', 'اتلغت']];

  function stockState(s) { if (s.available_qty <= 0) return ['bad', 'خلص']; if (s.available_qty <= s.min_stock) return ['warn', 'قرب يخلص']; return ['ok', 'متاح']; }
  function center(id) { return (S.d.centers || []).find(function (c) { return c.id === id; }); }
  function supply(id) { return (S.d.supplies || []).find(function (s) { return s.id === id; }); }
  function itemArt(x) { return A.thumb(supply(x.supply_id) || { name: x.supply_name, category: x.category }); }
  function openOrders() { return S.d.orders.filter(function (o) { return o.status !== 'delivered' && o.status !== 'rejected'; }); }

  /* ═════ login ═════ */
  function login() {
    $('app').innerHTML = '<div class="login"><form class="lg-card" id="lg"><div class="lg-art">' + A.svg('box') + '</div><h1>لوحة التحكم</h1><p>إمداد QR — اكتب كلمة السر</p>' +
      '<div class="f"><label for="pw">كلمة السر</label><input class="fld" id="pw" type="password" autocomplete="current-password" required></div><div class="lg-err" id="lg-err" role="alert"></div>' +
      '<button class="b lg w rp" type="submit">دخول</button></form></div>';
    if (G) { G.from('.lg-card', { y: 30, opacity: 0, scale: .96, duration: .7, ease: 'back.out(1.4)' }); G.from('.lg-art svg', { y: -30, opacity: 0, duration: .8, ease: 'bounce.out', delay: .2 }); }
    setTimeout(function () { $('pw').focus(); }, 100);
    $('lg').addEventListener('submit', function (e) {
      e.preventDefault(); var btn = qs('#lg button'); btn.disabled = true;
      U.api('POST', '/api/login', { password: $('pw').value }).then(function () {
        if (G) G.to('.lg-card', { scale: .96, opacity: 0, y: -20, duration: .3, ease: 'power2.in', onComplete: boot }); else boot();
      }).catch(function (er) { btn.disabled = false; $('lg-err').textContent = er.message; if (G) G.fromTo('.lg-card', { x: -10 }, { x: 0, duration: .6, ease: 'elastic.out(1,.3)' }); $('pw').select(); });
    });
  }

  /* ═════ shell ═════ */
  function shell() {
    var st = S.d.settings;
    $('app').innerHTML = '<div class="shell"><aside class="side"><div class="brand"><span class="mk">' + I(ICO.box) + '</span><div><b id="bn">' + esc(st.brand_name) + '</b><small id="bs">' + esc(st.brand_subtitle) + '</small></div></div>' +
      '<nav class="nav" id="nav"><i class="nav-ind"></i>' + NAV.map(function (x) { return '<button type="button" class="rp" data-sec="' + x[0] + '">' + I(x[2]) + x[1] + '<span class="c n" data-c="' + x[0] + '" hidden></span></button>'; }).join('') + '</nav>' +
      '<div class="side-f"><div class="conn" id="conn"><i></i><span>بيتصل…</span></div><div class="side-a"><button class="ib thm rp" id="thm" type="button">' + U.thmSVG() + '</button><a class="ib rp" href="/center" target="_blank" rel="noopener" title="صفحة المراكز العامة">' + I(ICO.open) + '</a><button class="ib rp" id="logout" type="button" title="خروج">' + I(ICO.logout) + '</button></div></div></aside>' +
      '<main class="main"><div class="mtop"><div class="brand"><span class="mk">' + I(ICO.box) + '</span><div><b>' + esc(st.brand_name) + '</b></div></div><button class="ib thm rp" id="thm2" type="button">' + U.thmSVG() + '</button><button class="ib rp" id="logout2" type="button" aria-label="خروج">' + I(ICO.logout) + '</button></div><div id="sec"></div></main></div>' +
      '<nav class="bnav" id="bnav">' + NAV.map(function (x) { return '<button type="button" data-sec="' + x[0] + '">' + I(x[2]) + x[1] + '<span class="c n" data-c="' + x[0] + '" hidden></span></button>'; }).join('') + '</nav>' +
      U.panelHTML('pn-supply', 'modal', 'صنف', 720) + U.panelHTML('pn-center', 'modal', 'مركز', 560) + U.panelHTML('pn-qr', 'modal', 'باركود المركز', 460) + U.panelHTML('pn-order', 'drawer', 'الطلب');
    U.themeIcon($('thm'), false); U.themeIcon($('thm2'), false);
    ['pn-supply', 'pn-center', 'pn-qr', 'pn-order'].forEach(U.sheetDrag);
  }
  function navMove(anim) {
    var nav = $('nav'), b = qs('button[data-sec="' + S.sec + '"]', nav), ind = qs('.nav-ind', nav); if (!b) return;
    qa('button', nav).forEach(function (x) { x.classList.toggle('on', x === b); }); qa('#bnav button').forEach(function (x) { x.classList.toggle('on', x.dataset.sec === S.sec); });
    if (G && anim) G.to(ind, { y: b.offsetTop, duration: .5, ease: 'back.out(1.4)' }); else if (G) G.set(ind, { y: b.offsetTop }); else ind.style.transform = 'translateY(' + b.offsetTop + 'px)';
  }
  function badges() {
    var st = S.d.stats, set = function (k, v, warn) { qa('[data-c="' + k + '"]').forEach(function (c) { c.hidden = !v; c.textContent = v > 99 ? '99+' : v; c.classList.toggle('w', !!warn); }); };
    set('orders', st.pendingCount); set('catalog', st.lowStockCount + st.outOfStockCount, true);
    document.title = (st.pendingCount ? '(' + st.pendingCount + ') ' : '') + 'لوحة التحكم · ' + S.d.settings.brand_name;
  }
  function go(sec, anim) {
    if (S.sec === sec && $('sec').childElementCount) return;
    S.sec = sec; navMove(anim !== false); history.replaceState(null, '', sec === 'home' ? '/' : '/#' + sec);
    var el = $('sec');
    var paint = function () { render(true); window.scrollTo(0, 0); };
    if (G && el.childElementCount) G.to(el, { opacity: 0, y: 8, duration: .16, ease: 'power2.in', onComplete: function () { paint(); G.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .35, ease: 'power3.out', clearProps: 'opacity,transform' }); } });
    else paint();
  }
  function render(anim) {
    var f = { home: home, orders: ordersSec, catalog: catalog, centers: centersSec, settings: settings }[S.sec] || home;
    f(anim); badges();
  }
  function ph(title, sub, actions) { return '<div class="ph"><div><h1>' + title + '</h1><p>' + sub + '</p></div><div class="ph-a">' + (actions || '') + '</div></div>'; }

  /* ═════ الرئيسية ═════ */
  function home(anim) {
    var st = S.d.stats, an = S.d.analytics, pend = S.d.orders.filter(function (o) { return o.status === 'pending'; }).slice(0, 5);
    var low = S.d.supplies.filter(function (s) { return s.available_qty <= s.min_stock; }).sort(function (a, b) { return a.available_qty - b.available_qty; }).slice(0, 6);
    var dScan = st.scansToday - st.scansYesterday;
    var today = new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
    $('sec').innerHTML = ph(esc(today), st.activeMissions ? st.activeMissions + ' طلب شغال دلوقتي · ' + st.pendingCount + ' مستني الاعتماد' : 'مفيش طلبات شغالة دلوقتي', '<button class="b g rp" type="button" data-qr="all">' + I(ICO.qr) + 'الكود العام</button><button class="b rp" type="button" data-new-supply>' + I(ICO.plus) + 'صنف جديد</button>') +
      '<div class="kpis">' +
        kpi('orders:pending', 'طلبات مستنية الاعتماد', st.pendingCount, st.ordersToday + ' طلب النهارده', ICO.send, st.pendingCount > 0) +
        kpi('orders:all', 'طلبات شغالة', st.activeMissions, st.preparingCount + ' بتتجهز · ' + st.dispatchedCount + ' في الطريق', ICO.truck) +
        kpi('catalog:low', 'أصناف قربت تخلص', st.lowStockCount + st.outOfStockCount, st.outOfStockCount + ' خلصت خالص', ICO.alert, st.outOfStockCount > 0) +
        kpi('centers', 'مسح الكود النهارده', st.scansToday, (dScan === 0 ? 'زي امبارح' : (dScan > 0 ? '+' : '') + dScan + ' عن امبارح'), ICO.qr) +
      '</div>' +
      '<div class="ov"><section class="card"><div class="card-h"><div><h2>الطلبات ومسح الأكواد</h2><div class="legend"><span><i></i>طلبات</span><span><i class="s"></i>مسح الكود</span></div></div>' + U.seg('seg-range', [['7d', '7 أيام'], ['14d', '14 يوم'], ['30d', '30 يوم']], S.range, 'sm') + '</div><div class="chart" id="chart"></div></section>' +
        '<section class="card"><div class="card-h"><h2>محتاج تتصرف</h2><small>' + (pend.length ? pend.length + ' طلب جديد' : '') + '</small></div><div class="todo">' +
          (pend.length ? pend.map(function (o) { return '<div class="todo-i rp" data-open-order="' + o.id + '"><span class="t">' + itemArt(o.items[0] || {}) + '</span><span style="min-width:0"><b>' + esc(o.center_name) + '</b><small>' + esc(o.order_code) + ' · ' + o.total_items + ' أصناف · ' + esc(U.ago(o.created_at)) + '</small></span><button class="b sm rp" type="button" data-step="' + o.id + ':approved">اعتمد</button></div>'; }).join('')
            : '<div class="empty" style="padding:28px 12px"><b>مفيش طلبات مستنياك</b>أول ما مركز يطلب هيظهر هنا وهيوصلك تنبيه</div>') + '</div></section></div>' +
      '<div class="ov2"><section class="card"><div class="card-h"><h2>أكتر المراكز طلبًا</h2><small>آخر ' + an.series.length + ' يوم</small></div><div class="rank" id="rank-c">' + rankCenters(an.topCenters) + '</div></section>' +
        '<section class="card"><div class="card-h"><h2>مخزون محتاج توريد</h2><button class="b g sm rp" type="button" data-sec-go="catalog">كل الأصناف</button></div><div class="rank">' +
          (low.length ? low.map(function (s) { var stt = stockState(s); return '<div class="rank-i"><b>' + esc(s.name) + '</b><span class="n">' + n(s.available_qty) + ' / ' + n(s.min_stock) + ' ' + esc(s.unit) + '</span><span class="bar ' + (stt[0] === 'bad' ? 'out' : 'low') + '"><i data-w="' + Math.min(100, s.min_stock ? s.available_qty / s.min_stock * 100 : 0) + '"></i></span></div>'; }).join('') : '<div class="empty" style="padding:24px 12px"><b>المخزون تمام</b>مفيش صنف تحت الحد الأدنى</div>') + '</div></section></div>';
    U.segMove('seg-range', false);
    drawChart(anim);
    U.countUp(qa('.kpi b'), .15);
    if (G && anim) { U.enter(qa('.kpi'), { y: 18 }); U.enter(qa('.ov > .card, .ov2 > .card'), { delay: .15 }); }
    qa('.rank .bar i').forEach(function (i, k) { var w = (i.dataset.w || 0) + '%'; if (G) G.to(i, { width: w, duration: 1, ease: 'power3.out', delay: .3 + k * .05 }); else i.style.width = w; });
  }
  function kpi(go, label, v, sub, ico, hot) { return '<button class="kpi rp' + (hot ? ' hot' : '') + '" type="button" data-kpi="' + go + '"><span class="ico">' + I(ico) + '</span><small>' + label + '</small><b class="n">' + n(v) + '</b><span>' + esc(sub) + '</span></button>'; }
  function rankCenters(list) {
    var max = Math.max(1, Math.max.apply(null, list.map(function (c) { return c.orders; }).concat(0)));
    return list.length ? list.map(function (c) { return '<div class="rank-i"><b>' + esc(c.name) + '</b><span class="n">' + c.orders + ' طلب · ' + n(c.units) + ' وحدة</span><span class="bar"><i data-w="' + (c.orders / max * 100) + '"></i></span></div>'; }).join('') : '<div class="empty" style="padding:24px 12px"><b>لسه مفيش طلبات</b></div>';
  }
  /* the main chart: orders (accent line + soft area) over QR scans (dashed), drawn on enter */
  function drawChart(anim) {
    var box = $('chart'); if (!box) return; var s = S.d.analytics.series, W = Math.max(320, box.clientWidth), H = box.clientHeight, pl = 8, pr = 44, pt = 12, pb = 28;
    var max = Math.max(4, Math.max.apply(null, s.map(function (x) { return Math.max(x.orders, x.scans); }))), step = Math.ceil(max / 4);
    max = step * 4;
    var X = function (i) { return W - pr - i * (W - pr - pl) / Math.max(1, s.length - 1); }, Y = function (v) { return pt + (H - pt - pb) * (1 - v / max); };
    var path = function (k) { return s.map(function (x, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x[k]).toFixed(1); }).join(''); };
    var grid = '', ax = '';
    for (var g = 0; g <= 4; g++) { var y = Y(step * g); grid += '<line class="gl" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/>'; ax += '<text class="ax" x="' + (W - pr + 14) + '" y="' + (y + 4) + '" text-anchor="start">' + step * g + '</text>'; }
    var every = Math.ceil(s.length / 8);
    s.forEach(function (x, i) { if (i % every === 0 || i === s.length - 1) ax += '<text class="ax" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(x.label) + '</text>'; });
    var area = path('orders') + 'L' + X(s.length - 1) + ' ' + Y(0) + 'L' + X(0) + ' ' + Y(0) + 'Z';
    box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + grid + ax + '<path class="a1" d="' + area + '"/><path class="l2" d="' + path('scans') + '"/><path class="l1" id="l1" d="' + path('orders') + '"/>' +
      '<line class="hv" id="hv" y1="' + pt + '" y2="' + (H - pb) + '"/>' + s.map(function (x, i) { return '<circle class="dt" r="3.5" cx="' + X(i) + '" cy="' + Y(x.orders) + '" style="opacity:' + (s.length <= 14 ? 1 : 0) + '"/>'; }).join('') + '</svg><div class="tip" id="tip"></div>';
    if (G && anim) {
      var l1 = $('l1'), len = l1.getTotalLength(); G.fromTo(l1, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', clearProps: 'strokeDasharray,strokeDashoffset' });
      G.from(qs('.a1', box), { opacity: 0, duration: 1, delay: .6 }); G.from(qa('.dt', box), { scale: 0, transformOrigin: 'center', duration: .4, stagger: .05, ease: 'back.out(2)', delay: .5 });
    }
    var tip = $('tip'), hv = $('hv');
    box.onpointermove = function (e) {
      var r = box.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, i = Math.round((W - pr - x) / ((W - pr - pl) / Math.max(1, s.length - 1)));
      i = Math.max(0, Math.min(s.length - 1, i)); var d = s[i];
      hv.setAttribute('x1', X(i)); hv.setAttribute('x2', X(i)); hv.style.opacity = 1;
      tip.innerHTML = esc(d.label) + ' · <b class="n">' + d.orders + '</b> طلب · <b class="n">' + d.scans + '</b> مسح'; tip.style.left = (X(i) / W * r.width) + 'px'; tip.style.top = (Y(d.orders) / H * r.height) + 'px'; tip.style.opacity = 1;
    };
    box.onpointerleave = function () { tip.style.opacity = 0; hv.style.opacity = 0; };
  }

  /* ═════ الطلبات ═════ */
  function filteredOrders() {
    var q = S.oq.trim();
    return S.d.orders.filter(function (o) { return (S.of === 'all' || o.status === S.of) && (S.ocenter === 'all' || String(o.center_id) === S.ocenter) && (!q || (o.order_code + ' ' + o.center_name + ' ' + o.manager_name + ' ' + o.phone).indexOf(q) >= 0); });
  }
  function ordersSec(anim) {
    var counts = {}; S.d.orders.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });
    $('sec').innerHTML = ph('الطلبات', 'كل طلبات المراكز — اعتمد، جهّز، ابعت مع مندوب، وأكّد التسليم') +
      '<div class="tools">' + U.seg('seg-of', OF.map(function (x) { return [x[0], x[1], x[0] === 'all' ? S.d.orders.length : (counts[x[0]] || 0)]; }), S.of) +
        '<select class="fld" id="ocenter"><option value="all">كل المراكز</option>' + S.d.centers.map(function (c) { return '<option value="' + c.id + '"' + (String(c.id) === S.ocenter ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select>' +
        '<label class="search">' + I(ICO.search) + '<input id="oq" type="search" placeholder="رقم الطلب أو المركز" value="' + esc(S.oq) + '"></label></div>' +
      '<div class="board"><div class="olist" id="olist"></div><div class="insp" id="insp"></div></div>';
    U.segMove('seg-of', false);
    orderList(anim);
  }
  function orderList(anim) {
    var list = filteredOrders(), box = $('olist'); if (!box) return;
    if (!list.some(function (o) { return o.id === S.sel; })) S.sel = list[0] ? list[0].id : null;
    box.innerHTML = list.length ? list.map(function (o) {
      var pr = U.PRIO[o.priority] || U.PRIO.normal;
      return '<button class="orow rp' + (o.id === S.sel ? ' on' : '') + (o.status === 'pending' ? ' new' : '') + '" type="button" data-oid="' + o.id + '"><span class="thumbs">' + o.items.slice(0, 3).map(function (x) { return '<i>' + itemArt(x) + '</i>'; }).join('') + '</span>' +
        '<span style="min-width:0"><b>' + esc(o.center_name) + '</b><small><span class="n">' + esc(o.order_code) + '</span> · ' + o.total_items + ' أصناف · ' + n(o.total_units) + ' وحدة · ' + esc(U.ago(o.created_at)) + '</small></span>' +
        '<span class="r"><span class="tag ' + U.TONE[o.status] + '">' + esc(U.HEAD[o.status].split(' — ')[0]) + '</span>' + (o.priority !== 'normal' ? '<span class="tag ' + pr[1] + '">' + pr[0] + '</span>' : '') + '</span></button>';
    }).join('') : '<div class="empty"><b>مفيش طلبات هنا</b>جرّب حالة تانية أو مركز تاني</div>';
    if (G && anim) U.enter(qa('.orow', box));
    if (!U.MOB()) inspector(true);
  }
  function nextStep(o) {
    return { pending: ['approved', 'اعتمد الطلب', ICO.check, ''], approved: ['preparing', 'ابدأ التجهيز', ICO.box, ''], preparing: ['dispatched', 'اطلع مع مندوب', ICO.truck, ''], dispatched: ['delivered', 'أكّد التسليم', ICO.check, 'ok'] }[o.status];
  }
  function inspectorHTML(o) {
    var nx = nextStep(o), pr = U.PRIO[o.priority] || U.PRIO.normal, c = center(o.center_id), wa = U.waNum(o.phone || (c && c.phone));
    return '<section class="card"><div class="ins-h"><div><span class="tag ' + U.TONE[o.status] + '">' + esc(U.HEAD[o.status]) + '</span> ' + (o.priority !== 'normal' ? '<span class="tag ' + pr[1] + '">' + pr[0] + '</span>' : '') +
        '<h2>' + esc(o.center_name) + '</h2><small>طلب <span class="n">' + esc(o.order_code) + '</span> · ' + esc(U.when(o.created_at)) + (o.center_branch ? ' · ' + esc(o.center_branch) : '') + '</small></div>' +
        '<div class="ins-act">' + (nx ? '<button class="b ' + nx[3] + ' rp" type="button" data-step="' + o.id + ':' + nx[0] + '">' + I(nx[2]) + nx[1] + '</button>' : '') +
          (o.status !== 'delivered' && o.status !== 'rejected' ? '<button class="b d rp" type="button" data-cancel="' + o.id + '">' + I(ICO.ban) + 'الغِ</button>' : '<button class="b g rp" type="button" data-del-order="' + o.id + '">' + I(ICO.trash) + 'امسح</button>') + '</div></div>' +
      '<div style="margin:20px 0 4px">' + U.routeHTML(o.status) + '</div>' +
      '<div class="dispatch" id="dsp" hidden><div class="f"><label>اسم المندوب</label><input class="fld" id="d-name" value="' + esc(o.driver_name || '') + '"></div><div class="f"><label>موبايل المندوب</label><input class="fld" id="d-phone" dir="ltr" value="' + esc(o.driver_phone || '') + '"></div><div class="f"><label>يوصل خلال (دقيقة)</label><input class="fld n" id="d-eta" inputmode="numeric" value="' + (o.eta_minutes || 30) + '"></div><button class="b rp" type="button" data-dispatch="' + o.id + '">' + I(ICO.truck) + 'اطلع</button></div>' +
      (o.status === 'dispatched' && o.driver_name ? '<div class="contact" style="margin-top:12px;padding:12px;border-radius:14px;background:var(--info-bg)"><div class="who"><span class="av">' + I(ICO.truck) + '</span><div><b>' + esc(o.driver_name) + '</b><small>' + (o.eta_minutes ? 'الوصول خلال ' + o.eta_minutes + ' دقيقة' : 'في الطريق') + '</small></div></div>' + (o.driver_phone ? '<div class="a"><a class="ib bd rp" href="tel:' + esc(o.driver_phone) + '">' + I(ICO.phone) + '</a></div>' : '') + '</div>' : '') +
      '</section>' +
      '<div class="ins2"><section class="card"><div class="card-h"><h2>الأصناف</h2><small>' + o.total_items + ' أصناف · ' + n(o.total_units) + ' وحدة</small></div>' +
        o.items.map(function (x) { var s = supply(x.supply_id); return '<div class="irow"><span class="t">' + itemArt(x) + '</span><div><b>' + esc(x.supply_name) + '</b><small>' + esc(x.category) + (s ? ' · باقي في المخزن ' + n(s.available_qty) : '') + '</small></div><span class="q n">' + n(x.quantity) + ' <small style="display:inline">' + esc(x.unit) + '</small></span></div>'; }).join('') + '</section>' +
        '<div style="display:grid;gap:16px;align-content:start"><section class="card"><div class="contact"><div class="who"><span class="av">' + I(ICO.user) + '</span><div><b>' + esc(o.manager_name || 'مدير المركز') + '</b><small class="n">' + esc(o.phone || '—') + '</small></div></div><div class="a">' +
          (o.phone ? '<a class="ib bd rp" href="tel:' + esc(o.phone) + '" title="اتصال">' + I(ICO.phone) + '</a>' : '') + (wa ? '<a class="ib bd rp" target="_blank" rel="noopener" href="https://wa.me/' + wa + '" title="واتساب">' + I(ICO.wa) + '</a>' : '') + '</div></div>' +
          (o.notes ? '<div class="note" style="margin-top:12px"><small>ملاحظة المركز</small>' + esc(o.notes) + '</div>' : '') +
          '<div class="f" style="margin-top:12px"><label>رد يظهر للمركز</label><div class="reply"><input class="fld" id="reply" maxlength="300" value="' + esc(o.admin_note || '') + '" placeholder="مثلاً: هيوصل بكرة الصبح"><button class="ib bd rp" type="button" data-reply="' + o.id + '" title="احفظ الرد">' + I(ICO.check) + '</button></div></div></section>' +
          '<section class="card"><div class="card-h"><h2>الخطوات</h2></div>' + U.timelineHTML(o.stage_log) + '</section></div></div>';
  }
  function inspector(anim, prevP) {
    var box = $('insp'); if (!box) return; var o = S.d.orders.find(function (x) { return x.id === S.sel; });
    if (!o) { box.innerHTML = '<div class="empty">' + A.svg('box') + '<b>اختار طلب</b>تفاصيله هتظهر هنا</div>'; return; }
    box.innerHTML = inspectorHTML(o);
    U.routeGrow(qs('.route', box), prevP != null ? prevP : 0, anim ? .15 : 0);
    if (G && anim) U.enter(qa('#insp > *'), { delay: .05 });
  }
  function openOrderPanel(id) {
    var o = S.d.orders.find(function (x) { return x.id === id; }); if (!o) return; S.sel = id;
    $('pn-order-t').textContent = 'طلب ' + o.order_code;
    $('pn-order-body').innerHTML = '<div class="pn-pad" id="insp-m">' + inspectorHTML(o) + '</div>'; $('pn-order-foot').innerHTML = '';
    U.openPanel('pn-order', function () { U.routeGrow(qs('#insp-m .route'), 0, .3); });
  }
  function step(id, status, extra) {
    var o = S.d.orders.find(function (x) { return x.id === id; }); if (!o) return;
    if (status === 'dispatched' && !extra) { var d = qs('#dsp', U.isOpen() ? $('pn-order') : $('insp')) || qs('#dsp'); if (d) { d.hidden = false; if (G) G.from(d, { height: 0, opacity: 0, duration: .45, ease: 'power3.out', clearProps: 'height,opacity' }); qs('#d-name', d).focus(); } return; }
    U.api('PATCH', '/api/admin/orders/' + id, Object.assign({ status: status }, extra || {})).then(function (j) { applyOrder(j.order, true); U.toast('طلب ' + j.order.order_code + ': ' + U.HEAD[j.order.status]); }).catch(function (e) { U.toast(e.message, true); });
  }
  function applyOrder(o, mine) {
    var i = S.d.orders.findIndex(function (x) { return x.id === o.id; }), prev = i >= 0 ? S.d.orders[i] : null;
    if (i >= 0) S.d.orders[i] = o; else S.d.orders.unshift(o);
    S.d.orders.sort(function (a, b) { return b.id - a.id; });
    if (S.sec === 'orders') {
      var keepP = prev ? U.pOf(prev.status) : null;
      if (mine && S.of !== 'all' && o.status !== S.of) { S.of = 'all'; U.segSet('seg-of', 'all', true); }
      var cnt = {}; S.d.orders.forEach(function (x) { cnt[x.status] = (cnt[x.status] || 0) + 1; });
      qa('#seg-of button').forEach(function (bt) { var k = qs('.k', bt); if (k) k.textContent = bt.dataset.v === 'all' ? S.d.orders.length : (cnt[bt.dataset.v] || 0); });
      orderList(false);
      if (o.id === S.sel && !U.MOB()) inspector(false, keepP);
      if (U.isOpen() && $('pn-order').classList.contains('on') && o.id === S.sel) { $('pn-order-body').innerHTML = '<div class="pn-pad" id="insp-m">' + inspectorHTML(o) + '</div>'; U.routeGrow(qs('#insp-m .route'), keepP, 0); }
    } else if (S.sec === 'home' && !mine) render(false);
    else if (S.sec === 'home') render(false);
  }

  /* ═════ الأصناف ═════ */
  function catalog(anim) {
    var cats = {}; S.d.supplies.forEach(function (s) { cats[s.category] = (cats[s.category] || 0) + 1; });
    var low = S.d.supplies.filter(function (s) { return s.available_qty <= s.min_stock; }).length;
    var segs = [['all', 'الكل', S.d.supplies.length], ['low', 'قربت تخلص', low]].concat(Object.keys(cats).map(function (k) { return [k, k, cats[k]]; }));
    $('sec').innerHTML = ph('الأصناف', 'اللي المراكز تقدر تطلبه والكمية المتاحة — أي تعديل بيظهر في صفحات المراكز على طول', '<button class="b rp" type="button" data-new-supply>' + I(ICO.plus) + 'صنف جديد</button>') +
      '<div class="tools">' + U.seg('seg-cf', segs, S.cf) + '<label class="search">' + I(ICO.search) + '<input id="cq" type="search" placeholder="دوّر على صنف" value="' + esc(S.cq) + '"></label></div><div class="cgrid" id="cgrid"></div>';
    U.segMove('seg-cf', false); cgrid();
  }
  function supplyCard(s) {
    var st = stockState(s), lv = Math.min(100, s.min_stock ? s.available_qty / (s.min_stock * 3) * 100 : (s.available_qty ? 100 : 0));
    return '<article class="sc rv' + (s.is_visible ? '' : ' hid') + '" data-sid="' + s.id + '"><div class="sc-art" data-edit-supply="' + s.id + '">' + A.thumb(s) + '<span class="tag ' + st[0] + '"><i></i>' + st[1] + '</span></div>' +
      '<div class="sc-b"><div><h3>' + esc(s.name) + '</h3><div class="m">' + esc(s.category) + ' · أقصى طلب ' + (s.max_per_order || '—') + '</div></div>' +
      '<div class="sc-st"><b class="n">' + n(s.available_qty) + '<small>' + esc(s.unit) + '</small></b><span class="qbtn"><button type="button" class="rp" data-stock="' + s.id + ':1" aria-label="زوّد">' + I(ICO.plus) + '</button><button type="button" class="rp" data-stock="' + s.id + ':-1" aria-label="قلّل">' + I(ICO.minus) + '</button></span></div>' +
      '<div class="lvl ' + (st[0] === 'ok' ? '' : st[0]) + '"><i style="width:' + lv + '%"></i></div>' +
      '<div class="sc-f"><label><span class="sw' + (s.is_visible ? ' on' : '') + '" role="switch" aria-checked="' + !!s.is_visible + '" data-vis="' + s.id + '"></span>ظاهر للمراكز</label><button class="ib sm rp" type="button" data-edit-supply="' + s.id + '" aria-label="تعديل">' + I(ICO.edit) + '</button></div></div></article>';
  }
  function cgrid() {
    var q = S.cq.trim(), list = S.d.supplies.filter(function (s) { return (S.cf === 'all' || (S.cf === 'low' ? s.available_qty <= s.min_stock : s.category === S.cf)) && (!q || (s.name + ' ' + s.category + ' ' + s.sku).indexOf(q) >= 0); });
    $('cgrid').innerHTML = list.length ? list.map(supplyCard).join('') : '<div class="empty" style="grid-column:1/-1">' + A.svg('box') + '<b>' + (S.d.supplies.length ? 'مفيش أصناف هنا' : 'لسه مفيش أصناف') + '</b>' + (S.d.supplies.length ? '' : 'ضيف أول صنف والمراكز هتشوفه على طول') + '<div><button class="b rp" type="button" data-new-supply>' + I(ICO.plus) + 'صنف جديد</button></div></div>';
    U.reveal(qa('#cgrid .sc.rv'));
  }
  function supplyForm(s) {
    s = s || { name: '', category: '', unit: 'علبة', description: '', available_qty: 0, min_stock: 5, max_per_order: 20, image_url: '', is_visible: 1 };
    var cats = Array.from(new Set(S.d.supplies.map(function (x) { return x.category; })));
    $('pn-supply-t').textContent = s.id ? 'تعديل صنف' : 'صنف جديد';
    $('pn-supply-body').innerHTML = '<form class="pn-pad" id="sform"><div class="sf"><div><div class="sf-art" id="sf-art">' + A.thumb(s) + '<small id="sf-hint">' + (s.image_url ? 'صورة الصنف' : 'الرسمة بتتغير حسب اسم الصنف') + '</small></div>' +
        '<div class="sf-up"><label class="b g sm rp" style="cursor:pointer">' + I(ICO.plus) + 'صورة<input type="file" id="sf-img" accept="image/*" hidden></label>' + (s.image_url ? '<button class="b g sm rp" type="button" id="sf-noimg">شيل الصورة</button>' : '') + '</div></div>' +
      '<div style="display:grid;gap:12px"><div class="f"><label for="sf-name">اسم الصنف <em>*</em></label><input class="fld" id="sf-name" required maxlength="120" value="' + esc(s.name) + '" placeholder="مثلاً: أفلام أشعة 14×17"></div>' +
        '<div class="g2"><div class="f"><label for="sf-cat">القسم</label><input class="fld" id="sf-cat" list="sf-cats" maxlength="60" value="' + esc(s.category) + '" placeholder="أفلام أشعة"><datalist id="sf-cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div><div class="f"><label for="sf-unit">الوحدة</label><input class="fld" id="sf-unit" maxlength="24" value="' + esc(s.unit) + '"></div></div>' +
        '<div class="g3"><div class="f"><label for="sf-qty">المتاح</label><input class="fld n" id="sf-qty" inputmode="numeric" value="' + s.available_qty + '"></div><div class="f"><label for="sf-min">تنبيه تحت</label><input class="fld n" id="sf-min" inputmode="numeric" value="' + s.min_stock + '"></div><div class="f"><label for="sf-max">أقصى طلب</label><input class="fld n" id="sf-max" inputmode="numeric" value="' + s.max_per_order + '"><small>0 = من غير حد</small></div></div>' +
        '<div class="f"><label for="sf-desc">وصف يظهر للمركز</label><textarea class="fld" id="sf-desc" maxlength="300">' + esc(s.description) + '</textarea></div>' +
        '<button class="tg" type="button" id="sf-vis"><span><b>ظاهر للمراكز</b><small>لو اتقفل الصنف يختفي من صفحات المراكز</small></span><span class="sw' + (s.is_visible ? ' on' : '') + '"></span></button></div></div></form>';
    $('pn-supply-foot').innerHTML = '<div class="pn-foot">' + (s.id ? '<button class="b d rp" type="button" data-del-supply="' + s.id + '" style="flex:none">' + I(ICO.trash) + '</button>' : '') + '<button class="b g rp" type="button" data-close>إلغاء</button><button class="b rp" type="submit" form="sform">' + I(ICO.check) + 'حفظ</button></div>';
    var img = s.image_url || '', vis = !!s.is_visible;
    var preview = function () { if (img) return; var k = A.key({ name: $('sf-name').value, category: $('sf-cat').value }); var box = $('sf-art'); if (box.dataset.k === k) return; box.dataset.k = k; box.firstChild.outerHTML = A.svg(k); if (G) G.fromTo(box.firstChild, { scale: .7, opacity: 0, rotate: -8 }, { scale: 1, opacity: 1, rotate: 0, duration: .5, ease: 'back.out(2)' }); };
    $('sf-name').addEventListener('input', preview); $('sf-cat').addEventListener('input', preview);
    $('sf-vis').onclick = function () { vis = !vis; qs('.sw', this).classList.toggle('on', vis); };
    $('sf-img').onchange = function () { var f = this.files && this.files[0]; if (!f) return; shrink(f, 480).then(function (d) { img = d; $('sf-art').firstChild.outerHTML = '<img src="' + d + '" alt="">'; $('sf-hint').textContent = 'صورة الصنف'; }).catch(function (e) { U.toast(e.message, true); }); };
    if ($('sf-noimg')) $('sf-noimg').onclick = function () { img = ''; $('sf-art').dataset.k = ''; preview(); this.remove(); };
    $('sform').onsubmit = function (e) {
      e.preventDefault();
      var body = { name: $('sf-name').value, category: $('sf-cat').value, unit: $('sf-unit').value, description: $('sf-desc').value, available_qty: $('sf-qty').value, min_stock: $('sf-min').value, max_per_order: $('sf-max').value, image_url: img, is_visible: vis };
      U.api(s.id ? 'PUT' : 'POST', '/api/admin/supplies' + (s.id ? '/' + s.id : ''), body).then(function () { U.closePanel('pn-supply'); U.toast(s.id ? 'اتحفظ' : 'الصنف اتضاف وظاهر للمراكز'); return reload(); }).catch(function (er) { U.toast(er.message, true); });
    };
    U.openPanel('pn-supply', function () { if (!U.MOB()) setTimeout(function () { $('sf-name').focus(); }, 80); });
  }
  function shrink(file, max) {
    return new Promise(function (ok, no) {
      var r = new FileReader(); r.onerror = function () { no(new Error('مش قادر أقرا الصورة')); };
      r.onload = function () { var im = new Image(); im.onerror = function () { no(new Error('الصورة مش مفهومة')); }; im.onload = function () { var k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); var out = cv.toDataURL('image/webp', .85); if (!/^data:image\/webp/.test(out)) out = cv.toDataURL('image/jpeg', .86); ok(out); }; im.src = r.result; };
      r.readAsDataURL(file);
    });
  }

  /* ═════ المراكز ═════ */
  function centersSec(anim) {
    var st = S.d.settings, dirOn = st.public_directory !== 'false';
    $('sec').innerHTML = ph('المراكز', 'كل مركز ليه لينك وباركود خاص بيه — اطبعه على باب المركز', '<button class="b rp" type="button" data-new-center>' + I(ICO.plus) + 'مركز جديد</button>') +
      '<section class="card gq"><div class="qr" id="gq-qr"><i class="sk" style="width:100%;height:100%"></i></div><div><h2>الكود العام</h2><p>' + (dirOn ? 'أي مدير يمسحه بيختار مركزه من القايمة (بالأسماء بس) ويطلب.' : 'مقفول — المدير لازم يمسح كود مركزه.') + '</p><span class="url" id="gq-url">' + esc(S.d.baseUrl + '/center') + '</span></div>' +
        '<div class="ph-a"><button class="tg" type="button" data-set-toggle="public_directory" style="border:0;padding:0;width:auto;gap:10px"><span><b>' + (dirOn ? 'شغّال' : 'مقفول') + '</b></span><span class="sw' + (dirOn ? ' on' : '') + '"></span></button><button class="b g rp" type="button" data-qr="all">' + I(ICO.print) + 'اطبع</button></div></section>' +
      '<div class="ccards" id="ccards">' + (S.d.centers.length ? S.d.centers.map(centerCard).join('') : '<div class="empty" style="grid-column:1/-1">' + A.svg('box') + '<b>لسه مفيش مراكز</b>ضيف أول مركز واطبعله الباركود<div><button class="b rp" type="button" data-new-center>' + I(ICO.plus) + 'مركز جديد</button></div></div>') + '</div>';
    U.api('GET', '/api/admin/qr/all').then(function (j) { var q = $('gq-qr'); if (q) { q.innerHTML = j.svg; if (G) G.from(q.firstChild, { scale: .8, opacity: 0, duration: .6, ease: 'back.out(1.7)' }); } }).catch(function () {});
    U.reveal(qa('#ccards .cc.rv'));
  }
  function centerCard(c) {
    var url = S.d.baseUrl + '/c/' + c.code, wa = U.waNum(c.phone);
    return '<article class="cc rv' + (c.is_active ? '' : ' off') + '" data-cid="' + c.id + '"><div class="cc-h"><span class="mk">' + I(ICO.store) + '</span><div style="min-width:0"><b>' + esc(c.name) + '</b><small>' + esc([c.branch, c.manager_name].filter(Boolean).join(' · ')) + '</small></div><span class="sw' + (c.is_active ? ' on' : '') + '" role="switch" aria-checked="' + !!c.is_active + '" data-active="' + c.id + '" title="اللينك شغال"></span></div>' +
      '<div class="cc-s"><div><b class="n">' + n(c.scan_count) + '</b><small>مسح الكود</small></div><div><b class="n">' + n(c.orders_count) + '</b><small>طلب</small></div><div><b style="font-size:13px;line-height:1.9">' + (c.last_scan ? esc(U.ago(c.last_scan)) : '—') + '</b><small>آخر زيارة</small></div></div>' +
      '<span class="url">' + esc(url) + '</span>' +
      '<div class="cc-a"><button class="b sm rp" type="button" data-qr="' + esc(c.code) + '">' + I(ICO.qr) + 'الباركود</button><button class="ib sm bd rp" type="button" data-copy="' + esc(url) + '" title="نسخ اللينك">' + I(ICO.copy) + '</button>' +
        (wa ? '<a class="ib sm bd rp" target="_blank" rel="noopener" title="ابعت اللينك واتساب" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('لينك طلب التوريدات لـ ' + c.name + ': ' + url) + '">' + I(ICO.wa) + '</a>' : '') +
        '<button class="ib sm bd rp" type="button" data-edit-center="' + c.id + '" title="تعديل">' + I(ICO.edit) + '</button><button class="ib sm bd rp" type="button" data-new-code="' + c.id + '" title="كود جديد (القديم يقف)">' + I(ICO.refresh) + '</button></div></article>';
  }
  function centerForm(c) {
    c = c || {};
    $('pn-center-t').textContent = c.id ? 'تعديل مركز' : 'مركز جديد';
    var f = function (k, lbl, attrs) { return '<div class="f"><label for="cf-' + k + '">' + lbl + '</label><input class="fld" id="cf-' + k + '" value="' + esc(c[k] || '') + '" ' + (attrs || '') + '></div>'; };
    $('pn-center-body').innerHTML = '<form class="pn-pad" id="cform">' + f('name', 'اسم المركز <em>*</em>', 'required maxlength="120"') + '<div class="g2">' + f('branch', 'الفرع', 'maxlength="120"') + f('manager_name', 'المدير', 'maxlength="80"') + '</div>' +
      '<div class="g2">' + f('phone', 'موبايل', 'dir="ltr" maxlength="30"') + (c.id ? '<div class="f"><label>كود اللينك</label><input class="fld" value="' + esc(c.code) + '" dir="ltr" disabled></div>' : f('code', 'كود اللينك (اختياري)', 'dir="ltr" maxlength="40" placeholder="بيتعمل لوحده"')) + '</div>' + f('address', 'العنوان', 'maxlength="200"') +
      (c.id ? '' : '<small style="color:var(--mut);font-size:12.5px">سيبه فاضي ويتعمل كود عشوائي صعب التخمين — الأأمن</small>') + '</form>';
    $('pn-center-foot').innerHTML = '<div class="pn-foot">' + (c.id ? '<button class="b d rp" type="button" data-del-center="' + c.id + '" style="flex:none">' + I(ICO.trash) + '</button>' : '') + '<button class="b g rp" type="button" data-close>إلغاء</button><button class="b rp" type="submit" form="cform">' + I(ICO.check) + 'حفظ</button></div>';
    $('cform').onsubmit = function (e) {
      e.preventDefault(); var b = {}; ['name', 'branch', 'manager_name', 'phone', 'address', 'code'].forEach(function (k) { var el = $('cf-' + k); if (el) b[k] = el.value; });
      U.api(c.id ? 'PUT' : 'POST', '/api/admin/centers' + (c.id ? '/' + c.id : ''), b).then(function (j) { U.closePanel('pn-center'); U.toast(c.id ? 'اتحفظ' : 'المركز اتضاف — اطبعله الباركود'); return reload().then(function () { if (!c.id) qrPoster(j.center.code); }); }).catch(function (er) { U.toast(er.message, true); });
    };
    U.openPanel('pn-center', function () { if (!U.MOB()) setTimeout(function () { $('cf-name').focus(); }, 80); });
  }
  function qrPoster(code) {
    var c = code === 'all' ? null : S.d.centers.find(function (x) { return x.code === code; }), st = S.d.settings;
    $('pn-qr-t').textContent = c ? 'باركود ' + c.name : 'الكود العام';
    $('pn-qr-body').innerHTML = '<div class="pn-pad"><div class="poster" id="poster"><div class="pb"><i>' + I(ICO.box) + '</i>' + esc(st.brand_name) + '</div><h3>اطلب توريداتك من هنا</h3><p>صوّر الكود بكاميرا الموبايل، اختار الأصناف وتابع طلبك لحد ما يوصل</p>' +
      '<div class="q" id="pq"><i class="sk" style="width:100%;height:100%"></i></div>' + (c ? '<div class="cn">' + esc(c.name) + '</div>' : '<div class="cn">اختار مركزك بعد المسح</div>') + '<div class="u" id="pu"></div><div class="st"><span>1 امسح</span><span>2 اختار</span><span>3 تابع</span></div></div></div>';
    $('pn-qr-foot').innerHTML = '<div class="pn-foot"><a class="b g rp" id="qr-dl" download="qr-' + esc(code) + '.gif">' + I(ICO.copy) + 'نزّل الصورة</a><button class="b rp" type="button" id="qr-print">' + I(ICO.print) + 'اطبع</button></div>';
    U.openPanel('pn-qr');
    U.api('GET', '/api/admin/qr/' + encodeURIComponent(code)).then(function (j) {
      $('pq').innerHTML = j.svg; $('pu').textContent = j.url; $('qr-dl').href = j.pngDataUrl;
      if (G) G.from('#pq svg', { scale: .7, opacity: 0, rotate: -6, duration: .6, ease: 'back.out(1.7)' });
      $('qr-print').onclick = function () {
        var w = window.open('', '_blank', 'width=520,height=760'); if (!w) return U.toast('المتصفح منع نافذة الطباعة', true);
        w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>باركود</title><link rel="stylesheet" href="' + location.origin + '/fonts/fonts.css"><link rel="stylesheet" href="' + location.origin + '/panel/admin.css"><style>@page{size:A6;margin:0}html,body{margin:0;background:#fff;font-family:"IBM Plex Sans Arabic",sans-serif}.poster{width:105mm;height:148mm;border-radius:0;box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>' + $('poster').outerHTML + '<script>document.fonts.ready.then(function(){setTimeout(function(){print()},250)})<\/script></body></html>');
        w.document.close();
      };
    }).catch(function (e) { U.toast(e.message, true); });
  }

  /* ═════ الإعدادات ═════ */
  function settings(anim) {
    var st = S.d.settings, tg = function (k, t, s) { var on = st[k] !== 'false'; return '<button class="tg rp" type="button" data-set-toggle="' + k + '"><span><b>' + t + '</b><small>' + s + '</small></span><span class="sw' + (on ? ' on' : '') + '"></span></button>'; };
    $('sec').innerHTML = ph('الإعدادات', 'اسم البراند، اللينكات، التنبيهات وكلمة السر') +
      '<div class="set"><section class="card"><div class="card-h"><h2>البراند واللينك</h2></div><form id="setf" style="display:grid;gap:12px">' +
        '<div class="f"><label for="s-bn">الاسم</label><input class="fld" id="s-bn" value="' + esc(st.brand_name) + '" maxlength="60"></div>' +
        '<div class="f"><label for="s-bs">السطر اللي تحته</label><input class="fld" id="s-bs" value="' + esc(st.brand_subtitle) + '" maxlength="100"></div>' +
        '<div class="f"><label for="s-url">رابط الموقع للأكواد</label><input class="fld" id="s-url" dir="ltr" value="' + esc(st.public_base_url) + '" placeholder="' + esc(S.d.baseUrl) + '"><small>سيبه فاضي ويتحسب لوحده. الحالي: <span dir="ltr">' + esc(S.d.baseUrl) + '</span> — لو اتغير لازم تطبع الأكواد تاني</small></div>' +
        '<div><button class="b rp" type="submit">' + I(ICO.check) + 'حفظ</button></div></form></section>' +
        '<div style="display:grid;gap:16px"><section class="card"><div class="card-h"><h2>المراكز والتنبيهات</h2></div>' +
          tg('show_out_of_stock', 'اعرض الأصناف اللي خلصت', 'المركز يشوفها بعلامة «خلص» بدل ما تختفي') + tg('sound_alerts', 'صوت مع الطلب الجديد', 'تنبيه صوتي في اللوحة أول ما مركز يطلب') + tg('public_directory', 'الكود العام', 'صفحة /center بتعرض أسماء المراكز عشان المدير يختار') + '</section>' +
        '<section class="card"><div class="card-h"><h2>كلمة السر</h2></div><form id="pwf" style="display:grid;gap:12px"><div class="f"><label for="p1">الحالية</label><input class="fld" id="p1" type="password" autocomplete="current-password" required></div><div class="f"><label for="p2">الجديدة</label><input class="fld" id="p2" type="password" autocomplete="new-password" minlength="8" required><small>8 حروف على الأقل — بتقفل الدخول من أي جهاز تاني</small></div><div><button class="b k rp" type="submit">غيّر كلمة السر</button></div></form></section></div></div>';
    $('setf').onsubmit = function (e) { e.preventDefault(); saveSettings({ brand_name: $('s-bn').value, brand_subtitle: $('s-bs').value, public_base_url: $('s-url').value }, 'اتحفظ'); };
    $('pwf').onsubmit = function (e) { e.preventDefault(); U.api('POST', '/api/admin/password', { current: $('p1').value, next: $('p2').value }).then(function () { U.toast('كلمة السر اتغيرت'); $('pwf').reset(); }).catch(function (er) { U.toast(er.message, true); }); };
    if (G && anim) U.enter(qa('.set .card'));
  }
  function saveSettings(b, msg) {
    return U.api('PUT', '/api/admin/settings', b).then(function (j) { S.d.settings = j.settings; S.d.baseUrl = j.baseUrl; $('bn').textContent = j.settings.brand_name; $('bs').textContent = j.settings.brand_subtitle; if (msg) U.toast(msg); }).catch(function (er) { U.toast(er.message, true); });
  }

  /* ═════ live ═════ */
  var beepCtx;
  function beep() {
    if (S.d.settings.sound_alerts === 'false') return;
    try { beepCtx = beepCtx || new (window.AudioContext || window.webkitAudioContext)(); var t = beepCtx.currentTime;[880, 1320].forEach(function (f, i) { var o = beepCtx.createOscillator(), g = beepCtx.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t + i * .14); g.gain.exponentialRampToValueAtTime(.18, t + i * .14 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .14 + .22); o.connect(g).connect(beepCtx.destination); o.start(t + i * .14); o.stop(t + i * .14 + .25); }); } catch (e) {}
  }
  function connect() {
    var es = new EventSource('/api/admin/events'), conn = $('conn');
    var setConn = function (on) { S.live = on; conn.classList.toggle('on', on); qs('span', conn).textContent = on ? 'متصل لحظيًا' : 'بيعيد الاتصال…'; };
    es.addEventListener('connected', function () { setConn(true); });
    es.onerror = function () { setConn(false); };
    es.addEventListener('order:created', function (e) { var j = JSON.parse(e.data); S.d.stats = j.stats; applyOrder(j.order); beep(); U.toast('طلب جديد من ' + j.order.center_name); badges(); refreshAnalytics(); });
    es.addEventListener('order:updated', function (e) { var j = JSON.parse(e.data); S.d.stats = j.stats; applyOrder(j.order); badges(); });
    es.addEventListener('order:deleted', function (e) { var j = JSON.parse(e.data); S.d.stats = j.stats; S.d.orders = S.d.orders.filter(function (o) { return o.id !== j.id; }); if (S.sec === 'orders' || S.sec === 'home') render(false); });
    es.addEventListener('supplies', function (e) { var j = JSON.parse(e.data); S.d.supplies = j.supplies; S.d.stats = j.stats; badges(); if (S.sec === 'catalog' && !U.isOpen()) cgrid(); else if (S.sec === 'home') render(false); });
    es.addEventListener('centers', function (e) { S.d.centers = JSON.parse(e.data).centers; if (S.sec === 'centers' && !U.isOpen()) centersSec(false); });
    es.addEventListener('scan', function (e) { var j = JSON.parse(e.data), c = center(j.center_id); if (c) c.scan_count = j.scan_count; S.d.stats.scansToday++; if (S.sec === 'home') { var k = qa('.kpi b')[3]; if (k) { k.textContent = n(S.d.stats.scansToday); if (G) G.fromTo(k, { scale: 1.3 }, { scale: 1, duration: .5, ease: 'back.out(2)' }); } } });
  }
  function refreshAnalytics() { U.api('GET', '/api/admin/analytics?range=' + S.range).then(function (j) { S.d.analytics = j.analytics; if (S.sec === 'home') drawChart(false); }).catch(function () {}); }
  function reload() { return U.api('GET', '/api/admin/bootstrap?range=' + S.range).then(function (j) { S.d = j; render(false); }); }

  /* ═════ events ═════ */
  function bind() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button,a,[data-edit-supply],[data-open-order],[data-vis],[data-active]'); if (!b) return;
      var d = b.dataset;
      if (d.sec) return go(d.sec);
      if (d.secGo) return go(d.secGo);
      if (d.kpi) { var p = d.kpi.split(':'); if (p[0] === 'orders') S.of = p[1] || 'all'; if (p[0] === 'catalog') S.cf = p[1] || 'all'; S.sec = ''; return go(p[0]); }
      var sg = b.closest('.seg');
      if (sg && d.v) {
        if (sg.id === 'seg-range') { S.range = d.v; U.segSet(sg, d.v, true); return refreshAnalytics(); }
        if (sg.id === 'seg-of') { S.of = d.v; U.segSet(sg, d.v, true); return orderList(true); }
        if (sg.id === 'seg-cf') { S.cf = d.v; U.segSet(sg, d.v, true); return cgrid(); }
      }
      if (b.id === 'thm' || b.id === 'thm2') { U.toggleTheme(b); return U.themeIcon($(b.id === 'thm' ? 'thm2' : 'thm'), false); }
      if (b.id === 'logout' || b.id === 'logout2') return U.api('POST', '/api/logout', {}).then(function () { location.reload(); });
      if (d.oid) { S.sel = Number(d.oid); if (U.MOB()) return openOrderPanel(S.sel); qa('.orow').forEach(function (r) { r.classList.toggle('on', Number(r.dataset.oid) === S.sel); }); return inspector(true); }
      if (d.openOrder && !e.target.closest('[data-step]')) { S.sel = Number(d.openOrder); S.of = 'all'; S.sec = ''; go('orders'); if (U.MOB()) setTimeout(function () { openOrderPanel(S.sel); }, 400); return; }
      if (d.step) { var sp = d.step.split(':'); if (G) G.fromTo(b, { scale: .9 }, { scale: 1, duration: .5, ease: 'elastic.out(1,.45)' }); return step(Number(sp[0]), sp[1]); }
      if (d.dispatch) { var box = b.closest('.dispatch'); return step(Number(d.dispatch), 'dispatched', { driver_name: qs('#d-name', box).value, driver_phone: qs('#d-phone', box).value, eta_minutes: qs('#d-eta', box).value }); }
      if (d.cancel) { if (!confirm('تلغي الطلب ده؟ الكميات المحجوزة هترجع للمخزن.')) return; return step(Number(d.cancel), 'rejected'); }
      if (d.delOrder) { if (!confirm('تمسح الطلب ده نهائي؟')) return; return U.api('DELETE', '/api/admin/orders/' + d.delOrder).then(function () { U.closePanel('pn-order'); U.toast('اتمسح'); return reload(); }).catch(function (er) { U.toast(er.message, true); }); }
      if (d.reply) { var inp = b.parentNode.querySelector('input'); return U.api('PATCH', '/api/admin/orders/' + d.reply, { admin_note: inp.value }).then(function (j) { applyOrder(j.order, true); U.toast('الرد اتحفظ وظاهر للمركز'); }).catch(function (er) { U.toast(er.message, true); }); }
      if (b.hasAttribute('data-new-supply')) return supplyForm();
      if (d.editSupply) return supplyForm(supply(Number(d.editSupply)));
      if (d.delSupply) { if (!confirm('تمسح الصنف ده؟')) return; return U.api('DELETE', '/api/admin/supplies/' + d.delSupply).then(function () { U.closePanel('pn-supply'); U.toast('اتمسح'); return reload(); }); }
      if (d.stock) { var st = d.stock.split(':'); if (G) G.fromTo(b, { scale: .8 }, { scale: 1, duration: .4, ease: 'back.out(3)' }); return U.api('PATCH', '/api/admin/supplies/' + st[0] + '/stock', { delta: Number(st[1]) }).then(function (j) { var i = S.d.supplies.findIndex(function (x) { return x.id === j.supply.id; }); S.d.supplies[i] = j.supply; var card = qs('.sc[data-sid="' + j.supply.id + '"]'); if (card) { var tmp = document.createElement('div'); tmp.innerHTML = supplyCard(j.supply); tmp.firstChild.classList.remove('rv'); card.replaceWith(tmp.firstChild); } }).catch(function (er) { U.toast(er.message, true); }); }
      if (d.vis) { var s = supply(Number(d.vis)); return U.api('PUT', '/api/admin/supplies/' + s.id, { is_visible: !s.is_visible }).then(function (j) { Object.assign(s, j.supply); b.classList.toggle('on', !!s.is_visible); b.closest('.sc').classList.toggle('hid', !s.is_visible); U.toast(s.is_visible ? 'ظاهر للمراكز' : 'اتخفى من صفحات المراكز'); }); }
      if (b.hasAttribute('data-new-center')) return centerForm();
      if (d.editCenter) return centerForm(center(Number(d.editCenter)));
      if (d.delCenter) { if (!confirm('تمسح المركز ده وكل طلباته؟')) return; return U.api('DELETE', '/api/admin/centers/' + d.delCenter).then(function () { U.closePanel('pn-center'); U.toast('اتمسح'); return reload(); }).catch(function (er) { U.toast(er.message, true); }); }
      if (d.newCode) { if (!confirm('تعمل كود جديد؟ الباركود المطبوع القديم هيقف وهتحتاج تطبع الجديد.')) return; return U.api('POST', '/api/admin/centers/' + d.newCode + '/code', {}).then(function (j) { U.toast('اتعمل كود جديد — اطبعه'); return reload().then(function () { qrPoster(j.center.code); }); }); }
      if (d.active) { var c = center(Number(d.active)); return U.api('PUT', '/api/admin/centers/' + c.id, { is_active: !c.is_active }).then(function (j) { Object.assign(c, j.center); b.classList.toggle('on', !!c.is_active); b.closest('.cc').classList.toggle('off', !c.is_active); U.toast(c.is_active ? 'لينك المركز شغال' : 'لينك المركز وقف'); }); }
      if (d.qr) return qrPoster(d.qr);
      if (d.copy) return (navigator.clipboard ? navigator.clipboard.writeText(d.copy) : Promise.reject()).then(function () { U.toast('اتنسخ اللينك'); }).catch(function () { prompt('انسخ اللينك', d.copy); });
      if (d.setToggle) { var k = d.setToggle, on = S.d.settings[k] !== 'false', o = {}; o[k] = on ? 'false' : 'true'; return saveSettings(o, null).then(function () { if (S.sec === 'centers') centersSec(false); else { var sw = qs('.sw', b); if (sw) sw.classList.toggle('on', !on); } }); }
    });
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.id === 'oq') { S.oq = el.value; clearTimeout(el._t); el._t = setTimeout(function () { orderList(false); }, 160); }
      if (el.id === 'cq') { S.cq = el.value; clearTimeout(el._t); el._t = setTimeout(cgrid, 160); }
    });
    document.addEventListener('change', function (e) { if (e.target.id === 'ocenter') { S.ocenter = e.target.value; orderList(true); } });
    window.addEventListener('resize', function () { navMove(false); if (S.sec === 'home') { clearTimeout(window._rz); window._rz = setTimeout(function () { drawChart(false); }, 150); } });
  }

  /* ═════ boot ═════ */
  function boot() {
    $('app').innerHTML = '<div class="shell"><aside class="side"></aside><main class="main"><div class="kpis">' + [0, 1, 2, 3].map(function () { return '<i class="sk" style="height:118px;border-radius:20px"></i>'; }).join('') + '</div><div class="ov"><i class="sk" style="height:380px;border-radius:20px"></i><i class="sk" style="height:380px;border-radius:20px"></i></div></main></div>';
    U.api('GET', '/api/admin/bootstrap?range=' + S.range).then(function (j) {
      S.d = j; shell(); bind();
      var h = location.hash.replace('#', ''); S.sec = ''; go(NAV.some(function (x) { return x[0] === h; }) ? h : 'home', false);
      requestAnimationFrame(function () { navMove(false); });
      if (G) { G.from('.side', { x: 30, opacity: 0, duration: .6, ease: 'power3.out' }); G.from('.nav button', { x: 16, opacity: 0, duration: .45, ease: 'power3.out', stagger: .05, delay: .15 }); }
      connect();
    }).catch(function (e) { if (e.status === 401) login(); else $('app').innerHTML = '<div class="login"><div class="empty"><b>' + esc(e.message) + '</b></div></div>'; });
  }
  boot();
})();
