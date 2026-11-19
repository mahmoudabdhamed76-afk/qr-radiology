/* ==========================================================================
   إمداد QR — Center Mobile Portal Logic (Real-Time SSE + GSAP Motion UI)
   ========================================================================== */

(function () {
  const M = window.EmdadMotion;
  const UI = window.MotionUI;
  const $ = (id) => document.getElementById(id);

  const state = {
    centerCode: null,
    center: null,
    supplies: [],
    orders: [],
    cart: new Map(), // supplyId -> qty
    activeCategory: 'الكل',
    search: '',
    activeTab: 'catalog',
    priority: 'normal',
    selectedMissionId: null,
    sse: null,
    simTimer: null,
    simStageIdx: 0,
    heroAnimated: false,
    catalogInitialRendered: false,
    lastLiveStageKey: null,
    checkoutSheetCtrl: null
  };

  // ─── Theme Toggle with SVG Icon Morphing ─────────────────
  function initTheme() {
    const saved = localStorage.getItem('emdad_theme') || 'light';
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeBtn();
    $('btn-theme-toggle').addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('emdad_theme', isDark ? 'light' : 'dark');
      updateThemeBtn();
      UI.springScalePop($('btn-theme-toggle'));
    });
  }

  function updateThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    $('btn-theme-toggle').innerHTML = UI.getThemeMorphMarkup(isDark, true);
  }

  // ─── Extract Center Code From URL ────────────────────────
  function getCenterCodeFromUrl() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if ((parts[0] === 'c' || parts[0] === 'center' || parts[0] === 'order') && parts[1]) {
      return decodeURIComponent(parts[1]);
    }
    const qs = new URLSearchParams(window.location.search).get('center');
    return qs || null;
  }

  // ─── Load Center Picker ──────────────────────────────────
  async function showCenterPicker() {
    $('view-loading').style.display = 'none';
    $('view-portal').style.display = 'none';
    $('view-picker').style.display = 'block';
    $('picker-hero-svg').innerHTML = M.renderHeroMotionScene();

    const res = await fetch('/api/public/centers').then((r) => r.json());
    const list = $('center-picker-list');
    if (!res.ok || !res.centers.length) {
      list.innerHTML = `<div class="card" style="padding:32px;text-align:center;">لا توجد مراكز مفعلة حالياً. أضف مركزاً من لوحة التحكم.</div>`;
      return;
    }

    const tones = ['tone-sage', 'tone-peach', 'tone-honey', 'tone-periwinkle'];
    list.innerHTML = res.centers.map((c, idx) => `
      <a href="/c/${encodeURIComponent(c.code)}" class="card center-pick-card magnifier-surface hover-lift">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="supply-thumb ${tones[idx % tones.length]}" style="width:52px;height:52px;font-size:1.45rem;">🏥</div>
          <div style="min-width:0;">
            <div style="font-weight:900;font-size:0.98rem;">${M.escapeHtml(c.name)}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">${M.escapeHtml(c.branch || c.address || 'الفرع الرئيسي')}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;padding-top:10px;border-top:1px solid var(--border-soft);">
          <span style="font-size:0.8rem;color:var(--text-secondary);">👤 ${M.escapeHtml(c.manager_name || 'مدير المركز')}</span>
          <span class="btn btn-primary btn-xs">دخول البوابة ←</span>
        </div>
      </a>
    `).join('');

    UI.animateHeroMaskWipe($('view-picker').querySelector('.hero-motion-card'));
    UI.animateStaggerReveal(list.querySelectorAll('.center-pick-card'), { y: 18, stagger: 0.055 });
  }

  // ─── Load Specific Center Data ───────────────────────────
  async function loadCenter(code, silent = false) {
    state.centerCode = code;
    const url = `/api/public/center/${encodeURIComponent(code)}${silent ? '?silent=1' : ''}`;
    const res = await fetch(url).then((r) => r.json());

    if (!res.ok) {
      M.showToast('المركز غير موجود', res.error || 'تأكد من صحة كود QR', 'error');
      return showCenterPicker();
    }

    state.center = res.center;
    state.supplies = res.supplies || [];
    state.orders = res.orders || [];

    // Clamp cart quantities if stock changed
    for (const [sid, qty] of state.cart.entries()) {
      const sup = state.supplies.find((s) => s.id === sid);
      if (!sup || sup.available_qty <= 0) state.cart.delete(sid);
      else if (qty > Math.min(sup.available_qty, sup.max_per_order)) {
        state.cart.set(sid, Math.min(sup.available_qty, sup.max_per_order));
      }
    }

    if (!state.selectedMissionId && state.orders.length) {
      state.selectedMissionId = state.orders[0].id;
    }

    $('view-loading').style.display = 'none';
    $('view-picker').style.display = 'none';
    $('view-portal').style.display = 'block';
    $('btn-switch-center').style.display = 'inline-flex';
    $('portal-hero-svg').innerHTML = M.renderHeroMotionScene();

    // Header & Hero
    document.title = `${state.center.name} — إمداد QR`;
    $('hdr-center-name').textContent = state.center.name;
    $('hdr-center-branch').textContent = state.center.branch || state.center.address || 'متصل مباشر بالمخزن';
    $('hero-manager-badge').textContent = `👤 ${state.center.manager_name || 'مدير المركز'}`;
    $('hero-greeting').textContent = `أهلاً ${state.center.manager_name || 'بك'} — جاهزون لتلبية توريدات ${state.center.name}`;

    $('chk-manager').value = state.center.manager_name || '';
    $('chk-phone').value = state.center.phone || '';

    renderHeroStats();
    renderLiveMissionBanner();
    renderCategoryRail();
    renderCatalog({ animate: !state.catalogInitialRendered, scrollReveal: !state.catalogInitialRendered });
    state.catalogInitialRendered = true;
    renderCartBar();
    renderMissionsTab();

    // Sync Animated Segmented Control pill after layout paints
    requestAnimationFrame(() => {
      const activeTabBtn = state.activeTab === 'missions' ? $('tab-missions') : $('tab-catalog');
      UI.syncSegmentedControl($('portal-tabs-track'), activeTabBtn, true);
    });

    if (!state.heroAnimated) {
      state.heroAnimated = true;
      UI.animateHeroMaskWipe($('view-portal').querySelector('.hero-motion-card'));
    }

    if (!state.sse) connectSSE();
  }

  // ─── Real-Time SSE Connection ────────────────────────────
  function connectSSE() {
    if (state.sse) state.sse.close();
    const es = new EventSource(`/api/events?role=center&center=${encodeURIComponent(state.centerCode || '')}`);
    state.sse = es;

    es.addEventListener('connected', () => {
      $('sse-dot').style.background = '#22C55E';
    });

    es.addEventListener('supply:changed', () => {
      loadCenter(state.centerCode, true);
      M.showToast('تحديث فوري للمخزن', 'تم تحديث الأصناف والكميات المتاحة الآن', 'info');
    });

    es.addEventListener('order:updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.center_code === state.centerCode && data.order) {
          const idx = state.orders.findIndex((o) => o.id === data.order.id);
          if (idx >= 0) state.orders[idx] = data.order;
          else state.orders.unshift(data.order);
          state.selectedMissionId = data.order.id;

          if (Array.isArray(data.supplies)) {
            state.supplies = data.supplies.filter((s) => s.is_visible);
          }

          const meta = M.getStageMeta(data.order.status);
          M.playNotificationChime('update');
          M.showToast(`تحديث مهمة #${data.order.order_code}`, `${meta.icon} ${meta.title}`, 'success');
          renderHeroStats();
          renderLiveMissionBanner(true);
          renderCatalog({ animate: false });
          renderMissionsTab(true);
        }
      } catch (_) {}
    });

    es.addEventListener('order:created', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (Array.isArray(data.supplies)) {
          state.supplies = data.supplies.filter((s) => s.is_visible);
          renderHeroStats();
          renderCatalog({ animate: false });
        }
      } catch (_) {}
    });

    es.onerror = () => {
      $('sse-dot').style.background = '#F59E0B';
    };
  }

  // ─── Render Hero Stats & Active Mission Banner ───────────
  function renderHeroStats() {
    const availCount = state.supplies.filter((s) => s.available_qty > 0).length;
    const activeMissions = state.orders.filter((o) => !['delivered', 'rejected'].includes(o.status));
    M.animateCounter($('hero-avail-count'), availCount);
    M.animateCounter($('hero-active-missions'), activeMissions.length);

    const badge = $('tab-missions-badge');
    if (activeMissions.length > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = String(activeMissions.length);
    } else {
      badge.style.display = 'none';
    }
  }

  function renderLiveMissionBanner(morph = false) {
    const active = state.orders.find((o) => !['delivered', 'rejected'].includes(o.status));
    const slot = $('live-mission-banner');
    if (!active) {
      slot.style.display = 'none';
      slot.innerHTML = '';
      state.lastLiveStageKey = null;
      return;
    }

    const stageKey = `${active.id}:${active.status}:${active.progress}`;
    const html = M.renderMissionCinema(active, {
      showItems: true,
      extraActionHtml: `
        <button class="btn btn-soft btn-xs" onclick="window.__openMissionsTab(${active.id})">
          تفاصيل المهمة وسجل المراحل ←
        </button>
      `
    });

    slot.style.display = 'block';
    if (morph || (state.lastLiveStageKey && state.lastLiveStageKey !== stageKey)) {
      UI.morphCinemaTransition(slot, html);
    } else if (state.lastLiveStageKey !== stageKey) {
      slot.innerHTML = html;
      UI.animatePageTransition(slot, 1);
    }
    state.lastLiveStageKey = stageKey;
  }

  window.__openMissionsTab = function (orderId) {
    state.selectedMissionId = orderId;
    switchTab('missions');
  };

  // ─── Render Categories & Supplies Catalog ────────────────
  function renderCategoryRail() {
    const cats = ['الكل', ...new Set(state.supplies.map((s) => s.category))];
    if (!cats.includes(state.activeCategory)) state.activeCategory = 'الكل';

    $('category-rail').innerHTML = cats.map((cat) => {
      const count = cat === 'الكل' ? state.supplies.length : state.supplies.filter((s) => s.category === cat).length;
      return `
        <button class="cat-chip ${state.activeCategory === cat ? 'active' : ''}" data-cat="${M.escapeHtml(cat)}">
          ${M.escapeHtml(cat)} <span style="opacity:0.75;font-size:0.74rem;">(${count})</span>
        </button>
      `;
    }).join('');

    $('category-rail').querySelectorAll('.cat-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeCategory = btn.dataset.cat;
        renderCategoryRail();
        renderCatalog({ animate: true, scrollReveal: false });
      });
    });
  }

  function renderCatalog(opts = {}) {
    const { animate = false, scrollReveal = false, popSupplyId = null } = opts;
    const q = state.search.trim().toLowerCase();
    const filtered = state.supplies.filter((s) => {
      if (state.activeCategory !== 'الكل' && s.category !== state.activeCategory) return false;
      if (q && !(`${s.name} ${s.category} ${s.description} ${s.sku}`).toLowerCase().includes(q)) return false;
      return true;
    });

    const grid = $('supplies-grid');
    if (!filtered.length) {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1;padding:40px 20px;text-align:center;">
          <div style="font-size:2.2rem;margin-bottom:8px;">🔎</div>
          <div style="font-weight:800;">لا توجد توريدات مطابقة لبحثك</div>
          <div style="font-size:0.84rem;color:var(--text-secondary);margin-top:4px;">جرّب اختيار تصنيف آخر أو مسح كلمة البحث</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((s) => {
      const inCartQty = state.cart.get(s.id) || 0;
      const isOut = s.available_qty <= 0;
      const isLow = !isOut && s.available_qty <= s.min_stock;
      const maxAllowed = Math.min(s.available_qty, s.max_per_order || s.available_qty);
      const stockPct = isOut ? 0 : Math.min(100, Math.max(12, Math.round((s.available_qty / Math.max(s.min_stock * 3, 25)) * 100)));
      const stockClass = isOut ? 'stock-zero' : isLow ? 'stock-low' : 'stock-ok';
      const stockLabel = isOut
        ? 'نفذت الكمية مؤقتاً'
        : isLow
          ? `كمية محدودة: ${s.available_qty} ${s.unit}`
          : `متاح بالمخزن: ${s.available_qty} ${s.unit}`;

      const thumbHtml = s.image_url
        ? `<img src="${M.escapeHtml(s.image_url)}" alt="${M.escapeHtml(s.name)}" />`
        : `<span>${s.icon || '📦'}</span>`;

      const actionHtml = isOut
        ? `<button class="btn btn-soft" disabled style="width:100%;">⛔ غير متوفر حالياً</button>`
        : inCartQty > 0
          ? `
            <div class="stepper-control" data-stepper-id="${s.id}">
              <button class="step-btn minus" data-act="dec" data-id="${s.id}" aria-label="إنقاص">−</button>
              <div style="text-align:center;">
                <div class="step-qty" data-qty-id="${s.id}">${inCartQty}</div>
                <div style="font-size:0.68rem;color:var(--text-secondary);line-height:1;">${M.escapeHtml(s.unit)}</div>
              </div>
              <button class="step-btn" data-act="inc" data-id="${s.id}" ${inCartQty >= maxAllowed ? 'disabled style="opacity:0.4;"' : ''} aria-label="زيادة">+</button>
            </div>
          `
          : `<button class="btn btn-primary" data-act="add" data-id="${s.id}" style="width:100%;">+ أضف للطلب</button>`;

      return `
        <article class="supply-card magnifier-surface hover-lift ${inCartQty > 0 ? 'in-cart' : ''} ${isOut ? 'out-of-stock' : ''}" data-card-id="${s.id}">
          <div class="supply-head">
            <div class="supply-thumb tone-${M.escapeHtml(s.badge_tone || 'sage')}">${thumbHtml}</div>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
                <span class="badge badge-${M.escapeHtml(s.badge_tone || 'sage')}" style="font-size:0.7rem;padding:2px 9px;">${M.escapeHtml(s.category)}</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">${M.escapeHtml(s.sku)}</span>
              </div>
              <h3 class="supply-title">${M.escapeHtml(s.name)}</h3>
              ${s.description ? `<p class="supply-desc">${M.escapeHtml(s.description)}</p>` : ''}
            </div>
          </div>

          <div class="stock-box">
            <div class="stock-row">
              <span style="color:${isOut ? 'var(--accent-crimson)' : isLow ? '#B45309' : 'var(--accent-emerald)'};">
                ${isOut ? '🔴' : isLow ? '🟡' : '🟢'} ${stockLabel}
              </span>
              <span style="font-size:0.72rem;color:var(--text-muted);">حد الطلب: ${s.max_per_order}</span>
            </div>
            <div class="stock-bar-bg">
              <div class="stock-bar-fill ${stockClass}" style="width:${stockPct}%;"></div>
            </div>
          </div>

          <div>${actionHtml}</div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const act = btn.dataset.act;
        const sup = state.supplies.find((x) => x.id === id);
        if (!sup) return;
        const maxAllowed = Math.min(sup.available_qty, sup.max_per_order || sup.available_qty);
        const cur = state.cart.get(id) || 0;

        if (act === 'add' || act === 'inc') {
          if (cur >= maxAllowed) {
            M.showToast('وصلت للحد الأقصى', `المتاح للطلب من هذا الصنف هو ${maxAllowed} ${sup.unit}`, 'error');
            return;
          }
          state.cart.set(id, cur + 1);
          if (act === 'add') {
            M.flyItemToCart(btn, $('cart-bar-count'), sup.icon || '📦');
          }
        } else if (act === 'dec') {
          if (cur <= 1) state.cart.delete(id);
          else state.cart.set(id, cur - 1);
        }

        renderCatalog({ animate: false, popSupplyId: id });
        renderCartBar(true);
      });
    });

    if (animate) {
      UI.animateStaggerReveal(grid.querySelectorAll('.supply-card'), {
        y: 16,
        stagger: 0.038,
        scroll: scrollReveal
      });
    }

    // Spring Scale pop on newly morphed stepper or bumped quantity digit
    if (popSupplyId) {
      const qtyEl = grid.querySelector(`[data-qty-id="${popSupplyId}"]`);
      const stepperEl = grid.querySelector(`[data-stepper-id="${popSupplyId}"]`);
      if (qtyEl) UI.springScalePop(qtyEl);
      else if (stepperEl) UI.springScalePop(stepperEl);
    }
  }

  // ─── Cart Bar & GSAP Swipeable Bottom Sheet ──────────────
  function renderCartBar(pop = false) {
    const bar = $('floating-cart-bar');
    let itemsCount = 0;
    let totalUnits = 0;
    for (const qty of state.cart.values()) {
      itemsCount += 1;
      totalUnits += qty;
    }

    if (itemsCount === 0) {
      bar.classList.remove('visible');
      return;
    }

    bar.classList.add('visible');
    $('cart-bar-count').textContent = String(itemsCount);
    $('cart-bar-title').textContent = `${itemsCount} أصناف في طلب التوريد`;
    $('cart-bar-sub').textContent = `إجمالي ${totalUnits} وحدة — اضغط للمراجعة والإرسال`;
    if (pop) UI.springScalePop($('cart-bar-count'));
  }

  function openCheckoutSheet() {
    if (state.cart.size === 0) return;
    renderCheckoutItems();
    state.checkoutSheetCtrl.open();
  }

  function closeCheckoutSheet() {
    state.checkoutSheetCtrl.close();
  }

  function renderCheckoutItems() {
    const list = $('checkout-items-list');
    const rows = [];
    for (const [sid, qty] of state.cart.entries()) {
      const sup = state.supplies.find((s) => s.id === sid);
      if (!sup) continue;
      rows.push(`
        <div class="card" style="padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <span style="font-size:1.4rem;">${sup.icon || '📦'}</span>
            <div style="min-width:0;">
              <div style="font-weight:800;font-size:0.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${M.escapeHtml(sup.name)}</div>
              <div style="font-size:0.74rem;color:var(--text-secondary);">المتاح بالمخزن: ${sup.available_qty} ${M.escapeHtml(sup.unit)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <button class="btn btn-soft btn-xs" data-chk-dec="${sup.id}">−</button>
            <strong style="min-width:26px;text-align:center;">${qty}</strong>
            <button class="btn btn-soft btn-xs" data-chk-inc="${sup.id}">+</button>
          </div>
        </div>
      `);
    }
    list.innerHTML = rows.join('');

    list.querySelectorAll('[data-chk-dec]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.chkDec);
        const cur = state.cart.get(id) || 0;
        if (cur <= 1) state.cart.delete(id);
        else state.cart.set(id, cur - 1);
        renderCatalog({ animate: false });
        renderCartBar(true);
        if (state.cart.size === 0) closeCheckoutSheet();
        else renderCheckoutItems();
      });
    });

    list.querySelectorAll('[data-chk-inc]').forEach((b) => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.chkInc);
        const sup = state.supplies.find((s) => s.id === id);
        if (!sup) return;
        const maxAllowed = Math.min(sup.available_qty, sup.max_per_order || sup.available_qty);
        const cur = state.cart.get(id) || 0;
        if (cur < maxAllowed) {
          state.cart.set(id, cur + 1);
          renderCatalog({ animate: false });
          renderCartBar(true);
          renderCheckoutItems();
        }
      });
    });
  }

  async function submitOrder() {
    if (state.cart.size === 0) return;
    const btn = $('btn-submit-order');
    btn.disabled = true;
    btn.textContent = '⏳ جاري إطلاق مهمة التوريد...';

    const items = [];
    for (const [supply_id, quantity] of state.cart.entries()) {
      items.push({ supply_id, quantity });
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          center_code: state.centerCode,
          manager_name: $('chk-manager').value.trim(),
          phone: $('chk-phone').value.trim(),
          priority: state.priority,
          notes: $('chk-notes').value.trim(),
          items
        })
      }).then((r) => r.json());

      if (!res.ok) {
        M.showToast('تعذر إرسال الطلب', res.error || 'حاول مرة أخرى', 'error');
        btn.disabled = false;
        btn.textContent = '🚀 إطلاق مهمة التوريد الآن';
        return;
      }

      closeCheckoutSheet();
      state.cart.clear();
      $('chk-notes').value = '';
      if (Array.isArray(res.supplies)) state.supplies = res.supplies;
      if (res.order) {
        state.orders.unshift(res.order);
        state.selectedMissionId = res.order.id;
      }

      renderHeroStats();
      renderLiveMissionBanner(true);
      renderCatalog({ animate: false });
      renderCartBar();
      renderMissionsTab(true);

      M.playMissionLaunchOverlay(res.order, () => {
        switchTab('missions');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } catch (err) {
      M.showToast('خطأ في الاتصال', 'تأكد من اتصالك بالشبكة وحاول مجدداً', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 إطلاق مهمة التوريد الآن';
    }
  }

  // ─── Missions Tab ────────────────────────────────────────
  function renderMissionsTab(morph = false) {
    const featured = $('missions-cinema-featured');
    const list = $('missions-history-list');

    if (!state.orders.length) {
      featured.innerHTML = '';
      list.innerHTML = `
        <div class="card" style="padding:40px 20px;text-align:center;">
          <div style="font-size:2.4rem;margin-bottom:8px;">📦</div>
          <div style="font-weight:900;font-size:1.05rem;">لم تقم بإرسال أي طلب توريد بعد</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);margin:6px 0 14px;">اختر التوريدات التي يحتاجها مركزك وشاهد مراحل التجهيز والتوصيل بالأنيمشن</div>
          <button class="btn btn-primary btn-sm" onclick="window.__goCatalog()">تصفح التوريدات المتاحة</button>
        </div>
      `;
      return;
    }

    const selected = state.orders.find((o) => o.id === state.selectedMissionId) || state.orders[0];
    state.selectedMissionId = selected.id;

    const logHtml = Array.isArray(selected.stage_log) && selected.stage_log.length
      ? `
        <div class="card" style="padding:16px;margin-top:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div style="font-weight:900;font-size:0.95rem;">📋 سجل تحركات المهمة #${M.escapeHtml(selected.order_code)}</div>
            <button class="btn btn-soft btn-xs" id="btn-reorder-selected">🔄 إعادة طلب نفس الأصناف</button>
          </div>
          <div class="log-timeline">
            ${selected.stage_log.slice().reverse().map((entry) => `
              <div class="log-entry">
                <div style="font-weight:800;">${M.escapeHtml(entry.label)}</div>
                <div style="color:var(--text-secondary);font-size:0.78rem;">${M.escapeHtml(entry.note || '')}</div>
                <div style="color:var(--text-muted);font-size:0.72rem;margin-top:2px;">🕒 ${M.escapeHtml(entry.time || '')}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '';

    const fullHtml = M.renderMissionCinema(selected, { showItems: true }) + logHtml;
    if (morph) {
      UI.morphCinemaTransition(featured, fullHtml);
      setTimeout(() => {
        const reorderBtn = $('btn-reorder-selected');
        if (reorderBtn) reorderBtn.addEventListener('click', () => reorderMission(selected));
      }, 220);
    } else {
      featured.innerHTML = fullHtml;
      const reorderBtn = $('btn-reorder-selected');
      if (reorderBtn) reorderBtn.addEventListener('click', () => reorderMission(selected));
    }

    list.innerHTML = `
      <div style="font-weight:900;font-size:0.95rem;margin-top:6px;">جميع طلبات المركز (${state.orders.length})</div>
      ${state.orders.map((o) => {
        const meta = M.getStageMeta(o.status);
        const isSel = o.id === selected.id;
        return `
          <div class="card hover-lift" style="padding:14px 16px;cursor:pointer;${isSel ? 'border-color:var(--accent-terracotta);box-shadow:0 6px 20px rgba(231,107,69,0.14);' : ''}" data-select-mission="${o.id}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.3rem;">${meta.icon}</span>
                <div>
                  <div style="font-weight:900;font-size:0.92rem;">مهمة #${M.escapeHtml(o.order_code)} — ${meta.label}</div>
                  <div style="font-size:0.76rem;color:var(--text-secondary);">${o.total_items} أصناف • ${o.total_units} وحدة • ${M.formatRelativeTime(o.created_at)}</div>
                </div>
              </div>
              <span class="badge ${o.status === 'delivered' ? 'badge-sage' : o.status === 'dispatched' ? 'badge-peach' : o.status === 'rejected' ? 'badge-crimson' : 'badge-honey'}">
                ${o.progress}%
              </span>
            </div>
          </div>
        `;
      }).join('')}
    `;

    list.querySelectorAll('[data-select-mission]').forEach((card) => {
      card.addEventListener('click', () => {
        state.selectedMissionId = Number(card.dataset.selectMission);
        renderMissionsTab(true);
        window.scrollTo({ top: 180, behavior: 'smooth' });
      });
    });
  }

  function reorderMission(order) {
    let added = 0;
    for (const it of order.items || []) {
      const sup = state.supplies.find((s) => s.id === it.supply_id);
      if (sup && sup.available_qty > 0) {
        const qty = Math.min(it.quantity, sup.available_qty, sup.max_per_order || sup.available_qty);
        if (qty > 0) {
          state.cart.set(sup.id, qty);
          added++;
        }
      }
    }
    if (added > 0) {
      renderCatalog({ animate: false });
      renderCartBar(true);
      switchTab('catalog');
      M.showToast('تمت إضافة الأصناف للسلة', `تم تجهيز ${added} أصناف جاهزة للإرسال الآن`, 'success');
    } else {
      M.showToast('الأصناف غير متوفرة حالياً', 'الرصيد الحالي لهذه الأصناف صفر بالمخزن', 'error');
    }
  }

  window.__goCatalog = () => switchTab('catalog');

  function switchTab(tab) {
    const prev = state.activeTab;
    state.activeTab = tab;
    $('tab-catalog').classList.toggle('active', tab === 'catalog');
    $('tab-missions').classList.toggle('active', tab === 'missions');
    $('panel-catalog').style.display = tab === 'catalog' ? 'block' : 'none';
    $('panel-missions').style.display = tab === 'missions' ? 'block' : 'none';

    const activeBtn = tab === 'missions' ? $('tab-missions') : $('tab-catalog');
    UI.syncSegmentedControl($('portal-tabs-track'), activeBtn, false);

    if (tab === 'missions') {
      renderMissionsTab(false);
      if (prev !== 'missions') {
        UI.animatePageTransition($('panel-missions'), -1);
      }
    } else if (prev !== 'catalog') {
      UI.animatePageTransition($('panel-catalog'), 1);
    }
  }

  // ─── Interactive Motion Graphics Stage Simulator ─────────
  function openSimModal() {
    state.simStageIdx = 2; // Warehouse packing animation
    renderSimStage(false);
    UI.openModalSpring($('sim-modal'));
  }

  function closeSimModal() {
    clearInterval(state.simTimer);
    state.simTimer = null;
    $('btn-sim-autoplay').textContent = '▶️ تشغيل العرض التلقائي';
    UI.closeModalSpring($('sim-modal'));
  }

  function renderSimStage(morph = true) {
    const st = M.STAGES[state.simStageIdx];
    const progressValues = [15, 36, 62, 84, 100];
    const mockOrder = {
      order_code: 'DEMO-99',
      priority: 'urgent',
      status: st.key,
      progress: progressValues[state.simStageIdx],
      driver_name: 'طارق حسن',
      eta_minutes: 15,
      items: [
        { supply_name: 'أفلام أشعة 14×17', quantity: 5, icon: '🩻' },
        { supply_name: 'صبغة مقطعية Omnipaque', quantity: 4, icon: '🧪' },
        { supply_name: 'قفازات نيتريل طبي', quantity: 8, icon: '🧤' }
      ]
    };
    const html = M.renderMissionCinema(mockOrder, { showItems: true });
    if (morph) UI.morphCinemaTransition($('sim-cinema-slot'), html);
    else $('sim-cinema-slot').innerHTML = html;

    $('sim-stage-buttons').innerHTML = M.STAGES.map((s, idx) => `
      <button class="btn btn-xs ${idx === state.simStageIdx ? 'btn-primary' : 'btn-soft'}" data-sim-idx="${idx}">
        ${s.icon} ${s.short}
      </button>
    `).join('');

    $('sim-stage-buttons').querySelectorAll('[data-sim-idx]').forEach((b) => {
      b.addEventListener('click', () => {
        clearInterval(state.simTimer);
        state.simTimer = null;
        $('btn-sim-autoplay').textContent = '▶️ تشغيل العرض التلقائي';
        state.simStageIdx = Number(b.dataset.simIdx);
        renderSimStage(true);
      });
    });
  }

  // ─── Wire Events & Bootstrap ─────────────────────────────
  function init() {
    UI.initGlobalMicroInteractions();
    initTheme();

    // Populate initial Skeleton Shimmer grid
    const skGrid = $('loading-skeleton-grid');
    if (skGrid) skGrid.innerHTML = UI.renderSkeletonCatalog(6);

    // Initialize GSAP Swipeable Bottom Sheet
    state.checkoutSheetCtrl = UI.initBottomSheet(
      $('checkout-sheet'),
      $('checkout-sheet').querySelector('.sheet-panel')
    );

    $('tab-catalog').addEventListener('click', () => switchTab('catalog'));
    $('tab-missions').addEventListener('click', () => switchTab('missions'));
    $('btn-switch-center').addEventListener('click', () => {
      window.history.pushState({}, '', '/center');
      showCenterPicker();
    });

    $('catalog-search').addEventListener('input', (e) => {
      state.search = e.target.value;
      renderCatalog({ animate: false });
    });

    $('btn-open-checkout').addEventListener('click', openCheckoutSheet);
    $('btn-close-checkout').addEventListener('click', closeCheckoutSheet);
    $('checkout-sheet').addEventListener('click', (e) => {
      if (e.target === $('checkout-sheet')) closeCheckoutSheet();
    });

    $('priority-selector').querySelectorAll('.priority-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.priority = btn.dataset.priority;
        $('priority-selector').querySelectorAll('.priority-opt').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        UI.springScalePop(btn);
      });
    });

    $('btn-submit-order').addEventListener('click', submitOrder);

    $('btn-demo-motion').addEventListener('click', openSimModal);
    $('btn-close-sim').addEventListener('click', closeSimModal);
    $('sim-modal').addEventListener('click', (e) => {
      if (e.target === $('sim-modal')) closeSimModal();
    });

    $('btn-sim-autoplay').addEventListener('click', () => {
      if (state.simTimer) {
        clearInterval(state.simTimer);
        state.simTimer = null;
        $('btn-sim-autoplay').textContent = '▶️ تشغيل العرض التلقائي';
        return;
      }
      state.simStageIdx = 0;
      renderSimStage(true);
      $('btn-sim-autoplay').textContent = '⏸️ إيقاف العرض';
      state.simTimer = setInterval(() => {
        state.simStageIdx = (state.simStageIdx + 1) % M.STAGES.length;
        renderSimStage(true);
      }, 2600);
    });

    const code = getCenterCodeFromUrl();
    if (code) loadCenter(code, false);
    else showCenterPicker();
  }

  init();
})();
