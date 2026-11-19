/* ==========================================================================
   إمداد QR — Admin Control Dashboard (Real-Time SSE + QR + Motion Monitor)
   ========================================================================== */

(function () {
  const M = window.EmdadMotion;
  const UI = window.MotionUI;
  const $ = (id) => document.getElementById(id);

  const state = {
    section: 'overview',
    centerFilter: 'all',
    orderStatusFilter: 'all',
    catalogFilter: 'all',
    catalogSearch: '',
    analyticsRange: '7d',
    selectedOrderId: null,
    baseUrl: window.location.origin,
    lanIp: 'localhost',
    port: 3450,
    settings: {},
    stats: {},
    analytics: { series: [] },
    centers: [],
    supplies: [],
    orders: [],
    qrCache: new Map(),
    sse: null,
    initialAnimated: false
  };

  // ─── Theme & Mobile Sidebar ──────────────────────────────
  function initChrome() {
    UI.initGlobalMicroInteractions();
    const saved = localStorage.getItem('emdad_theme') || 'light';
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeBtn();

    $('btn-admin-theme').addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('emdad_theme', isDark ? 'light' : 'dark');
      updateThemeBtn();
      UI.springScalePop($('btn-admin-theme'));
    });

    const toggleSidebar = (open) => {
      $('admin-sidebar').classList.toggle('open', open);
      $('sidebar-overlay').classList.toggle('open', open);
      $('btn-mobile-menu').classList.toggle('is-open', open);
    };
    $('btn-mobile-menu').addEventListener('click', () => {
      const isOpen = $('admin-sidebar').classList.contains('open');
      toggleSidebar(!isOpen);
    });
    $('sidebar-overlay').addEventListener('click', () => toggleSidebar(false));

    document.querySelectorAll('[data-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchSection(btn.dataset.section);
        toggleSidebar(false);
      });
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });
    document.querySelectorAll('.modal-backdrop').forEach((bg) => {
      bg.addEventListener('click', (e) => {
        if (e.target === bg) UI.closeModalSpring(bg);
      });
    });

    // Arabic today label
    try {
      const dateStr = new Intl.DateTimeFormat('ar-EG', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(new Date());
      $('today-date-label').textContent = `${dateStr} • كل اللي بيحصل في طلبات التوريد والمراكز في مكان واحد`;
    } catch (_) {}

    // Initial sync for Animated Segmented Controls
    requestAnimationFrame(() => {
      const activeSub = $('admin-subnav-track')?.querySelector('.subnav-tab.active');
      if (activeSub) UI.syncSegmentedControl($('admin-subnav-track'), activeSub, true);
      const activeRng = $('analytics-range-btns')?.querySelector('.seg-active');
      if (activeRng) UI.syncSegmentedControl($('analytics-range-btns'), activeRng, true);
    });
  }

  function updateThemeBtn() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    $('btn-admin-theme').innerHTML = UI.getThemeMorphMarkup(isDark, false);
  }

  function openModal(id) { UI.openModalSpring($(id)); }
  function closeModal(id) { UI.closeModalSpring($(id)); }

  function switchSection(sec) {
    const prev = state.section;
    state.section = sec;
    document.querySelectorAll('.admin-section').forEach((el) => {
      el.style.display = el.id === `sec-${sec}` ? 'flex' : 'none';
    });
    document.querySelectorAll('.nav-item[data-section]').forEach((b) => {
      b.classList.toggle('active', b.dataset.section === sec);
    });
    let activeSub = null;
    document.querySelectorAll('.subnav-tab[data-section]').forEach((b) => {
      const isAct = b.dataset.section === sec;
      b.classList.toggle('active', isAct);
      if (isAct) activeSub = b;
    });
    if (activeSub) {
      UI.syncSegmentedControl($('admin-subnav-track'), activeSub, false);
    }

    if (sec === 'orders') renderOrdersSection();
    else if (sec === 'catalog') renderCatalogSection();
    else if (sec === 'centers') renderCentersSection();
    else if (sec === 'settings') renderSettingsSection();
    else renderOverview();

    if (prev !== sec) {
      UI.animatePageTransition($(`sec-${sec}`), 1);
    }
  }

  // ─── Bootstrap & Real-Time SSE ───────────────────────────
  async function loadBootstrap() {
    const res = await fetch(`/api/bootstrap?range=${state.analyticsRange}`).then((r) => r.json());
    if (!res.ok) return;

    state.baseUrl = res.baseUrl;
    state.lanIp = res.lanIp;
    state.port = res.port;
    state.settings = res.settings || {};
    state.stats = res.stats || {};
    state.analytics = res.analytics || { series: [] };
    state.centers = res.centers || [];
    state.supplies = res.supplies || [];
    state.orders = res.orders || [];

    if (!state.selectedOrderId && state.orders.length) {
      state.selectedOrderId = state.orders[0].id;
    }

    applyBrandSettings();
    populateCenterFilter();
    renderBadges();
    renderCurrentSection();
  }

  function applyBrandSettings() {
    $('sb-brand-name').textContent = state.settings.brand_name || 'إمداد QR';
    $('sb-brand-sub').textContent = state.settings.brand_subtitle || 'إدارة التوريدات والمراكز';
  }

  function populateCenterFilter() {
    const sel = $('global-center-filter');
    const current = sel.value || 'all';
    sel.innerHTML = `<option value="all">🏥 كل المراكز المتصلة (${state.centers.length})</option>` +
      state.centers.map((c) => `<option value="${c.id}">🏥 ${M.escapeHtml(c.name)} ${c.branch ? `— ${M.escapeHtml(c.branch)}` : ''}</option>`).join('');
    sel.value = current;
  }

  function connectSSE() {
    if (state.sse) state.sse.close();
    const es = new EventSource('/api/events?role=admin');
    state.sse = es;

    es.addEventListener('connected', () => {
      $('admin-sse-dot').style.background = '#22C55E';
    });

    es.addEventListener('order:created', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.order) {
          state.orders.unshift(data.order);
          state.selectedOrderId = data.order.id;
        }
        if (data.stats) state.stats = data.stats;
        if (data.analytics) state.analytics = data.analytics;
        if (Array.isArray(data.supplies)) {
          // merge updated stock
          for (const upd of data.supplies) {
            const idx = state.supplies.findIndex((s) => s.id === upd.id);
            if (idx >= 0) state.supplies[idx] = upd;
          }
        }
        if (state.settings.sound_alerts !== 'false') {
          M.playNotificationChime('order');
        }
        M.showToast(
          `🔔 طلب توريد جديد #${data.order?.order_code || ''}`,
          `${data.order?.center_name || ''} • ${data.order?.total_items || 0} أصناف (${data.order?.total_units || 0} وحدة)`,
          'success'
        );
        renderBadges();
        renderCurrentSection();
      } catch (_) {}
    });

    es.addEventListener('order:updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.order) {
          const idx = state.orders.findIndex((o) => o.id === data.order.id);
          if (idx >= 0) state.orders[idx] = data.order;
        }
        if (data.stats) state.stats = data.stats;
        if (Array.isArray(data.supplies)) state.supplies = data.supplies;
        renderBadges();
        renderCurrentSection();
      } catch (_) {}
    });

    es.addEventListener('supply:changed', () => {
      loadBootstrap();
    });

    es.addEventListener('scan:recorded', (e) => {
      try {
        const data = JSON.parse(e.data);
        const c = state.centers.find((x) => x.id === data.center_id);
        if (c) c.scan_count = data.scan_count;
        if (data.analytics && state.analyticsRange === '7d') state.analytics = data.analytics;
        M.showToast('📱 مسح كود QR مباشر', `تم فتح بوابة ${data.center_name || 'المركز'} الآن`, 'info');
        if (state.section === 'overview') renderAnalytics();
        if (state.section === 'centers') renderCentersSection();
      } catch (_) {}
    });

    es.onerror = () => {
      $('admin-sse-dot').style.background = '#F59E0B';
    };
  }

  function renderCurrentSection() {
    if (state.section === 'overview') renderOverview();
    else if (state.section === 'orders') renderOrdersSection();
    else if (state.section === 'catalog') renderCatalogSection();
    else if (state.section === 'centers') renderCentersSection();
    else if (state.section === 'settings') renderSettingsSection();
  }

  function getFilteredOrders() {
    return state.orders.filter((o) => {
      if (state.centerFilter !== 'all' && String(o.center_id) !== String(state.centerFilter)) return false;
      return true;
    });
  }

  function renderBadges() {
    const s = state.stats;
    const pending = s.pendingCount || 0;
    const lowOrOut = (s.lowStockCount || 0) + (s.outOfStockCount || 0);
    const totalAlerts = pending + lowOrOut;

    $('top-alerts-count').textContent = String(totalAlerts);
    const ob = $('nav-orders-badge');
    ob.style.display = pending > 0 ? 'grid' : 'none';
    ob.textContent = String(pending);

    const lb = $('nav-lowstock-badge');
    lb.style.display = lowOrOut > 0 ? 'grid' : 'none';
    lb.textContent = String(lowOrOut);
  }

  // ─── SECTION 1: OVERVIEW ─────────────────────────────────
  function renderOverview() {
    const s = state.stats;
    const filteredOrders = getFilteredOrders();

    // Department / Status Alerts Strip
    const pills = [
      { label: 'طلبات جديدة', count: s.pendingCount || 0, cls: 'pill-peach', action: () => jumpOrders('pending') },
      { label: 'قيد التجهيز', count: s.preparingCount || 0, cls: 'pill-honey', action: () => jumpOrders('preparing') },
      { label: 'في الطريق للتسليم', count: s.dispatchedCount || 0, cls: 'pill-periwinkle', action: () => jumpOrders('dispatched') },
      { label: 'مهام مكتملة', count: s.deliveredCount || 0, cls: 'pill-sage', action: () => jumpOrders('delivered') },
      { label: 'نواقص المخزون', count: (s.lowStockCount || 0) + (s.outOfStockCount || 0), cls: 'pill-peach', action: () => jumpCatalog('low') },
      { label: 'مسح كود QR', count: state.analytics.scansTotal || 0, cls: 'pill-honey', action: () => switchSection('centers') }
    ];

    $('total-alerts-meta').textContent = `إشعارات تحتاج متابعة: ${(s.pendingCount || 0) + (s.lowStockCount || 0) + (s.outOfStockCount || 0)}`;
    $('dept-alerts-grid').innerHTML = pills.map((p, idx) => `
      <div class="dept-alert-pill ${p.cls}" data-pill-idx="${idx}">
        <span>${p.label}</span>
        <span class="badge ${p.count > 0 && idx === 0 ? 'badge-crimson' : ''}" style="${p.count > 0 && idx !== 0 ? 'background:rgba(31,26,22,0.12);' : ''}">
          ${p.count}
        </span>
      </div>
    `).join('');

    $('dept-alerts-grid').querySelectorAll('[data-pill-idx]').forEach((el) => {
      el.addEventListener('click', () => pills[Number(el.dataset.pillIdx)].action());
    });

    // 4 Pastel KPI Cards
    M.animateCounter($('kpi-orders-today'), s.ordersToday || 0);
    $('kpi-orders-today-meta').textContent = `${s.totalUnitsOrderedToday || 0} وحدة مطلوبة اليوم`;

    M.animateCounter($('kpi-active-missions'), s.activeMissions || 0);
    $('kpi-active-meta').textContent = `${s.preparingCount || 0} تجهيز • ${s.dispatchedCount || 0} بالطريق`;

    M.animateCounter($('kpi-supplies-count'), s.totalSupplies || 0);
    $('kpi-supplies-meta').textContent = `${s.totalUnitsStock || 0} وحدة متاحة • ${s.lowStockCount || 0} كمية محدودة`;

    M.animateCounter($('kpi-pending-count'), s.pendingCount || 0);
    $('kpi-pending-meta').textContent = `${s.activeCenters || 0} مراكز متصلة ببوابة QR`;

    // Featured Live Active Mission Cinema
    const liveMission = filteredOrders.find((o) => !['delivered', 'rejected'].includes(o.status)) || filteredOrders[0];
    const lmSlot = $('overview-live-mission');
    if (liveMission) {
      const nextBtn = getNextStageQuickButton(liveMission);
      lmSlot.innerHTML = M.renderMissionCinema(liveMission, {
        showCenter: true,
        showItems: true,
        extraActionHtml: `
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${nextBtn}
            <button class="btn btn-soft btn-xs" onclick="window.__inspectOrder(${liveMission.id})">إدارة المهمة ←</button>
          </div>
        `
      });
    } else {
      lmSlot.innerHTML = '';
    }

    // Follow-up Panel
    const pendingOrders = filteredOrders.filter((o) => o.status === 'pending' || o.status === 'preparing');
    const lowSupplies = state.supplies.filter((x) => x.available_qty <= x.min_stock);
    const fu = $('followup-list');
    const itemsHtml = [];

    pendingOrders.slice(0, 4).forEach((o) => {
      const meta = M.getStageMeta(o.status);
      itemsHtml.push(`
        <div class="followup-item" onclick="window.__inspectOrder(${o.id})" style="border-right-color:${o.status === 'pending' ? 'var(--accent-crimson)' : 'var(--accent-terracotta)'};">
          <div style="min-width:0;">
            <div style="font-weight:800;font-size:0.86rem;">${meta.icon} ${M.escapeHtml(o.center_name)}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">#${M.escapeHtml(o.order_code)} • ${o.total_items} أصناف • ${M.formatRelativeTime(o.created_at)}</div>
          </div>
          <span class="badge ${o.status === 'pending' ? 'badge-crimson' : 'badge-honey'}">${meta.short}</span>
        </div>
      `);
    });

    lowSupplies.slice(0, 3).forEach((sup) => {
      itemsHtml.push(`
        <div class="followup-item" onclick="window.__jumpCatalogLow()" style="border-right-color:#D97706;">
          <div style="min-width:0;">
            <div style="font-weight:800;font-size:0.86rem;">${sup.icon || '📦'} ${M.escapeHtml(sup.name)}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);">المتبقي بالمخزن: ${sup.available_qty} ${M.escapeHtml(sup.unit)} فقط</div>
          </div>
          <span class="badge ${sup.available_qty <= 0 ? 'badge-crimson' : 'badge-honey'}">${sup.available_qty <= 0 ? 'نافذ' : 'نقص'}</span>
        </div>
      `);
    });

    fu.innerHTML = itemsHtml.length
      ? itemsHtml.join('')
      : `<div style="text-align:center;padding:24px 10px;color:var(--text-secondary);font-size:0.86rem;">✨ كل الطلبات والمخزون في حالة ممتازة الآن</div>`;

    renderAnalytics();

    if (!state.initialAnimated) {
      state.initialAnimated = true;
      UI.animateStaggerReveal(document.querySelectorAll('#admin-kpi-grid .kpi-card'), { y: 18, stagger: 0.06 });
      UI.animateStaggerReveal(document.querySelectorAll('#dept-alerts-grid .dept-alert-pill'), { y: 12, stagger: 0.035 });
    }
  }

  function renderAnalytics() {
    const a = state.analytics || {};
    $('analytics-mini-stats').innerHTML = `
      <div class="chart-mini-box">
        <div style="font-size:0.74rem;color:var(--text-secondary);font-weight:700;">النهارده</div>
        <div style="font-size:1.35rem;font-weight:900;">${a.scansToday ?? 0}</div>
      </div>
      <div class="chart-mini-box">
        <div style="font-size:0.74rem;color:var(--text-secondary);font-weight:700;">امبارح</div>
        <div style="font-size:1.35rem;font-weight:900;">${a.scansYesterday ?? 0}</div>
      </div>
      <div class="chart-mini-box">
        <div style="font-size:0.74rem;color:var(--text-secondary);font-weight:700;">آخر 7 أيام</div>
        <div style="font-size:1.35rem;font-weight:900;">${a.scans7d ?? 0}</div>
      </div>
      <div class="chart-mini-box">
        <div style="font-size:0.74rem;color:var(--text-secondary);font-weight:700;">الإجمالي</div>
        <div style="font-size:1.35rem;font-weight:900;color:var(--accent-terracotta);">${a.scansTotal ?? 0}</div>
      </div>
    `;

    const series = a.series || [];
    const maxVal = Math.max(4, ...series.map((d) => Math.max(d.scans || 0, d.orders || 0)));
    const w = 680;
    const h = 205;
    const padL = 28;
    const padR = 16;
    const padT = 18;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const step = plotW / Math.max(series.length, 1);

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((r) => {
      const y = padT + plotH - r * plotH;
      const val = Math.round(r * maxVal);
      return `
        <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--border-soft)" stroke-dasharray="4 4"/>
        <text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${val}</text>
      `;
    }).join('');

    const bars = series.map((d, i) => {
      const cx = padL + i * step + step / 2;
      const scanH = ((d.scans || 0) / maxVal) * plotH;
      const ordH = ((d.orders || 0) / maxVal) * plotH;
      const bw = Math.min(20, step * 0.34);
      return `
        <g>
          <rect x="${cx - bw - 2}" y="${padT + plotH - scanH}" width="${bw}" height="${Math.max(2, scanH)}" rx="5" fill="#E76B45" fill-opacity="0.88">
            <title>${d.label}: ${d.scans} مسح QR</title>
          </rect>
          <rect x="${cx + 2}" y="${padT + plotH - ordH}" width="${bw}" height="${Math.max(2, ordH)}" rx="5" fill="#694938" fill-opacity="0.72">
            <title>${d.label}: ${d.orders} طلب توريد</title>
          </rect>
          <text x="${cx}" y="${h - 10}" text-anchor="middle" fill="var(--text-secondary)" font-size="10.5" font-weight="700">${M.escapeHtml(d.label)}</text>
        </g>
      `;
    }).join('');

    $('analytics-chart-slot').innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%;">
        ${gridLines}
        ${bars}
      </svg>
      <div style="display:flex;gap:14px;justify-content:center;font-size:0.75rem;color:var(--text-secondary);margin-top:-6px;">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#E76B45;margin-left:5px;"></i>مسح كود QR</span>
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#694938;margin-left:5px;"></i>طلبات التوريد</span>
      </div>
    `;
  }

  function jumpOrders(status) {
    state.orderStatusFilter = status;
    switchSection('orders');
  }
  function jumpCatalog(filter) {
    state.catalogFilter = filter;
    switchSection('catalog');
  }
  window.__jumpCatalogLow = () => jumpCatalog('low');
  window.__inspectOrder = (id) => {
    state.selectedOrderId = id;
    switchSection('orders');
  };

  // ─── SECTION 2: ORDERS & LIVE MISSIONS CONTROL ───────────
  function getNextStageQuickButton(order) {
    if (order.status === 'pending') {
      return `<button class="btn btn-primary btn-xs" onclick="window.__advanceOrder(${order.id}, 'approved')">✅ اعتماد الطلب</button>`;
    }
    if (order.status === 'approved') {
      return `<button class="btn btn-primary btn-xs" onclick="window.__advanceOrder(${order.id}, 'preparing')">📦 بدء التجهيز والتعبئة</button>`;
    }
    if (order.status === 'preparing') {
      return `<button class="btn btn-primary btn-xs" onclick="window.__openDispatch(${order.id})">🚚 خروج مع المندوب</button>`;
    }
    if (order.status === 'dispatched') {
      return `<button class="btn btn-primary btn-xs" style="background:var(--accent-emerald);" onclick="window.__advanceOrder(${order.id}, 'delivered')">🎉 تأكيد التسليم</button>`;
    }
    return '';
  }

  window.__advanceOrder = async function (orderId, nextStatus, extra = {}) {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, ...extra })
    }).then((r) => r.json());

    if (!res.ok) {
      M.showToast('خطأ في التحديث', res.error || '', 'error');
      return;
    }
    const meta = M.getStageMeta(nextStatus);
    M.showToast(`تم تحديث المهمة #${res.order.order_code}`, `${meta.icon} ${meta.title} — تم تحديث شاشة المركز فوراً`, 'success');
  };

  window.__openDispatch = function (orderId) {
    $('df-order-id').value = String(orderId);
    openModal('dispatch-modal');
  };

  function renderOrdersSection() {
    $('orders-status-filters').querySelectorAll('[data-ostatus]').forEach((b) => {
      const active = b.dataset.ostatus === state.orderStatusFilter;
      b.className = `btn btn-xs ${active ? 'btn-ink' : 'btn-soft'}`;
    });

    const filtered = getFilteredOrders().filter((o) => {
      if (state.orderStatusFilter !== 'all' && o.status !== state.orderStatusFilter) return false;
      return true;
    });

    const listCol = $('orders-list-col');
    if (!filtered.length) {
      listCol.innerHTML = `<div class="card" style="padding:36px;text-align:center;color:var(--text-secondary);">لا توجد طلبات في هذا القسم حالياً</div>`;
      $('order-inspector-col').innerHTML = '';
      return;
    }

    if (!filtered.some((o) => o.id === state.selectedOrderId)) {
      state.selectedOrderId = filtered[0].id;
    }

    listCol.innerHTML = filtered.map((o) => {
      const meta = M.getStageMeta(o.status);
      const pr = M.PRIORITY_MAP[o.priority] || M.PRIORITY_MAP.normal;
      const isSel = o.id === state.selectedOrderId;
      return `
        <div class="order-card ${isSel ? 'selected' : ''}" data-oid="${o.id}">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.25rem;">${meta.icon}</span>
              <div>
                <div style="font-weight:900;font-size:0.96rem;">#${M.escapeHtml(o.order_code)} — ${M.escapeHtml(o.center_name)}</div>
                <div style="font-size:0.76rem;color:var(--text-secondary);">👤 ${M.escapeHtml(o.manager_name || 'مدير المركز')} • ${M.formatRelativeTime(o.created_at)}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <span class="badge ${pr.badge}">${pr.icon} ${pr.label}</span>
              <span class="badge ${o.status === 'delivered' ? 'badge-sage' : o.status === 'pending' ? 'badge-crimson' : 'badge-honey'}">${meta.short}</span>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
            ${(o.items || []).map((it) => `
              <span class="badge badge-sage" style="font-size:0.74rem;">${it.icon || '📦'} ${M.escapeHtml(it.supply_name)} ×${it.quantity}</span>
            `).join('')}
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid var(--border-soft);flex-wrap:wrap;">
            <span style="font-size:0.78rem;color:var(--text-secondary);">إجمالي ${o.total_items} أصناف (${o.total_units} وحدة)</span>
            <div style="display:flex;gap:6px;" onclick="event.stopPropagation()">
              ${getNextStageQuickButton(o)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listCol.querySelectorAll('[data-oid]').forEach((card) => {
      card.addEventListener('click', () => {
        state.selectedOrderId = Number(card.dataset.oid);
        renderOrdersSection();
      });
    });

    const selected = filtered.find((o) => o.id === state.selectedOrderId) || filtered[0];
    renderOrderInspector(selected);
  }

  function renderOrderInspector(order) {
    const col = $('order-inspector-col');
    if (!order) { col.innerHTML = ''; return; }

    const canCancel = !['delivered', 'rejected'].includes(order.status);

    col.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;">
        ${M.renderMissionCinema(order, { showCenter: true, showItems: false })}

        <div class="card" style="padding:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <h3 style="font-weight:900;font-size:1rem;">🎛️ تحكم في مرحلة المهمة</h3>
            <span style="font-size:0.78rem;color:var(--text-secondary);">#${M.escapeHtml(order.order_code)}</span>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
            ${getNextStageQuickButton(order)}
            ${order.status !== 'preparing' && canCancel ? `<button class="btn btn-soft btn-xs" onclick="window.__advanceOrder(${order.id}, 'preparing')">📦 تحويل للتجهيز</button>` : ''}
            ${order.status !== 'dispatched' && canCancel ? `<button class="btn btn-soft btn-xs" onclick="window.__openDispatch(${order.id})">🚚 إرسال مع مندوب</button>` : ''}
            ${canCancel ? `<button class="btn btn-danger-soft btn-xs" onclick="window.__rejectOrder(${order.id})">↩️ إلغاء وإرجاع المخزون</button>` : ''}
          </div>

          <div style="font-size:0.84rem;background:var(--bg-subtle);padding:12px;border-radius:14px;margin-bottom:12px;">
            <div><strong>المركز:</strong> ${M.escapeHtml(order.center_name)} (${M.escapeHtml(order.center_branch || '')})</div>
            <div><strong>المدير / التواصل:</strong> ${M.escapeHtml(order.manager_name)} • <span dir="ltr">${M.escapeHtml(order.phone || '-')}</span></div>
            ${order.notes ? `<div style="margin-top:6px;color:var(--accent-espresso);"><strong>📝 ملاحظات المركز:</strong> ${M.escapeHtml(order.notes)}</div>` : ''}
          </div>

          <div style="font-weight:800;font-size:0.86rem;margin-bottom:8px;">الأصناف المطلوبة (${order.total_items})</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${(order.items || []).map((it) => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 11px;background:var(--bg-card-elevated);border:1px solid var(--border-soft);border-radius:12px;font-size:0.84rem;">
                <span>${it.icon || '📦'} <strong>${M.escapeHtml(it.supply_name)}</strong></span>
                <span class="badge badge-terracotta">${it.quantity} ${M.escapeHtml(it.unit)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  window.__rejectOrder = async function (id) {
    if (!confirm('هل تريد إلغاء هذه المهمة وإرجاع الكميات المحجوزة إلى رصيد المخزن تلقائياً؟')) return;
    await window.__advanceOrder(id, 'rejected', { admin_note: 'تم إلغاء الطلب من لوحة التحكم وإعادة الأرصدة للمخزن' });
  };

  // ─── SECTION 3: SUPPLIES CATALOG & STOCK CRUD ────────────
  function renderCatalogSection() {
    $('catalog-filter-chips').querySelectorAll('[data-cfilter]').forEach((b) => {
      b.className = `btn btn-xs ${b.dataset.cfilter === state.catalogFilter ? 'btn-ink' : 'btn-soft'}`;
    });

    const q = state.catalogSearch.trim().toLowerCase();
    const list = state.supplies.filter((s) => {
      if (state.catalogFilter === 'available' && s.available_qty <= s.min_stock) return false;
      if (state.catalogFilter === 'low' && !(s.available_qty > 0 && s.available_qty <= s.min_stock)) return false;
      if (state.catalogFilter === 'out' && s.available_qty > 0) return false;
      if (state.catalogFilter === 'hidden' && s.is_visible) return false;
      if (q && !(`${s.name} ${s.category} ${s.sku}`).toLowerCase().includes(q)) return false;
      return true;
    });

    const grid = $('catalog-admin-grid');
    if (!list.length) {
      grid.innerHTML = `<div class="card" style="grid-column:1/-1;padding:36px;text-align:center;color:var(--text-secondary);">لا توجد أصناف مطابقة</div>`;
      return;
    }

    grid.innerHTML = list.map((s) => {
      const isOut = s.available_qty <= 0;
      const isLow = !isOut && s.available_qty <= s.min_stock;
      const thumb = s.image_url
        ? `<img src="${M.escapeHtml(s.image_url)}" style="width:100%;height:100%;object-fit:cover;" />`
        : `<span>${s.icon || '📦'}</span>`;

      return `
        <div class="card admin-supply-card magnifier-surface hover-lift" style="${!s.is_visible ? 'opacity:0.65;' : ''}">
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <div style="width:54px;height:54px;border-radius:15px;display:grid;place-items:center;font-size:1.7rem;flex-shrink:0;overflow:hidden;border:1px solid var(--border-soft);" class="pill-${M.escapeHtml(s.badge_tone || 'sage')}">
              ${thumb}
            </div>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <span class="badge badge-${M.escapeHtml(s.badge_tone || 'sage')}" style="font-size:0.7rem;">${M.escapeHtml(s.category)}</span>
                <span class="badge ${s.is_visible ? 'badge-sage' : 'badge-crimson'}" style="font-size:0.68rem;">${s.is_visible ? 'ظاهر للمراكز' : 'مخفي'}</span>
              </div>
              <div style="font-weight:900;font-size:0.95rem;margin-top:4px;">${M.escapeHtml(s.name)}</div>
              <div style="font-size:0.75rem;color:var(--text-secondary);">${M.escapeHtml(s.description || s.sku)}</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-subtle);padding:10px 12px;border-radius:14px;">
            <div>
              <div style="font-size:0.72rem;color:var(--text-secondary);font-weight:700;">المتاح حالياً</div>
              <div style="font-size:1.2rem;font-weight:900;color:${isOut ? 'var(--accent-crimson)' : isLow ? '#B45309' : 'var(--accent-emerald)'};">
                ${s.available_qty} <span style="font-size:0.78rem;font-weight:700;">${M.escapeHtml(s.unit)}</span>
              </div>
            </div>
            <div style="display:flex;gap:5px;">
              <button class="btn btn-soft btn-xs" onclick="window.__adjStock(${s.id}, -1)" title="إنقاص 1">−1</button>
              <button class="btn btn-soft btn-xs" onclick="window.__adjStock(${s.id}, 1)" title="إضافة 1">+1</button>
              <button class="btn btn-primary btn-xs" onclick="window.__adjStock(${s.id}, 5)" title="تغذية سريعة +5">+5</button>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <button class="btn btn-soft btn-xs" onclick="window.__editSupply(${s.id})">✏️ تعديل</button>
            <button class="btn btn-soft btn-xs" onclick="window.__toggleSupplyVis(${s.id}, ${s.is_visible ? 0 : 1})">
              ${s.is_visible ? '🙈 إخفاء' : '👁️ إظهار'}
            </button>
            <button class="btn btn-danger-soft btn-xs" onclick="window.__deleteSupply(${s.id})">🗑️ حذف</button>
          </div>
        </div>
      `;
    }).join('');

    UI.animateStaggerReveal(grid.querySelectorAll('.admin-supply-card'), { y: 14, stagger: 0.035 });
  }

  window.__adjStock = async (id, delta) => {
    const res = await fetch(`/api/supplies/${id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    }).then((r) => r.json());
    if (res.ok) {
      M.showToast('تم تحديث المخزون لحظياً', `${res.supply.name}: المتاح الآن ${res.supply.available_qty} ${res.supply.unit}`, 'success');
    }
  };

  window.__toggleSupplyVis = async (id, is_visible) => {
    await fetch(`/api/supplies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_visible })
    });
    M.showToast('تم تحديث الظهور', is_visible ? 'الصنف ظاهر الآن على صفحات المراكز' : 'تم إخفاء الصنف عن المراكز', 'info');
  };

  window.__deleteSupply = async (id) => {
    if (!confirm('هل تريد حذف هذا الصنف نهائياً من كتالوج التوريدات؟')) return;
    await fetch(`/api/supplies/${id}`, { method: 'DELETE' });
    M.showToast('تم الحذف', 'تم حذف الصنف من الكتالوج', 'info');
  };

  function openSupplyModal(supply = null) {
    $('supply-modal-title').textContent = supply ? 'تعديل بيانات الصنف' : 'إضافة صنف توريد جديد';
    $('sf-id').value = supply ? supply.id : '';
    $('sf-name').value = supply ? supply.name : '';
    $('sf-category').value = supply ? supply.category : 'مستلزمات طبية';
    $('sf-unit').value = supply ? supply.unit : 'علبة';
    $('sf-qty').value = supply ? supply.available_qty : 25;
    $('sf-min').value = supply ? supply.min_stock : 5;
    $('sf-max').value = supply ? supply.max_per_order : 15;
    $('sf-icon').value = supply ? (supply.icon || '📦') : '📦';
    $('sf-tone').value = supply ? (supply.badge_tone || 'sage') : 'sage';
    $('sf-desc').value = supply ? (supply.description || '') : '';
    $('sf-image-url').value = supply ? (supply.image_url || '') : '';
    $('sf-image-file').value = '';
    $('sf-visible').checked = supply ? Boolean(supply.is_visible) : true;
    openModal('supply-modal');
  }
  window.__editSupply = (id) => {
    const sup = state.supplies.find((s) => s.id === id);
    if (sup) openSupplyModal(sup);
  };

  // ─── SECTION 4: CENTERS & REAL SCANNABLE QR CODES ────────
  async function fetchQrFor(code) {
    if (state.qrCache.has(code)) return state.qrCache.get(code);
    const res = await fetch(`/api/centers/${encodeURIComponent(code)}/qr`).then((r) => r.json());
    if (res.ok) state.qrCache.set(code, res);
    return res;
  }

  async function renderCentersSection() {
    const grid = $('centers-qr-grid');
    grid.innerHTML = state.centers.map((c) => `
      <div class="card magnifier-surface hover-lift center-qr-card" style="padding:18px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-weight:900;font-size:1.02rem;">🏥 ${M.escapeHtml(c.name)}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);">${M.escapeHtml(c.branch || c.address || '')}</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:3px;">👤 ${M.escapeHtml(c.manager_name || 'مدير المركز')} • ${M.escapeHtml(c.phone || '')}</div>
          </div>
          <span class="badge badge-honey">📱 ${c.scan_count || 0} مسح</span>
        </div>

        <div class="qr-preview-box" id="qr-slot-${M.escapeHtml(c.code)}">
          <div class="skeleton" style="width:170px;height:170px;border-radius:14px;"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;">
          <button class="btn btn-primary btn-xs" onclick="window.__openQrPoster('${M.escapeHtml(c.code)}', '${M.escapeHtml(c.name)}', '${M.escapeHtml(c.branch || '')}')">🖨️ بوستر QR للطباعة</button>
          <a class="btn btn-ink btn-xs" href="/c/${encodeURIComponent(c.code)}" target="_blank">📱 فتح صفحة المركز ↗</a>
          <button class="btn btn-soft btn-xs" onclick="window.__copyCenterLink('${M.escapeHtml(c.code)}')">📋 نسخ الرابط</button>
          <button class="btn btn-soft btn-xs" onclick="window.__shareWhatsapp('${M.escapeHtml(c.code)}', '${M.escapeHtml(c.name)}')">💬 إرسال واتساب</button>
        </div>

        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border-soft);">
          <button class="btn btn-soft btn-xs" onclick="window.__editCenter(${c.id})">✏️ تعديل البيانات</button>
          <button class="btn btn-danger-soft btn-xs" onclick="window.__deleteCenter(${c.id})">🗑️ حذف</button>
        </div>
      </div>
    `).join('');

    UI.animateStaggerReveal(grid.querySelectorAll('.center-qr-card'), { y: 16, stagger: 0.05 });

    for (const c of state.centers) {
      const qr = await fetchQrFor(c.code);
      const slot = document.getElementById(`qr-slot-${c.code}`);
      if (slot && qr?.ok) {
        slot.innerHTML = `
          <div class="qr-scan-frame">
            ${qr.svg}
            <span class="qr-scan-beam" aria-hidden="true"></span>
          </div>
          <div dir="ltr" style="font-size:0.72rem;color:var(--text-secondary);word-break:break-all;text-align:center;">${M.escapeHtml(qr.url)}</div>
        `;
      }
    }
  }

  window.__openQrPoster = async (code, name, branch) => {
    const qr = await fetchQrFor(code);
    if (!qr?.ok) return;
    $('qr-modal-title').textContent = code === 'all' ? 'كود QR عام لجميع المراكز' : `كود QR — ${name}`;
    $('qr-poster-name').textContent = name;
    $('qr-poster-branch').textContent = branch || 'امسح الكود لفتح بوابة طلب التوريدات المباشرة';
    $('qr-poster-svg').innerHTML = qr.svg;
    $('qr-poster-url').textContent = qr.url;
    $('btn-qr-download').href = qr.pngDataUrl;
    $('btn-qr-download').download = `emdad-qr-${code}.png`;
    $('btn-qr-open').href = code === 'all' ? '/center' : `/c/${encodeURIComponent(code)}`;
    $('btn-qr-copy').onclick = () => {
      navigator.clipboard?.writeText(qr.url);
      M.showToast('تم نسخ الرابط', qr.url, 'success');
    };
    openModal('qr-modal');
  };

  window.__copyCenterLink = async (code) => {
    const qr = await fetchQrFor(code);
    if (qr?.url) {
      await navigator.clipboard?.writeText(qr.url);
      M.showToast('تم نسخ رابط المركز', qr.url, 'success');
    }
  };

  window.__shareWhatsapp = async (code, name) => {
    const qr = await fetchQrFor(code);
    if (!qr?.url) return;
    const text = `مرحباً، هذا رابط بوابة إمداد QR الخاصة بـ (${name}) لطلب التوريدات ومتابعة تجهيز الشحنة مباشرة:\n${qr.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  function openCenterModal(center = null) {
    $('center-modal-title').textContent = center ? 'تعديل بيانات المركز' : 'إضافة مركز طبي جديد';
    $('cf-id').value = center ? center.id : '';
    $('cf-name').value = center ? center.name : '';
    $('cf-branch').value = center ? (center.branch || '') : '';
    $('cf-code').value = center ? center.code : '';
    $('cf-code').disabled = Boolean(center);
    $('cf-manager').value = center ? (center.manager_name || '') : '';
    $('cf-phone').value = center ? (center.phone || '') : '';
    $('cf-address').value = center ? (center.address || '') : '';
    openModal('center-modal');
  }
  window.__editCenter = (id) => {
    const c = state.centers.find((x) => x.id === id);
    if (c) openCenterModal(c);
  };
  window.__deleteCenter = async (id) => {
    if (!confirm('هل تريد حذف هذا المركز وجميع طلباته؟')) return;
    await fetch(`/api/centers/${id}`, { method: 'DELETE' });
    state.qrCache.clear();
    loadBootstrap();
    M.showToast('تم حذف المركز', '', 'info');
  };

  // ─── SECTION 5: SETTINGS ─────────────────────────────────
  function renderSettingsSection() {
    $('set-brand-name').value = state.settings.brand_name || 'إمداد QR';
    $('set-brand-sub').value = state.settings.brand_subtitle || 'إدارة التوريدات الذكية للمراكز';
    $('set-base-url').value = state.settings.public_base_url || '';
    $('set-sound-alerts').checked = state.settings.sound_alerts !== 'false';
    $('set-show-out').checked = state.settings.show_out_of_stock !== 'false';
    $('set-lan-hint').innerHTML = `الرابط التلقائي الحالي للشبكة المحلية (لمسح QR من الموبايل على نفس الـ Wi-Fi): <strong dir="ltr">${M.escapeHtml(state.baseUrl)}</strong>`;
  }

  // ─── Event Wiring ────────────────────────────────────────
  function bindEvents() {
    $('global-center-filter').addEventListener('change', (e) => {
      state.centerFilter = e.target.value;
      renderCurrentSection();
    });

    $('btn-top-alerts').addEventListener('click', () => jumpOrders('pending'));
    $('btn-quick-qr').addEventListener('click', () => window.__openQrPoster('all', 'بوابة إمداد QR — جميع المراكز', 'اختر مركزك بعد مسح الكود واطلب توريداتك'));
    $('btn-general-qr-card').addEventListener('click', () => window.__openQrPoster('all', 'بوابة إمداد QR — جميع المراكز', 'اختر مركزك بعد مسح الكود واطلب توريداتك'));

    $('btn-add-supply-top').addEventListener('click', () => openSupplyModal());
    $('btn-overview-add-supply').addEventListener('click', () => openSupplyModal());
    $('btn-catalog-add').addEventListener('click', () => openSupplyModal());

    $('btn-add-center-top').addEventListener('click', () => openCenterModal());
    $('btn-centers-add').addEventListener('click', () => openCenterModal());
    $('btn-qr-print').addEventListener('click', () => window.print());

    // Analytics range tabs (Animated Segmented Control)
    $('analytics-range-btns').querySelectorAll('[data-range]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.analyticsRange = btn.dataset.range;
        $('analytics-range-btns').querySelectorAll('[data-range]').forEach((b) => {
          b.classList.toggle('seg-active', b === btn);
        });
        UI.syncSegmentedControl($('analytics-range-btns'), btn, false);
        const res = await fetch(`/api/analytics?range=${state.analyticsRange}`).then((r) => r.json());
        if (res.ok) {
          state.analytics = res.analytics;
          renderAnalytics();
        }
      });
    });

    // Orders status filters
    $('orders-status-filters').querySelectorAll('[data-ostatus]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.orderStatusFilter = btn.dataset.ostatus;
        renderOrdersSection();
      });
    });

    // Catalog filters & search
    $('catalog-filter-chips').querySelectorAll('[data-cfilter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.catalogFilter = btn.dataset.cfilter;
        renderCatalogSection();
      });
    });
    $('admin-supply-search').addEventListener('input', (e) => {
      state.catalogSearch = e.target.value;
      renderCatalogSection();
    });

    // Quick icon picker inside supply modal
    $('icon-quick-picks').querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => { $('sf-icon').value = b.textContent.trim(); });
    });

    // Image file compression for supply item
    $('sf-image-file').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 240;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          $('sf-image-url').value = canvas.toDataURL('image/jpeg', 0.8);
          M.showToast('تم تجهيز صورة الصنف', '', 'success');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    // Save Supply Form
    $('supply-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('sf-id').value;
      const payload = {
        name: $('sf-name').value.trim(),
        category: $('sf-category').value.trim(),
        unit: $('sf-unit').value.trim(),
        available_qty: Number($('sf-qty').value),
        min_stock: Number($('sf-min').value),
        max_per_order: Number($('sf-max').value),
        icon: $('sf-icon').value.trim() || '📦',
        badge_tone: $('sf-tone').value,
        description: $('sf-desc').value.trim(),
        image_url: $('sf-image-url').value,
        is_visible: $('sf-visible').checked
      };

      const url = id ? `/api/supplies/${id}` : '/api/supplies';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then((r) => r.json());

      if (!res.ok) return M.showToast('خطأ', res.error || 'تعذر الحفظ', 'error');
      closeModal('supply-modal');
      M.showToast(id ? 'تم تعديل الصنف' : 'تم نشر الصنف بنجاح', 'يظهر الصنف والكمية الآن على صفحات جميع المراكز', 'success');
      loadBootstrap();
    });

    // Save Center Form
    $('center-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('cf-id').value;
      const payload = {
        name: $('cf-name').value.trim(),
        branch: $('cf-branch').value.trim(),
        code: $('cf-code').value.trim(),
        manager_name: $('cf-manager').value.trim(),
        phone: $('cf-phone').value.trim(),
        address: $('cf-address').value.trim()
      };
      const url = id ? `/api/centers/${id}` : '/api/centers';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then((r) => r.json());

      if (!res.ok) return M.showToast('خطأ', res.error || 'تعذر حفظ المركز', 'error');
      closeModal('center-modal');
      state.qrCache.clear();
      await loadBootstrap();
      M.showToast('تم حفظ المركز وإنشاء كود QR', res.center?.name || '', 'success');
      if (!id && res.center) {
        switchSection('centers');
        window.__openQrPoster(res.center.code, res.center.name, res.center.branch);
      }
    });

    // Dispatch Form
    $('dispatch-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = Number($('df-order-id').value);
      await window.__advanceOrder(orderId, 'dispatched', {
        driver_name: $('df-driver').value.trim(),
        driver_phone: $('df-phone').value.trim(),
        eta_minutes: Number($('df-eta').value) || 20,
        admin_note: $('df-note').value.trim()
      });
      closeModal('dispatch-modal');
    });

    // Save Settings
    $('btn-save-settings').addEventListener('click', async () => {
      const payload = {
        brand_name: $('set-brand-name').value.trim() || 'إمداد QR',
        brand_subtitle: $('set-brand-sub').value.trim(),
        public_base_url: $('set-base-url').value.trim(),
        sound_alerts: $('set-sound-alerts').checked ? 'true' : 'false',
        show_out_of_stock: $('set-show-out').checked ? 'true' : 'false'
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then((r) => r.json());

      if (res.ok) {
        state.settings = res.settings;
        state.baseUrl = res.baseUrl;
        state.qrCache.clear();
        applyBrandSettings();
        renderSettingsSection();
        M.showToast('تم حفظ الإعدادات', 'تم تحديث روابط أكواد QR بنجاح', 'success');
      }
    });
  }

  initChrome();
  bindEvents();
  loadBootstrap();
  connectSSE();
})();
