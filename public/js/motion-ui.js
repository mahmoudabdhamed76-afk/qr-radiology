/* ==========================================================================
   إمداد QR — GSAP Motion UI Orchestrator (GPU-Friendly & Reduced-Motion Safe)
   Implements: Mask Wipe, Fade In Up, Stagger, Scroll Reveal, Spring Scale,
   Morph, Icon Morphing, Animated Segmented Control, Page Transitions,
   Slide-In, Hover Lift, Ripple, Magnifier Reveal, Bottom Sheet, Skeleton Shimmer
   ========================================================================== */

(function (global) {
  const hasGSAP = () => typeof global.gsap !== 'undefined';
  const hasScrollTrigger = () => typeof global.ScrollTrigger !== 'undefined';

  if (hasGSAP() && hasScrollTrigger()) {
    global.gsap.registerPlugin(global.ScrollTrigger);
  }

  const reducedQuery = global.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = global.matchMedia('(hover: hover) and (pointer: fine)');

  function isReduced() {
    return reducedQuery.matches;
  }

  // ─── 1. Delegated Ripple & Magnifier Reveal ────────────────
  let globalInitDone = false;

  function initGlobalMicroInteractions() {
    if (globalInitDone) return;
    globalInitDone = true;

    // Tactile Ripple on interactive controls
    document.addEventListener('pointerdown', (e) => {
      if (isReduced()) return;
      const target = e.target.closest(
        '.btn:not(:disabled), .cat-chip, .dept-alert-pill, .nav-item, .portal-tab, .subnav-tab, .priority-opt, .icon-pill-btn, .top-pill'
      );
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height, 44);
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      target.classList.add('ripple-host');
      const wave = document.createElement('span');
      wave.className = 'ui-ripple-wave';
      wave.style.width = `${size}px`;
      wave.style.height = `${size}px`;
      wave.style.left = `${x}px`;
      wave.style.top = `${y}px`;
      target.appendChild(wave);
      wave.addEventListener('animationend', () => wave.remove(), { once: true });
      setTimeout(() => wave.remove(), 650);
    }, { passive: true });

    // Subtle Magnifier Reveal spotlight on desktop fine pointers only
    let rafId = null;
    let lastTarget = null;
    let lastX = 0;
    let lastY = 0;

    document.addEventListener('pointermove', (e) => {
      if (isReduced() || !finePointerQuery.matches) return;
      const surface = e.target.closest('.magnifier-surface');
      if (!surface) return;
      lastTarget = surface;
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!lastTarget) return;
        const r = lastTarget.getBoundingClientRect();
        lastTarget.style.setProperty('--mx', `${Math.round(lastX - r.left)}px`);
        lastTarget.style.setProperty('--my', `${Math.round(lastY - r.top)}px`);
      });
    }, { passive: true });
  }

  // ─── 2. Mask Wipe + Fade In Up + Spring Scale Hero ─────────
  function animateHeroMaskWipe(heroEl) {
    if (!heroEl || isReduced() || !hasGSAP()) return;
    const gsap = global.gsap;

    const badges = heroEl.querySelectorAll('.badge');
    const heading = heroEl.querySelector('h1');
    const sub = heroEl.querySelector('p');
    const kpis = heroEl.querySelectorAll('.hero-kpi-pill, #btn-demo-motion');
    const svgCol = heroEl.querySelector('.hero-svg-col');

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (badges.length) {
      tl.fromTo(badges, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.36, stagger: 0.05, clearProps: 'transform,opacity' }, 0);
    }
    if (heading) {
      tl.fromTo(
        heading,
        { clipPath: 'inset(0 0 100% 0)', y: 14, opacity: 0.2 },
        { clipPath: 'inset(0 0 0% 0)', y: 0, opacity: 1, duration: 0.56, ease: 'power4.out', clearProps: 'clipPath,transform,opacity' },
        0.06
      );
    }
    if (sub) {
      tl.fromTo(sub, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, clearProps: 'transform,opacity' }, 0.16);
    }
    if (kpis.length) {
      tl.fromTo(kpis, { y: 12, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, stagger: 0.055, ease: 'back.out(1.4)', clearProps: 'transform,opacity' }, 0.22);
    }
    if (svgCol) {
      tl.fromTo(svgCol, { scale: 0.9, opacity: 0, y: 10 }, { scale: 1, opacity: 1, y: 0, duration: 0.58, ease: 'back.out(1.45)', clearProps: 'transform,opacity' }, 0.1);
    }
  }

  // ─── 3. Stagger & Scroll Reveal (GPU-only transforms) ──────
  function animateStaggerReveal(elements, opts = {}) {
    if (!elements) return;
    const list = typeof elements === 'string' ? Array.from(document.querySelectorAll(elements)) : Array.from(elements);
    if (!list.length || isReduced() || !hasGSAP()) return;

    const gsap = global.gsap;
    const { y = 18, duration = 0.44, stagger = 0.04, scale = 0.98, scroll = false } = opts;

    if (scroll && hasScrollTrigger() && list.length > 4) {
      // Animate visible above-the-fold batch smoothly, and ScrollTrigger-reveal lower cards
      gsap.set(list, { opacity: 0, y, scale });
      global.ScrollTrigger.batch(list, {
        start: 'top 94%',
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration,
            stagger,
            ease: 'power3.out',
            overwrite: true,
            clearProps: 'transform,opacity'
          });
        }
      });
      global.ScrollTrigger.refresh();
      return;
    }

    gsap.fromTo(
      list,
      { opacity: 0, y, scale },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration,
        stagger: Math.min(stagger, 0.045),
        ease: 'power3.out',
        overwrite: true,
        clearProps: 'transform,opacity'
      }
    );
  }

  // ─── 4. Page Transition / Directional Slide-In ─────────────
  function animatePageTransition(el, direction = 1) {
    if (!el || isReduced() || !hasGSAP()) return;
    global.gsap.fromTo(
      el,
      { opacity: 0, x: direction * 16, y: 6 },
      { opacity: 1, x: 0, y: 0, duration: 0.34, ease: 'power3.out', overwrite: true, clearProps: 'transform,opacity' }
    );
  }

  // ─── 5. Animated Segmented Control (RTL-Safe GSAP Pill) ────
  const segmentedRegistry = new WeakMap();

  function syncSegmentedControl(trackEl, activeBtn, instant = false) {
    if (!trackEl || !activeBtn) return;
    trackEl.classList.add('segmented-track', 'has-indicator');

    let indicator = trackEl.querySelector(':scope > .segmented-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'segmented-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      trackEl.prepend(indicator);
    }

    const trackRect = trackEl.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (btnRect.width === 0) return;

    const x = btnRect.left - trackRect.left;
    const y = btnRect.top - trackRect.top;
    const width = btnRect.width;
    const height = btnRect.height;

    const prev = segmentedRegistry.get(trackEl);
    segmentedRegistry.set(trackEl, activeBtn);

    if (instant || !prev || isReduced() || !hasGSAP()) {
      indicator.style.width = `${width}px`;
      indicator.style.height = `${height}px`;
      indicator.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      return;
    }

    global.gsap.to(indicator, {
      x,
      y,
      width,
      height,
      duration: 0.38,
      ease: 'back.out(1.25)',
      overwrite: true
    });
  }

  // Keep segmented indicators aligned on resize
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('.segmented-track.has-indicator').forEach((track) => {
        const active = track.querySelector('button.active, button.seg-active, button.btn-ink');
        if (active) syncSegmentedControl(track, active, true);
      });
    }, 100);
  }, { passive: true });

  // ─── 6. Spring Scale Micro-Pop ─────────────────────────────
  function springScalePop(el, peak = 1.12) {
    if (!el || isReduced() || !hasGSAP()) return;
    global.gsap.fromTo(
      el,
      { scale: 0.88 },
      { scale: 1, duration: 0.42, ease: 'back.out(2.2)', overwrite: true, clearProps: 'transform' }
    );
  }

  // ─── 7. Morph Transition for Mission Cinema Stage Changes ──
  function morphCinemaTransition(slotEl, newHtml) {
    if (!slotEl) return;
    if (isReduced() || !hasGSAP() || !slotEl.innerHTML.trim()) {
      slotEl.innerHTML = newHtml;
      if (!isReduced() && hasGSAP()) {
        global.gsap.fromTo(
          slotEl.firstElementChild || slotEl,
          { opacity: 0, y: 10, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'power3.out', clearProps: 'transform,opacity' }
        );
      }
      return;
    }

    const gsap = global.gsap;
    gsap.to(slotEl, {
      opacity: 0.25,
      scale: 0.988,
      duration: 0.16,
      ease: 'power2.in',
      onComplete: () => {
        slotEl.innerHTML = newHtml;
        gsap.fromTo(
          slotEl,
          { opacity: 0.25, scale: 0.988, y: 6 },
          { opacity: 1, scale: 1, y: 0, duration: 0.38, ease: 'back.out(1.2)', clearProps: 'transform,opacity' }
        );
      }
    });
  }

  // ─── 8. GSAP Spring Bottom Sheet + Mobile Swipe-to-Dismiss ─
  function initBottomSheet(backdropEl, panelEl, onClose) {
    if (!backdropEl || !panelEl) return { open: () => {}, close: () => {} };

    let startY = 0;
    let currentDelta = 0;
    let dragging = false;

    panelEl.addEventListener('touchstart', (e) => {
      if (panelEl.scrollTop > 2) return;
      startY = e.touches[0].clientY;
      currentDelta = 0;
      dragging = true;
      panelEl.classList.add('dragging');
    }, { passive: true });

    panelEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        currentDelta = dy;
        panelEl.style.transform = `translate3d(0, ${dy}px, 0)`;
      }
    }, { passive: true });

    panelEl.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      panelEl.classList.remove('dragging');
      if (currentDelta > 95) {
        close();
      } else if (hasGSAP() && !isReduced()) {
        global.gsap.to(panelEl, { y: 0, duration: 0.36, ease: 'back.out(1.4)', clearProps: 'transform' });
      } else {
        panelEl.style.transform = '';
      }
    });

    function open() {
      backdropEl.classList.add('open');
      if (isReduced() || !hasGSAP()) {
        panelEl.style.transform = '';
        return;
      }
      global.gsap.fromTo(
        panelEl,
        { y: '100%' },
        { y: 0, duration: 0.44, ease: 'power4.out', overwrite: true, clearProps: 'transform' }
      );
    }

    function close() {
      if (isReduced() || !hasGSAP()) {
        backdropEl.classList.remove('open');
        panelEl.style.transform = '';
        if (typeof onClose === 'function') onClose();
        return;
      }
      global.gsap.to(panelEl, {
        y: '100%',
        duration: 0.26,
        ease: 'power3.in',
        overwrite: true,
        onComplete: () => {
          backdropEl.classList.remove('open');
          panelEl.style.transform = '';
          if (typeof onClose === 'function') onClose();
        }
      });
    }

    return { open, close };
  }

  // ─── 9. GSAP Spring Modal Open/Close ───────────────────────
  function openModalSpring(backdropEl) {
    if (!backdropEl) return;
    backdropEl.classList.add('open');
    const box = backdropEl.querySelector('.modal-box');
    if (!box || isReduced() || !hasGSAP()) return;
    global.gsap.fromTo(
      box,
      { opacity: 0, y: 20, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.38, ease: 'back.out(1.4)', overwrite: true, clearProps: 'transform,opacity' }
    );
  }

  function closeModalSpring(backdropEl) {
    if (!backdropEl) return;
    const box = backdropEl.querySelector('.modal-box');
    if (!box || isReduced() || !hasGSAP()) {
      backdropEl.classList.remove('open');
      return;
    }
    global.gsap.to(box, {
      opacity: 0,
      y: 12,
      scale: 0.96,
      duration: 0.2,
      ease: 'power2.in',
      overwrite: true,
      onComplete: () => {
        backdropEl.classList.remove('open');
        global.gsap.set(box, { clearProps: 'transform,opacity' });
      }
    });
  }

  // ─── 10. Icon Morphing: Sun <-> Moon SVG Markup ────────────
  let maskSeq = 0;
  function getThemeMorphMarkup(isDark, hideLabelOnXs = false) {
    const uid = `tm-mask-${++maskSeq}`;
    const label = isDark ? 'نهاري' : 'ليلي';
    return `
      <svg class="morph-theme-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <mask id="${uid}">
            <rect width="24" height="24" fill="white" />
            <circle class="moon-mask-circle" cx="${isDark ? 16 : 26}" cy="${isDark ? 8 : 4}" r="6" fill="black" />
          </mask>
        </defs>
        <circle class="sun-core" cx="12" cy="12" r="5.4" fill="currentColor" mask="url(#${uid})" />
        <g class="sun-rays" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="12" y1="2.2" x2="12" y2="4.2" />
          <line x1="12" y1="19.8" x2="12" y2="21.8" />
          <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
          <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
          <line x1="2.2" y1="12" x2="4.2" y2="12" />
          <line x1="19.8" y1="12" x2="21.8" y2="12" />
          <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
          <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
        </g>
      </svg>
      <span class="${hideLabelOnXs ? 'hide-xs' : ''}">${label}</span>
    `;
  }

  // ─── 11. Skeleton Shimmer Builder ──────────────────────────
  function renderSkeletonCatalog(count = 6) {
    return Array.from({ length: count }).map(() => `
      <div class="skeleton-card">
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="skeleton" style="width:58px;height:58px;border-radius:16px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
            <div class="skeleton" style="width:42%;height:14px;border-radius:99px;"></div>
            <div class="skeleton" style="width:86%;height:17px;"></div>
            <div class="skeleton" style="width:65%;height:12px;"></div>
          </div>
        </div>
        <div class="skeleton" style="width:100%;height:42px;border-radius:13px;"></div>
        <div class="skeleton" style="width:100%;height:40px;border-radius:12px;"></div>
      </div>
    `).join('');
  }

  global.MotionUI = {
    isReduced,
    initGlobalMicroInteractions,
    animateHeroMaskWipe,
    animateStaggerReveal,
    animatePageTransition,
    syncSegmentedControl,
    springScalePop,
    morphCinemaTransition,
    initBottomSheet,
    openModalSpring,
    closeModalSpring,
    getThemeMorphMarkup,
    renderSkeletonCatalog
  };
})(window);
