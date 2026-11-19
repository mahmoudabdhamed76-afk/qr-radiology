/* ==========================================================================
   إمداد QR — Bespoke SVG Motion Graphics & Supply Mission Cinema Engine
   ========================================================================== */

(function (global) {
  const STAGES = [
    { key: 'pending', label: 'استلام الطلب', short: 'استلام', icon: '📡', title: 'تم استلام طلب التوريد', sub: 'تم إرسال قائمة الأصناف مباشرة للوحة تحكم المخزن الرئيسي' },
    { key: 'approved', label: 'الاعتماد والحجز', short: 'اعتماد', icon: '✅', title: 'تم اعتماد المهمة وحجز الكميات', sub: 'تمت مطابقة الرصيد وتثبيت الكميات المخصصة لمركزك' },
    { key: 'preparing', label: 'التجهيز والتعبئة', short: 'تجهيز', icon: '📦', title: 'جاري تجهيز وتعبئة مهمة التوريد', sub: 'فريق المخزن يقوم الآن بتجميع الصناديق وفحص الباركود والتغليف' },
    { key: 'dispatched', label: 'في الطريق للتسليم', short: 'بالطريق', icon: '🚚', title: 'المندوب في طريقه إلى المركز الآن', sub: 'الشحنة خرجت من المخزن المركزي وفي مسارها للتسليم' },
    { key: 'delivered', label: 'تم التسليم بنجاح', short: 'تم التسليم', icon: '🎉', title: 'اكتملت مهمة التوريد بنجاح!', sub: 'تم تسليم كامل الأصناف وتوثيق الاستلام بالنظام' }
  ];

  const PRIORITY_MAP = {
    normal: { label: 'عادي', badge: 'badge-sage', icon: '🟢' },
    urgent: { label: 'مستعجل', badge: 'badge-honey', icon: '⚡' },
    emergency: { label: 'طارئ جداً', badge: 'badge-crimson', icon: '🚨' }
  };

  function getStageIndex(status) {
    const idx = STAGES.findIndex((s) => s.key === status);
    return idx === -1 ? 0 : idx;
  }

  function getStageMeta(status) {
    if (status === 'rejected') {
      return { key: 'rejected', label: 'ملغي / مرفوض', short: 'ملغي', icon: '↩️', title: 'تم إلغاء مهمة التوريد', sub: 'تمت إعادة الكميات المحجوزة إلى رصيد المخزن تلقائياً' };
    }
    return STAGES[getStageIndex(status)] || STAGES[0];
  }

  function getStageSVG(status, order = {}) {
    switch (status) {
      case 'pending':
        return `
          <svg viewBox="0 0 520 145" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="استلام الطلب">
            <!-- Soft background grid -->
            <circle cx="260" cy="72" r="56" stroke="#E76B45" stroke-opacity="0.22" stroke-width="1.5" stroke-dasharray="5 5" class="anim-orbit"/>
            <circle cx="260" cy="72" r="34" stroke="#E76B45" stroke-width="2" class="anim-radar-1"/>
            <circle cx="260" cy="72" r="34" stroke="#D45832" stroke-width="1.8" class="anim-radar-2"/>
            <circle cx="260" cy="72" r="34" stroke="#694938" stroke-width="1.4" class="anim-radar-3"/>

            <!-- Left: Center Mobile Device -->
            <g class="anim-float-slow">
              <rect x="64" y="34" width="58" height="82" rx="14" fill="#1F1A16"/>
              <rect x="70" y="42" width="46" height="64" rx="9" fill="#FBF8F3"/>
              <rect x="85" y="48" width="16" height="3" rx="1.5" fill="#DCD0BC"/>
              <!-- Mini QR & check on phone -->
              <rect x="78" y="56" width="30" height="30" rx="5" fill="#F5DFAC"/>
              <rect x="83" y="61" width="8" height="8" rx="1.5" fill="#694938"/>
              <rect x="95" y="61" width="8" height="8" rx="1.5" fill="#694938"/>
              <rect x="83" y="73" width="8" height="8" rx="1.5" fill="#694938"/>
              <rect x="95" y="73" width="8" height="8" rx="1.5" fill="#E76B45"/>
              <rect x="77" y="92" width="32" height="7" rx="3.5" fill="#E76B45"/>
            </g>

            <!-- Flowing data beam -->
            <path d="M132 74 C 175 44, 200 44, 232 68" stroke="#E76B45" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 7" class="anim-route-dash"/>
            <path d="M288 68 C 320 44, 345 44, 388 74" stroke="#694938" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 7" class="anim-route-dash"/>

            <!-- Center Hub Radar Core -->
            <g class="anim-float-fast">
              <rect x="228" y="42" width="64" height="64" rx="20" fill="#E76B45"/>
              <rect x="234" y="48" width="52" height="52" rx="15" fill="#FBF8F3" fill-opacity="0.16"/>
              <path d="M248 74 L256 82 L274 63" stroke="#FFFDF9" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
            </g>

            <!-- Right: Warehouse Dashboard Console -->
            <g class="anim-float-slow">
              <rect x="394" y="38" width="72" height="68" rx="14" fill="#FBF8F3" stroke="#D4C7B4" stroke-width="2"/>
              <rect x="404" y="48" width="52" height="10" rx="4" fill="#DFE3D3"/>
              <rect x="404" y="64" width="32" height="8" rx="4" fill="#F3CFC0"/>
              <rect x="404" y="77" width="46" height="8" rx="4" fill="#D7E0EC"/>
              <circle cx="456" cy="40" r="10" fill="#E11D48"/>
              <text x="456" y="44" text-anchor="middle" fill="#fff" font-size="11" font-weight="800">!</text>
            </g>
          </svg>
        `;

      case 'approved':
        return `
          <svg viewBox="0 0 520 145" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="تم اعتماد الطلب">
            <!-- Rotating dashed halo -->
            <circle cx="260" cy="72" r="56" stroke="#694938" stroke-opacity="0.22" stroke-width="2" stroke-dasharray="8 6" class="anim-orbit"/>

            <!-- Left Stock Vault Bars -->
            <g class="anim-float-slow">
              <rect x="70" y="34" width="110" height="78" rx="16" fill="#FFFDF9" stroke="#C8D6E8" stroke-width="2"/>
              <rect x="84" y="48" width="54" height="8" rx="4" fill="#694938" fill-opacity="0.7"/>
              <rect x="84" y="64" width="82" height="10" rx="5" fill="#E8EEF6"/>
              <rect x="84" y="64" width="66" height="10" rx="5" fill="#1F8A5B"/>
              <rect x="84" y="82" width="82" height="10" rx="5" fill="#E8EEF6"/>
              <rect x="84" y="82" width="52" height="10" rx="5" fill="#E76B45"/>
            </g>

            <!-- Center Approval Seal -->
            <g class="anim-stamp-pop">
              <circle cx="260" cy="72" r="38" fill="#1F8A5B"/>
              <circle cx="260" cy="72" r="30" stroke="#FFFDF9" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="4 4"/>
              <path d="M244 73 L255 84 L277 60" stroke="#FFFDF9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" class="anim-check-draw"/>
            </g>

            <!-- Right Reserved Crates -->
            <g class="anim-float-fast">
              <rect x="342" y="42" width="54" height="46" rx="10" fill="#F5DFAC" stroke="#D9B467" stroke-width="2"/>
              <path d="M342 56 H396" stroke="#D9B467" stroke-width="2"/>
              <rect x="361" y="42" width="16" height="14" fill="#E76B45" fill-opacity="0.85"/>

              <rect x="382" y="64" width="58" height="48" rx="10" fill="#F3CFC0" stroke="#DF9E84" stroke-width="2"/>
              <path d="M382 78 H440" stroke="#DF9E84" stroke-width="2"/>
              <rect x="403" y="64" width="16" height="14" fill="#694938" fill-opacity="0.85"/>
              <circle cx="436" cy="64" r="11" fill="#1F8A5B"/>
              <path d="M431 64 L434.5 67.5 L441 60.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
          </svg>
        `;

      case 'preparing':
        return `
          <svg viewBox="0 0 520 145" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="جاري تجهيز وتعبئة المهمة">
            <!-- Overhead Gantry & Packing Arm -->
            <rect x="70" y="14" width="380" height="8" rx="4" fill="#694938" fill-opacity="0.22"/>
            <g class="anim-arm-pack">
              <rect x="262" y="18" width="16" height="32" rx="6" fill="#694938"/>
              <rect x="246" y="46" width="48" height="10" rx="5" fill="#E76B45"/>
              <rect x="255" y="54" width="30" height="4" rx="2" fill="#FFFDF9"/>
            </g>

            <!-- Barcode Laser Scanner Arch -->
            <rect x="148" y="34" width="8" height="72" rx="4" fill="#1F1A16"/>
            <rect x="144" y="30" width="52" height="10" rx="5" fill="#1F1A16"/>
            <rect x="156" y="42" width="36" height="3" rx="1.5" fill="#E11D48" class="anim-laser-sweep"/>
            <rect x="156" y="42" width="36" height="14" fill="#E11D48" fill-opacity="0.12" class="anim-laser-sweep"/>

            <!-- Moving Supply Crates on Conveyor -->
            <g class="anim-crate-1">
              <rect x="235" y="62" width="52" height="42" rx="9" fill="#F5DFAC" stroke="#C99F4F" stroke-width="2"/>
              <rect x="253" y="62" width="16" height="15" fill="#E76B45"/>
              <rect x="244" y="86" width="20" height="6" rx="2" fill="#694938" fill-opacity="0.45"/>
            </g>
            <g class="anim-crate-2">
              <rect x="235" y="62" width="52" height="42" rx="9" fill="#DFE3D3" stroke="#99A886" stroke-width="2"/>
              <rect x="253" y="62" width="16" height="15" fill="#694938"/>
              <circle cx="274" cy="90" r="6" fill="#1F8A5B"/>
              <path d="M271 90 L273.3 92.2 L277.3 87.8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
            </g>
            <g class="anim-crate-3">
              <rect x="235" y="62" width="52" height="42" rx="9" fill="#D7E0EC" stroke="#8FA8C8" stroke-width="2"/>
              <rect x="253" y="62" width="16" height="15" fill="#E76B45"/>
              <rect x="244" y="86" width="22" height="6" rx="2" fill="#1F1A16" fill-opacity="0.35"/>
            </g>

            <!-- Conveyor Belt Track -->
            <rect x="52" y="104" width="416" height="22" rx="11" fill="#2A231E"/>
            <line x1="68" y1="115" x2="452" y2="115" stroke="#E76B45" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 18" class="anim-conveyor-belt"/>
            <!-- Rollers -->
            <circle cx="72" cy="115" r="5" fill="#FBF8F3"/>
            <circle cx="166" cy="115" r="5" fill="#FBF8F3"/>
            <circle cx="260" cy="115" r="5" fill="#FBF8F3"/>
            <circle cx="354" cy="115" r="5" fill="#FBF8F3"/>
            <circle cx="448" cy="115" r="5" fill="#FBF8F3"/>

            <!-- Floating Checklist Pill -->
            <g class="anim-float-slow">
              <rect x="372" y="28" width="96" height="46" rx="12" fill="#FFFDF9" stroke="#E9E0D1" stroke-width="1.8"/>
              <circle cx="452" cy="43" r="6" fill="#1F8A5B"/>
              <rect x="386" y="40" width="54" height="6" rx="3" fill="#694938" fill-opacity="0.7"/>
              <circle cx="452" cy="59" r="6" fill="#E76B45"/>
              <rect x="394" y="56" width="46" height="6" rx="3" fill="#9B8F80" fill-opacity="0.55"/>
            </g>
          </svg>
        `;

      case 'dispatched':
        return `
          <svg viewBox="0 0 520 145" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="المندوب في الطريق للمركز">
            <!-- Drifting Soft Clouds -->
            <g class="anim-cloud-1" opacity="0.75">
              <rect x="90" y="20" width="54" height="16" rx="8" fill="#FFFDF9"/>
              <circle cx="108" cy="20" r="10" fill="#FFFDF9"/>
              <circle cx="126" cy="22" r="8" fill="#FFFDF9"/>
            </g>
            <g class="anim-cloud-2" opacity="0.65">
              <rect x="310" y="16" width="60" height="15" rx="7.5" fill="#FFFDF9"/>
              <circle cx="332" cy="17" r="9" fill="#FFFDF9"/>
            </g>

            <!-- Route Origin & Destination Badges -->
            <g>
              <rect x="404" y="24" width="84" height="28" rx="14" fill="#FFFDF9" stroke="#E2D7C6" stroke-width="1.5"/>
              <text x="446" y="42" text-anchor="middle" fill="#694938" font-size="11" font-weight="800">المخزن المركزي</text>
            </g>
            <g>
              <rect x="32" y="24" width="88" height="28" rx="14" fill="#E76B45"/>
              <text x="76" y="42" text-anchor="middle" fill="#FFFDF9" font-size="11" font-weight="800">مركزك الطبي</text>
            </g>
            <line x1="126" y1="38" x2="398" y2="38" stroke="#694938" stroke-opacity="0.35" stroke-width="2.5" stroke-dasharray="6 6" class="anim-route-dash"/>

            <!-- Speed Streaks behind van (moving right-to-left in RTL) -->
            <line x1="334" y1="74" x2="366" y2="74" stroke="#E76B45" stroke-width="3" stroke-linecap="round" class="anim-speed-line"/>
            <line x1="342" y1="88" x2="382" y2="88" stroke="#694938" stroke-opacity="0.45" stroke-width="2.5" stroke-linecap="round" class="anim-speed-line"/>
            <line x1="336" y1="100" x2="364" y2="100" stroke="#E76B45" stroke-opacity="0.5" stroke-width="2.5" stroke-linecap="round" class="anim-speed-line"/>

            <!-- Animated Terracotta Delivery Van (facing left toward Center!) -->
            <g class="anim-van-body">
              <!-- Cargo Box -->
              <rect x="218" y="54" width="108" height="58" rx="13" fill="#FFFDF9" stroke="#E76B45" stroke-width="2.5"/>
              <rect x="220" y="56" width="104" height="16" rx="10" fill="#E76B45"/>
              <!-- Medical Cross / Supply Emblem -->
              <rect x="266" y="79" width="12" height="24" rx="3" fill="#E76B45"/>
              <rect x="260" y="85" width="24" height="12" rx="3" fill="#E76B45"/>
              <!-- Cabin -->
              <path d="M218 68 H186 C178 68 172 74 170 82 L164 102 C163 107 167 112 173 112 H218 V68 Z" fill="#E76B45"/>
              <!-- Windshield -->
              <path d="M210 75 H188 C184 75 180 78 179 82 L175 93 H210 V75 Z" fill="#D7E0EC"/>
              <!-- Headlight Glow -->
              <ellipse cx="164" cy="101" rx="4" ry="5" fill="#FDE047"/>
              <polygon points="160,97 128,88 128,113 160,105" fill="#FDE047" fill-opacity="0.22"/>
              <!-- GPS Beacon on Roof -->
              <circle cx="200" cy="64" r="5" fill="#22C55E"/>
              <circle cx="200" cy="64" r="11" stroke="#22C55E" stroke-width="2" class="anim-radar-1"/>
            </g>

            <!-- Spinning Wheels -->
            <g class="anim-wheel">
              <circle cx="192" cy="112" r="13" fill="#1F1A16"/>
              <circle cx="192" cy="112" r="6" fill="#FBF8F3"/>
              <line x1="192" y1="103" x2="192" y2="121" stroke="#E76B45" stroke-width="2"/>
              <line x1="183" y1="112" x2="201" y2="112" stroke="#E76B45" stroke-width="2"/>
            </g>
            <g class="anim-wheel">
              <circle cx="294" cy="112" r="13" fill="#1F1A16"/>
              <circle cx="294" cy="112" r="6" fill="#FBF8F3"/>
              <line x1="294" y1="103" x2="294" y2="121" stroke="#E76B45" stroke-width="2"/>
              <line x1="285" y1="112" x2="303" y2="112" stroke="#E76B45" stroke-width="2"/>
            </g>

            <!-- Animated Road -->
            <rect x="30" y="124" width="460" height="8" rx="4" fill="#694938" fill-opacity="0.24"/>
            <line x1="42" y1="128" x2="478" y2="128" stroke="#FFFDF9" stroke-width="2.5" stroke-dasharray="18 26" class="anim-road-dash"/>
          </svg>
        `;

      case 'delivered':
        return `
          <svg viewBox="0 0 520 145" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="تم التسليم بنجاح">
            <!-- Confetti particles -->
            <g class="anim-confetti-1">
              <rect x="148" y="24" width="10" height="10" rx="3" fill="#E76B45"/>
              <circle cx="364" cy="28" r="6" fill="#F59E0B"/>
              <rect x="196" y="16" width="8" height="14" rx="3" fill="#1F8A5B"/>
            </g>
            <g class="anim-confetti-2">
              <circle cx="174" cy="36" r="5" fill="#694938"/>
              <rect x="330" y="18" width="11" height="8" rx="3" fill="#E76B45"/>
              <circle cx="394" cy="40" r="5" fill="#1F8A5B"/>
            </g>
            <g class="anim-confetti-3">
              <rect x="122" y="42" width="9" height="9" rx="2" fill="#F59E0B"/>
              <rect x="382" y="22" width="8" height="12" rx="3" fill="#694938"/>
            </g>

            <!-- Celebratory Glow Rings -->
            <circle cx="260" cy="74" r="52" fill="#1F8A5B" fill-opacity="0.12"/>
            <circle cx="260" cy="74" r="42" stroke="#1F8A5B" stroke-width="2" class="anim-radar-1"/>

            <!-- Delivered Crate & Big Ribbon Checkmark -->
            <g class="anim-float-slow">
              <rect x="216" y="40" width="88" height="72" rx="20" fill="#1F8A5B"/>
              <rect x="224" y="48" width="72" height="56" rx="14" fill="#FFFDF9" fill-opacity="0.16"/>
              <path d="M238 77 L253 91 L284 58" stroke="#FFFDF9" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" class="anim-check-draw"/>
            </g>
          </svg>
        `;

      default:
        return `
          <svg viewBox="0 0 520 145" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="تم إلغاء الطلب">
            <g class="anim-float-slow">
              <circle cx="260" cy="72" r="42" fill="#E11D48" fill-opacity="0.14"/>
              <circle cx="260" cy="72" r="30" fill="#E11D48"/>
              <path d="M248 60 L272 84 M272 60 L248 84" stroke="#FFFDF9" stroke-width="5" stroke-linecap="round"/>
            </g>
          </svg>
        `;
    }
  }

  function renderMissionCinema(order, options = {}) {
    const status = order?.status || 'pending';
    const meta = getStageMeta(status);
    const currentIdx = getStageIndex(status);
    const isRejected = status === 'rejected';
    const fillPercent = isRejected ? 0 : Math.min(80, (currentIdx / (STAGES.length - 1)) * 80);
    const pr = PRIORITY_MAP[order?.priority] || PRIORITY_MAP.normal;
    const lastLog = Array.isArray(order?.stage_log) && order.stage_log.length
      ? order.stage_log[order.stage_log.length - 1]
      : null;

    const etaPill = status === 'dispatched' && order?.eta_minutes
      ? `<span class="cinema-live-pill">⏱️ الوصول خلال ${order.eta_minutes} دقيقة ${order.driver_name ? `• ${escapeHtml(order.driver_name)}` : ''}</span>`
      : '';

    const itemsPreview = Array.isArray(order?.items) && order.items.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">
          ${order.items.map((it) => `
            <span class="badge badge-sage" style="font-size:0.74rem;">
              <span>${it.icon || '📦'}</span>
              <span>${escapeHtml(it.supply_name)}</span>
              <strong style="color:var(--accent-terracotta);">×${it.quantity}</strong>
            </span>
          `).join('')}
        </div>`
      : '';

    return `
      <div class="mission-cinema" data-stage="${status}">
        <div class="mission-cinema-stage">
          <div class="cinema-top-bar">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="cinema-live-pill">
                <span class="pulse-dot" style="${status === 'delivered' ? 'background:#1F8A5B;' : status === 'rejected' ? 'background:#E11D48;' : ''}"></span>
                <span>مهمة #${escapeHtml(order?.order_code || 'PREVIEW')}</span>
              </span>
              <span class="badge ${pr.badge}">${pr.icon} ${pr.label}</span>
              ${order?.center_name && options.showCenter ? `<span class="cinema-live-pill">🏥 ${escapeHtml(order.center_name)}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              ${etaPill}
              <span class="cinema-live-pill" style="font-weight:900;color:var(--accent-terracotta);">${order?.progress ?? (isRejected ? 0 : 100)}%</span>
            </div>
          </div>

          <div class="cinema-svg-wrap">
            ${getStageSVG(status, order)}
          </div>

          <div class="cinema-status-footer">
            <div>
              <div class="cinema-stage-title">${meta.icon} ${meta.title}</div>
              <div class="cinema-stage-sub">${escapeHtml(order?.admin_note || lastLog?.note || meta.sub)}</div>
            </div>
            ${options.extraActionHtml || ''}
          </div>
        </div>

        <div class="mission-stepper">
          <div class="stepper-track-wrap">
            <div class="stepper-line-bg"></div>
            <div class="stepper-line-fill" style="width:${fillPercent}%;"></div>
            ${STAGES.map((st, idx) => {
              const cls = isRejected ? '' : idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : '';
              return `
                <div class="step-node ${cls}">
                  <div class="step-circle">${idx < currentIdx && !isRejected ? '✓' : st.icon}</div>
                  <div class="step-label">${st.short}</div>
                </div>
              `;
            }).join('')}
          </div>
          ${options.showItems !== false ? itemsPreview : ''}
        </div>
      </div>
    `;
  }

  function renderHeroMotionScene() {
    return `
      <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:300px;height:auto;overflow:visible;">
        <!-- Floating background blobs -->
        <circle cx="160" cy="70" r="58" fill="#F5DFAC" fill-opacity="0.45"/>
        <circle cx="160" cy="70" r="46" stroke="#E76B45" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="6 6" class="anim-orbit"/>

        <!-- QR Scanner Frame -->
        <g class="anim-float-slow">
          <rect x="28" y="34" width="76" height="76" rx="18" fill="#FFFDF9" stroke="#E9E0D1" stroke-width="2"/>
          <!-- QR Pattern -->
          <rect x="42" y="48" width="16" height="16" rx="3" fill="#1F1A16"/>
          <rect x="46" y="52" width="8" height="8" rx="1.5" fill="#FFFDF9"/>
          <rect x="74" y="48" width="16" height="16" rx="3" fill="#1F1A16"/>
          <rect x="78" y="52" width="8" height="8" rx="1.5" fill="#FFFDF9"/>
          <rect x="42" y="80" width="16" height="16" rx="3" fill="#1F1A16"/>
          <rect x="46" y="84" width="8" height="8" rx="1.5" fill="#FFFDF9"/>
          <rect x="64" y="68" width="8" height="8" rx="2" fill="#E76B45"/>
          <rect x="76" y="80" width="14" height="14" rx="3" fill="#694938"/>
          <!-- Moving Laser Scan Line -->
          <rect x="36" y="40" width="60" height="3" rx="1.5" fill="#E76B45" class="anim-qr-scan-line"/>
        </g>

        <!-- Dotted Flow Connector -->
        <path d="M112 72 H198" stroke="#E76B45" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round" class="anim-route-dash"/>

        <!-- Supply Box & Express Badge -->
        <g class="anim-float-fast">
          <rect x="206" y="34" width="82" height="76" rx="20" fill="#E76B45"/>
          <rect x="218" y="48" width="58" height="48" rx="12" fill="#FFFDF9" fill-opacity="0.18"/>
          <rect x="239" y="56" width="16" height="32" rx="4" fill="#FFFDF9"/>
          <rect x="231" y="64" width="32" height="16" rx="4" fill="#FFFDF9"/>
          <circle cx="282" cy="38" r="14" fill="#1F8A5B" stroke="#FFFDF9" stroke-width="2.5"/>
          <path d="M276 38 L280 42 L288 33" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg>
    `;
  }

  function playMissionLaunchOverlay(order, onComplete) {
    let overlay = document.getElementById('mission-launch-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'mission-launch-overlay';
      overlay.className = 'mission-launch-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="launch-stage-box">
        <svg viewBox="0 0 180 180" width="170" height="170" fill="none">
          <circle cx="90" cy="90" r="68" stroke="#E76B45" stroke-width="3" stroke-dasharray="10 8" class="anim-orbit"/>
          <circle cx="90" cy="90" r="46" stroke="#1F8A5B" stroke-width="2.5" class="anim-radar-1"/>
          <g class="anim-float-fast">
            <rect x="46" y="52" width="88" height="76" rx="18" fill="#E76B45"/>
            <rect x="78" y="52" width="24" height="24" fill="#694938"/>
            <path d="M68 94 L83 108 L113 76" stroke="#FFFDF9" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="anim-check-draw"/>
          </g>
        </svg>
      </div>
      <div class="badge badge-terracotta" style="margin-bottom:10px;font-size:0.85rem;padding:6px 16px;">
        🚀 مهمة التوريد #${escapeHtml(order?.order_code || '')}
      </div>
      <h2 style="font-size:1.5rem;font-weight:900;margin-bottom:6px;">تم إطلاق طلب التوريد بنجاح!</h2>
      <p id="launch-step-text" style="color:var(--text-secondary);font-size:0.95rem;max-width:340px;">
        جاري إرسال إشعار فوري للوحة تحكم المخزن وحجز الكميات...
      </p>
      <div class="launch-progress-bar">
        <div class="launch-progress-fill" id="launch-progress-fill"></div>
      </div>
    `;

    overlay.classList.add('active');
    playNotificationChime('launch');

    requestAnimationFrame(() => {
      const fill = document.getElementById('launch-progress-fill');
      if (fill) fill.style.width = '100%';
    });

    setTimeout(() => {
      const txt = document.getElementById('launch-step-text');
      if (txt) txt.textContent = 'تم حجز الكميات من المخزن — جاري فتح مسرح متابعة المهمة المباشر...';
    }, 950);

    setTimeout(() => {
      overlay.classList.remove('active');
      if (typeof onComplete === 'function') onComplete();
    }, 2050);
  }

  function flyItemToCart(sourceEl, targetEl, icon = '📦') {
    if (!sourceEl || !targetEl) return;
    const s = sourceEl.getBoundingClientRect();
    const t = targetEl.getBoundingClientRect();
    const p = document.createElement('div');
    p.className = 'fly-particle';
    p.textContent = icon;
    p.style.left = `${s.left + s.width / 2 - 22}px`;
    p.style.top = `${s.top + s.height / 2 - 22}px`;
    document.body.appendChild(p);

    requestAnimationFrame(() => {
      const dx = (t.left + t.width / 2) - (s.left + s.width / 2);
      const dy = (t.top + t.height / 2) - (s.top + s.height / 2);
      p.style.transform = `translate(${dx}px, ${dy}px) scale(0.35) rotate(-18deg)`;
      p.style.opacity = '0.2';
    });

    setTimeout(() => p.remove(), 650);
  }

  function animateCounter(el, toValue, duration = 650) {
    if (!el) return;
    const fromValue = Number(el.dataset.val || 0);
    const target = Number(toValue || 0);
    el.dataset.val = String(target);
    if (fromValue === target) {
      el.textContent = target.toLocaleString('ar-EG');
      return;
    }
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(fromValue + (target - fromValue) * eased);
      el.textContent = current.toLocaleString('ar-EG');
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  let audioCtx = null;
  function playNotificationChime(kind = 'order') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const notes = kind === 'launch' ? [523.25, 659.25, 783.99, 1046.5]
        : kind === 'update' ? [587.33, 880]
        : [659.25, 880, 1174.66];

      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.085);
        gain.gain.setValueAtTime(0.001, now + i * 0.085);
        gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.085 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.085 + 0.28);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.085);
        osc.stop(now + i * 0.085 + 0.3);
      });
    } catch (_) {}
  }

  function showToast(title, msg = '', type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icon = type === 'success' ? '✨' : type === 'error' ? '⚠️' : '🔔';
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div style="min-width:0;">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${msg ? `<div class="toast-msg">${escapeHtml(msg)}</div>` : ''}
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatRelativeTime(iso) {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return iso;
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'الآن';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `منذ ${diffHr} ساعة`;
    const diffDay = Math.floor(diffHr / 24);
    return `منذ ${diffDay} يوم`;
  }

  global.EmdadMotion = {
    STAGES,
    PRIORITY_MAP,
    getStageIndex,
    getStageMeta,
    renderMissionCinema,
    renderHeroMotionScene,
    playMissionLaunchOverlay,
    flyItemToCart,
    animateCounter,
    playNotificationChime,
    showToast,
    escapeHtml,
    formatRelativeTime
  };
})(window);
