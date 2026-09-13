(function () {
  'use strict';

  // ---- Config: edit these to change ordering behaviour site-wide ----
  const GM_WHATSAPP = '995551484883';           // digits only, no +
  const GM_PICKUP_POINT = 'უნივერსიტეტის ქუჩა N6';
  const GM_MAX_QTY = 20;
  const GM_DAYS_AHEAD = 30;
  const GM_TIME_SLOTS = (function buildSlots() {
    const out = [];
    for (let h = 10; h <= 20; h++) {
      out.push(String(h).padStart(2, '0') + ':00');
      if (h < 20) out.push(String(h).padStart(2, '0') + ':30');
    }
    return out;
  })();

  const TEXT = {
    orderBtn: 'შეკვეთა',
    outOfStock: 'არ არის მარაგში',
    modalTitle: 'შეკვეთის გაფორმება',
    productLabel: 'პროდუქტი',
    colorLabel: 'ფერი',
    qtyLabel: 'რაოდენობა',
    pickupPointLabel: 'აღების ადგილი',
    dateLabel: 'თარიღი',
    timeLabel: 'დრო',
    timeChoose: 'აირჩიეთ დრო',
    nameLabel: 'სახელი',
    namePlaceholder: 'თქვენი სახელი და გვარი',
    phoneLabel: 'ტელეფონი',
    phonePlaceholder: '5XX XX XX XX',
    noteLabel: 'კომენტარი',
    notePlaceholder: 'დამატებითი ინფორმაცია (არასავალდებულო)',
    cancelBtn: 'გაუქმება',
    submitBtn: 'შეკვეთის გაგზავნა',
    submittingBtn: 'იგზავნება...',
    errRequired: 'შეავსეთ ეს ველი',
    errPhone: 'შეიყვანეთ სწორი ტელეფონის ნომერი',
    errDate: 'აირჩიეთ სწორი თარიღი',
    errTime: 'აირჩიეთ დრო',
    successTitle: 'შეკვეთა მიღებულია',
    successCode: 'შეკვეთის კოდი',
    whatsappOpenLink: 'WhatsApp-ში გახსნა',
    saveFailedWarning: 'შეკვეთა ვერ შეინახა პანელში, თუმცა WhatsApp შეტყობინება გაიგზავნა',
    close: 'დახურვა',
    cartTitle: 'ჩემი შეკვეთები',
    cancelConfirm: 'ნამდვილად გსურთ შეკვეთის გაუქმება?',
    guestRemoveNote: 'შეკვეთა წაიშალა სიიდან. გასაუქმებლად დაგვიკავშირდით.',
    waSend: 'WhatsApp-ში გაგზავნა',
    removeBtn: 'წაშლა',
    emptyCart: 'შეკვეთები არ არის',
    statusNew: 'ახალი',
    statusConfirmed: 'დადასტურებული',
    statusDone: 'შესრულებული',
    statusCancelled: 'გაუქმებული'
  };

  const SUPABASE_URL = 'https://lceebrhbvnyzoxkauugo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZWVicmhidm55em94a2F1dWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODkyNzAsImV4cCI6MjEwMTM2NTI3MH0.IeGvLg09wjni7OJdiLeAiO3pvrXxIUgzISNKnVKpXYI';
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function esc(v) { return window.gmEscapeHtml ? window.gmEscapeHtml(v) : String(v == null ? '' : v); }
  function formatPrice(n) { return new Intl.NumberFormat('ka-GE').format(n); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toISODate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISODate() { return toISODate(new Date()); }
  function maxISODate() { const d = new Date(); d.setDate(d.getDate() + GM_DAYS_AHEAD); return toISODate(d); }
  function formatDMY(iso) { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }

  function generateOrderCode() {
    return 'GM-' + Date.now().toString(36).toUpperCase();
  }

  function isValidPhone(raw) {
    return /^(\+?995)?\s?5\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/.test(String(raw || '').trim());
  }
  function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    return '+995' + digits.slice(-9);
  }

  // ---- 2d. Local order storage (guest cart + order history mirror) ----
  const ORDER_STORE_KEY = 'gm_orders';
  const ORDER_STORE_MAX = 20;
  const gmOrderStore = {
    list() {
      try {
        const raw = localStorage.getItem(ORDER_STORE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (e) { return []; }
    },
    add(order) {
      try {
        const list = gmOrderStore.list();
        list.unshift(order);
        localStorage.setItem(ORDER_STORE_KEY, JSON.stringify(list.slice(0, ORDER_STORE_MAX)));
      } catch (e) {}
    },
    remove(code) {
      try {
        const list = gmOrderStore.list().filter((o) => o.code !== code);
        localStorage.setItem(ORDER_STORE_KEY, JSON.stringify(list));
      } catch (e) {}
    },
    clear() {
      try { localStorage.removeItem(ORDER_STORE_KEY); } catch (e) {}
    }
  };

  // ---- Shared styles, injected once (mirrors auth.js's own chrome-style pattern) ----
  const style = document.createElement('style');
  style.textContent = `
    .gm-order-overlay { position: fixed; inset: 0; background: rgba(20,23,28,0.6); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .gm-order-overlay[hidden] { display: none; }
    .gm-order-modal { background: var(--surface, #fff); color: var(--text, #14171C); border-radius: 18px; width: 100%; max-width: 460px; max-height: 90vh; overflow: auto; padding: 22px; display: flex; flex-direction: column; }
    .gm-order-body { display: flex; flex-direction: column; gap: 14px; flex: 1; }
    .gm-order-modal h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .gm-order-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%; border: none; background: transparent; color: var(--slate, #8A93A0); display: flex; align-items: center; justify-content: center; }
    .gm-order-close:hover { background: rgba(20,23,28,0.06); color: var(--text, #14171C); }
    .gm-order-modal-head { position: relative; }
    .gm-order-product-line { background: var(--paper, #F3F1EB); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; display: flex; justify-content: space-between; gap: 10px; align-items: center; }
    .gm-order-product-line b { font-weight: 700; }
    .gm-field { display: flex; flex-direction: column; gap: 6px; }
    .gm-field label { font-size: 12px; font-weight: 700; color: var(--slate, #8A93A0); letter-spacing: 0.2px; }
    .gm-field input[type="text"], .gm-field input[type="date"], .gm-field select, .gm-field textarea {
      width: 100%; border: 1px solid var(--line-light, #E4E1D8); border-radius: 8px; padding: 10px 12px;
      font-size: 14px; color: var(--text, #14171C); background: var(--surface, #fff); font-family: inherit;
    }
    .gm-field textarea { min-height: 64px; resize: vertical; }
    .gm-field input:focus, .gm-field select:focus, .gm-field textarea:focus { outline: none; border-color: var(--red, #D8253B); }
    .gm-field.invalid input, .gm-field.invalid select, .gm-field.invalid textarea { border-color: var(--red-dark, #A60F1E); }
    .gm-field-error { color: var(--red-dark, #A60F1E); font-size: 12px; font-weight: 600; display: none; }
    .gm-field.invalid .gm-field-error { display: block; }
    .gm-swatch-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .gm-swatch-btn { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1.5px var(--line-light, #E4E1D8); cursor: pointer; padding: 0; }
    .gm-swatch-btn.active { box-shadow: 0 0 0 2px var(--red, #D8253B); }
    .gm-qty-row { display: flex; align-items: center; gap: 10px; }
    .gm-qty-btn { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--line-light, #E4E1D8); background: var(--surface, #fff); color: var(--text, #14171C); font-size: 16px; font-weight: 700; }
    .gm-qty-btn:disabled { opacity: 0.4; }
    .gm-qty-value { min-width: 28px; text-align: center; font-weight: 700; font-size: 15px; }
    .gm-order-summary { display: flex; justify-content: space-between; align-items: baseline; padding-top: 10px; border-top: 1px solid var(--line-light, #E4E1D8); font-size: 14px; }
    .gm-order-summary b { font-size: 18px; }
    .gm-order-actions { display: flex; gap: 10px; }
    .gm-btn { flex: 1; border: none; border-radius: 10px; padding: 13px 16px; font-size: 14.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .gm-btn-primary { background: var(--red, #D8253B); color: #fff; }
    .gm-btn-primary:hover { background: var(--red-dark, #A60F1E); }
    .gm-btn-primary:disabled { opacity: 0.65; cursor: default; }
    .gm-btn-ghost { background: transparent; border: 1px solid var(--line-light, #E4E1D8); color: var(--text, #14171C); }
    .gm-order-success { display: flex; flex-direction: column; gap: 10px; text-align: center; padding: 6px 0 2px; }
    .gm-order-success .ok-icon { width: 48px; height: 48px; border-radius: 50%; background: rgba(95,112,82,0.14); color: var(--sage, #5F7052); display: flex; align-items: center; justify-content: center; margin: 0 auto; }
    .gm-order-success h3 { margin: 0; font-size: 17px; }
    .gm-order-success .code { font-weight: 700; color: var(--red-dark, #A60F1E); }
    .gm-order-warning { font-size: 12.5px; color: var(--red-dark, #A60F1E); background: rgba(166,15,30,0.08); border-radius: 8px; padding: 8px 10px; }
    .gm-order-wa-link { font-weight: 700; color: var(--sage, #5F7052); }
    .gm-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--surface, #fff); color: var(--text, #14171C); border: 1px solid var(--line-light, #E4E1D8); border-radius: 12px; padding: 14px 18px; box-shadow: 0 12px 28px rgba(20,23,28,0.18); z-index: 302; max-width: 90vw; font-size: 13.5px; }

    @media (max-width: 640px) {
      .gm-order-overlay { align-items: flex-end; padding: 0; }
      .gm-order-modal { max-width: 100%; border-radius: 18px 18px 0 0; height: 92vh; max-height: 92vh; }
      .gm-order-actions {
        position: sticky; bottom: 0; margin-top: auto; padding: 12px 0 2px;
        background: var(--surface, #fff); border-top: 1px solid var(--line-light, #E4E1D8);
      }
    }
  `;
  document.head.appendChild(style);

  // ================= Order modal =================
  let modalOverlay = null;
  let lastFocusedTrigger = null;
  let currentProduct = null;
  let selectedColor = null;
  let currentQty = 1;

  function buildModal() {
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'gm-order-overlay';
    modalOverlay.hidden = true;
    modalOverlay.setAttribute('role', 'presentation');
    modalOverlay.innerHTML = `
      <div class="gm-order-modal" role="dialog" aria-modal="true" aria-labelledby="gmOrderTitle">
        <div class="gm-order-body" id="gmOrderBody"></div>
      </div>
    `;
    modalOverlay.addEventListener('mousedown', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
      if (e.key === 'Tab' && !modalOverlay.hidden) trapFocus(e);
    });
    document.body.appendChild(modalOverlay);
  }

  function trapFocus(e) {
    const focusables = modalOverlay.querySelectorAll('button, input, select, textarea, a[href]');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function renderFormStep() {
    const body = document.getElementById('gmOrderBody');
    const hasColors = currentProduct.colors && currentProduct.colors.length > 0;
    const todayISO = todayISODate();
    body.innerHTML = `
      <div class="gm-order-modal-head">
        <h2 id="gmOrderTitle">${TEXT.modalTitle}</h2>
        <button type="button" class="gm-order-close" id="gmOrderCloseBtn" aria-label="${TEXT.close}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="gm-order-product-line">
        <span>${esc(currentProduct.name)}</span>
        <b>${formatPrice(currentProduct.price)} ₾</b>
      </div>
      ${hasColors ? `
      <div class="gm-field">
        <label>${TEXT.colorLabel}</label>
        <div class="gm-swatch-row" id="gmColorRow">
          ${currentProduct.colors.map((c, i) => `<button type="button" class="gm-swatch-btn${i === 0 ? ' active' : ''}" data-color-index="${i}" style="background:${esc(c.hex)};" title="${esc(c.name || c.hex)}" aria-label="${esc(c.name || c.hex)}"></button>`).join('')}
        </div>
      </div>` : ''}
      <div class="gm-field">
        <label>${TEXT.qtyLabel}</label>
        <div class="gm-qty-row">
          <button type="button" class="gm-qty-btn" id="gmQtyMinus" aria-label="-">−</button>
          <span class="gm-qty-value" id="gmQtyValue">1</span>
          <button type="button" class="gm-qty-btn" id="gmQtyPlus" aria-label="+">+</button>
        </div>
      </div>
      <div class="gm-field">
        <label>${TEXT.pickupPointLabel}</label>
        <div class="gm-order-product-line"><span>${esc(GM_PICKUP_POINT)}</span></div>
      </div>
      <div class="gm-field">
        <label for="gmDateInput">${TEXT.dateLabel}</label>
        <input type="date" id="gmDateInput" min="${todayISO}" max="${maxISODate()}" value="${todayISO}" />
        <span class="gm-field-error">${TEXT.errDate}</span>
      </div>
      <div class="gm-field">
        <label for="gmTimeInput">${TEXT.timeLabel}</label>
        <select id="gmTimeInput"><option value="">${TEXT.timeChoose}</option></select>
        <span class="gm-field-error">${TEXT.errTime}</span>
      </div>
      <div class="gm-field">
        <label for="gmNameInput">${TEXT.nameLabel}</label>
        <input type="text" id="gmNameInput" placeholder="${TEXT.namePlaceholder}" />
        <span class="gm-field-error">${TEXT.errRequired}</span>
      </div>
      <div class="gm-field">
        <label for="gmPhoneInput">${TEXT.phoneLabel}</label>
        <input type="text" id="gmPhoneInput" placeholder="${TEXT.phonePlaceholder}" />
        <span class="gm-field-error">${TEXT.errPhone}</span>
      </div>
      <div class="gm-field">
        <label for="gmNoteInput">${TEXT.noteLabel}</label>
        <textarea id="gmNoteInput" placeholder="${TEXT.notePlaceholder}"></textarea>
      </div>
      <div class="gm-order-summary">
        <span id="gmSummaryLine">${esc(currentProduct.name)} × 1</span>
        <b id="gmSummaryTotal">${formatPrice(currentProduct.price)} ₾</b>
      </div>
      <div class="gm-order-actions">
        <button type="button" class="gm-btn gm-btn-ghost" id="gmCancelBtn">${TEXT.cancelBtn}</button>
        <button type="button" class="gm-btn gm-btn-primary" id="gmSubmitBtn">${TEXT.submitBtn}</button>
      </div>
    `;

    selectedColor = hasColors ? currentProduct.colors[0] : null;
    currentQty = 1;

    document.getElementById('gmOrderCloseBtn').addEventListener('click', closeModal);
    document.getElementById('gmCancelBtn').addEventListener('click', closeModal);

    if (hasColors) {
      document.getElementById('gmColorRow').querySelectorAll('.gm-swatch-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.gm-swatch-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          selectedColor = currentProduct.colors[Number(btn.dataset.colorIndex)];
        });
      });
    }

    const qtyValueEl = document.getElementById('gmQtyValue');
    document.getElementById('gmQtyMinus').addEventListener('click', () => {
      currentQty = Math.max(1, currentQty - 1);
      qtyValueEl.textContent = currentQty;
      updateSummary();
    });
    document.getElementById('gmQtyPlus').addEventListener('click', () => {
      currentQty = Math.min(GM_MAX_QTY, currentQty + 1);
      qtyValueEl.textContent = currentQty;
      updateSummary();
    });

    const dateInput = document.getElementById('gmDateInput');
    function rebuildTimeOptions() {
      const timeSelect = document.getElementById('gmTimeInput');
      const currentValue = timeSelect.value;
      timeSelect.innerHTML = `<option value="">${TEXT.timeChoose}</option>` + GM_TIME_SLOTS.map((slot) => {
        const disabled = isSlotDisabled(dateInput.value, slot);
        return `<option value="${slot}" ${disabled ? 'disabled' : ''}>${slot}</option>`;
      }).join('');
      if (currentValue && !isSlotDisabled(dateInput.value, currentValue)) timeSelect.value = currentValue;
    }
    dateInput.addEventListener('change', rebuildTimeOptions);
    rebuildTimeOptions();

    function updateSummary() {
      document.getElementById('gmSummaryLine').textContent = `${currentProduct.name} × ${currentQty}`;
      document.getElementById('gmSummaryTotal').textContent = formatPrice(currentProduct.price * currentQty) + ' ₾';
    }
    updateSummary();

    document.getElementById('gmSubmitBtn').addEventListener('click', handleSubmit);

    (async function prefill() {
      try {
        const { data } = await window.gmAuthClient.auth.getSession();
        const user = data.session && data.session.user;
        if (user) {
          const fullName = user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name);
          if (fullName) document.getElementById('gmNameInput').value = fullName;
        }
      } catch (e) {}
    })();
  }

  function isSlotDisabled(dateStr, slot) {
    if (dateStr !== todayISODate()) return false;
    const [h, m] = slot.split(':').map(Number);
    const slotDate = new Date();
    slotDate.setHours(h, m, 0, 0);
    return slotDate.getTime() < Date.now() + 60 * 60 * 1000;
  }

  function setFieldInvalid(fieldId, invalid) {
    const el = document.getElementById(fieldId);
    if (el) el.closest('.gm-field').classList.toggle('invalid', invalid);
  }

  function validateForm() {
    let firstInvalid = null;
    function mark(fieldId, ok) {
      setFieldInvalid(fieldId, !ok);
      if (!ok && !firstInvalid) firstInvalid = fieldId;
    }

    const name = document.getElementById('gmNameInput').value.trim();
    mark('gmNameInput', !!name);

    const phone = document.getElementById('gmPhoneInput').value.trim();
    mark('gmPhoneInput', isValidPhone(phone));

    const dateVal = document.getElementById('gmDateInput').value;
    const dateOk = !!dateVal && dateVal >= todayISODate() && dateVal <= maxISODate();
    mark('gmDateInput', dateOk);

    const timeVal = document.getElementById('gmTimeInput').value;
    const timeOk = !!timeVal && !isSlotDisabled(dateVal, timeVal);
    mark('gmTimeInput', timeOk);

    if (firstInvalid) {
      document.getElementById(firstInvalid).focus();
      return null;
    }

    return {
      name,
      phone: normalizePhone(phone),
      date: dateVal,
      time: timeVal,
      note: document.getElementById('gmNoteInput').value.trim()
    };
  }

  function buildWhatsAppText(order) {
    const lines = [];
    lines.push(`ახალი შეკვეთა #${order.code}`);
    lines.push(`პროდუქტი: ${order.productName}${order.color ? ' (ფერი: ' + order.color + ')' : ''}`);
    lines.push(`რაოდენობა: ${order.qty}`);
    lines.push(`თანხა: ${formatPrice(order.total)} ₾`);
    lines.push(`ფილიალი: ${GM_PICKUP_POINT}`);
    lines.push(`თარიღი: ${formatDMY(order.date)} ${order.time}`);
    lines.push(`სახელი: ${order.name}`);
    lines.push(`ტელეფონი: ${order.phone}`);
    if (order.note) lines.push(`კომენტარი: ${order.note}`);
    return lines.join('\n');
  }

  function waLinkFor(order) {
    return 'https://wa.me/' + GM_WHATSAPP + '?text=' + encodeURIComponent(buildWhatsAppText(order));
  }

  async function handleSubmit() {
    const fields = validateForm();
    if (!fields) return;

    const submitBtn = document.getElementById('gmSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = TEXT.submittingBtn;

    // window.open must run synchronously, before any await, or popup blockers kill it.
    const waWin = window.open('', '_blank');

    const code = generateOrderCode();
    const total = currentProduct.price * currentQty;

    let userId = null;
    try {
      const { data } = await window.gmAuthClient.auth.getSession();
      userId = data.session && data.session.user ? data.session.user.id : null;
    } catch (e) {}

    const orderForWa = {
      code,
      productName: currentProduct.name,
      color: selectedColor ? (selectedColor.name || '') : '',
      qty: currentQty,
      total,
      date: fields.date,
      time: fields.time,
      name: fields.name,
      phone: fields.phone,
      note: fields.note
    };

    const row = {
      order_code: code,
      user_id: userId,
      product_id: currentProduct.id,
      product_name: currentProduct.name,
      product_color: selectedColor ? (selectedColor.name || selectedColor.hex || null) : null,
      unit_price: currentProduct.price,
      quantity: currentQty,
      total,
      fulfilment: 'pickup',
      pickup_date: fields.date,
      pickup_time: fields.time,
      customer_name: fields.name,
      customer_phone: fields.phone,
      note: fields.note || null
    };

    let savedId = null;
    let saveError = null;
    try {
      const { data, error } = await supabaseClient.from('orders').insert(row).select().single();
      if (error) throw error;
      savedId = data.id;
    } catch (err) {
      saveError = err;
      console.error('Could not save order', err);
    }

    gmOrderStore.add({
      code, id: savedId, ownerId: userId,
      name: currentProduct.name, qty: currentQty, total,
      date: fields.date, time: fields.time,
      status: 'new', createdAt: Date.now(), waLinkOrder: orderForWa
    });

    const waUrl = waLinkFor(orderForWa);
    if (waWin) {
      waWin.location.href = waUrl;
    }

    closeModal();
    showSuccessToast(code, saveError, waWin ? null : waUrl);
    document.dispatchEvent(new CustomEvent('gm:order-placed'));
  }

  function showSuccessToast(code, saveError, fallbackWaUrl) {
    const toast = document.createElement('div');
    toast.className = 'gm-toast';
    toast.innerHTML = `
      <div><b>${TEXT.successTitle}</b> — ${TEXT.successCode}: <span class="gm-order-wa-link">${esc(code)}</span></div>
      ${saveError ? `<div class="gm-order-warning">${TEXT.saveFailedWarning}</div>` : ''}
      ${fallbackWaUrl ? `<div style="margin-top:6px;"><a class="gm-order-wa-link" href="${esc(fallbackWaUrl)}" target="_blank" rel="noopener">${TEXT.whatsappOpenLink}</a></div>` : ''}
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), saveError || fallbackWaUrl ? 7000 : 4000);
  }

  function showTextToast(text) {
    const toast = document.createElement('div');
    toast.className = 'gm-toast';
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function focusFirstField(container) {
    const candidates = container.querySelectorAll('.gm-swatch-btn, input, select, textarea');
    for (const el of candidates) {
      if (el.offsetParent !== null) { el.focus(); return; }
    }
  }

  function openModal(product, trigger) {
    if (!modalOverlay) buildModal();
    currentProduct = product;
    lastFocusedTrigger = trigger || null;
    renderFormStep();
    modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    focusFirstField(modalOverlay);
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedTrigger) lastFocusedTrigger.focus();
  }

  function parseColorsAttr(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-order-id]');
    if (!btn || btn.disabled) return;
    const product = {
      id: Number(btn.dataset.orderId),
      name: btn.dataset.orderName || '',
      price: Number(btn.dataset.orderPrice) || 0,
      colors: parseColorsAttr(btn.dataset.orderColors)
    };
    openModal(product, btn);
  });

  // Cart widget lives in order-cart.js; expose what it needs (and the shared
  // TEXT object, so all Georgian strings still live in exactly one place).
  window.gmOrder = {
    store: gmOrderStore,
    openModal,
    waLinkFor,
    notify: showTextToast,
    TEXT,
    esc,
    formatPrice,
    formatDMY
  };
})();
