(function () {
  'use strict';

  // Cart widget: the floating "my orders" button + drawer, shown on every
  // page order.js loads on. Split out from order.js to keep that file
  // under ~600 lines; shares TEXT/helpers via window.gmOrder instead of
  // duplicating them, so all Georgian strings still live in one object.
  const gm = window.gmOrder;
  const TEXT = gm.TEXT;
  const esc = gm.esc;
  const formatPrice = gm.formatPrice;
  const formatDMY = gm.formatDMY;
  const gmOrderStore = gm.store;

  const SUPABASE_URL = 'https://lceebrhbvnyzoxkauugo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZWVicmhidm55em94a2F1dWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODkyNzAsImV4cCI6MjEwMTM2NTI3MH0.IeGvLg09wjni7OJdiLeAiO3pvrXxIUgzISNKnVKpXYI';
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const STATUS_LABEL = { new: TEXT.statusNew, confirmed: TEXT.statusConfirmed, done: TEXT.statusDone, cancelled: TEXT.statusCancelled };
  function statusPillHtml(status) {
    return `<span class="gm-pill gm-pill-${esc(status)}">${esc(STATUS_LABEL[status] || status)}</span>`;
  }

  const style = document.createElement('style');
  style.textContent = `
    .gm-cart-btn { position: fixed; right: 20px; bottom: 156px; width: 54px; height: 54px; border-radius: 50%; background: var(--ink, #14171C); color: #fff; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.25); z-index: 51; }
    .gm-cart-btn[hidden] { display: none; }
    .gm-cart-badge { position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 999px; background: var(--red, #D8253B); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    @keyframes gm-cart-bounce { 0% { transform: scale(0.4); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
    .gm-cart-btn.gm-bounce { animation: gm-cart-bounce 0.4s ease; }

    .gm-cart-overlay { position: fixed; inset: 0; background: rgba(20,23,28,0.5); z-index: 301; display: flex; justify-content: flex-end; }
    .gm-cart-overlay[hidden] { display: none; }
    .gm-cart-panel { background: var(--surface, #fff); color: var(--text, #14171C); width: 100%; max-width: 380px; height: 100%; overflow: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
    .gm-cart-head { display: flex; align-items: center; justify-content: space-between; }
    .gm-cart-head h2 { margin: 0; font-size: 17px; }
    .gm-cart-close { border: none; background: transparent; color: var(--slate, #8A93A0); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .gm-cart-close:hover { background: rgba(20,23,28,0.06); color: var(--text, #14171C); }
    .gm-cart-row { border: 1px solid var(--line-light, #E4E1D8); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
    .gm-cart-row-top { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--slate, #8A93A0); }
    .gm-cart-row-name { font-weight: 700; font-size: 14px; color: var(--text, #14171C); }
    .gm-cart-row-meta { font-size: 12.5px; color: var(--slate, #8A93A0); }
    .gm-cart-row-total { font-weight: 700; }
    .gm-cart-row-actions { display: flex; gap: 8px; margin-top: 4px; }
    .gm-cart-row-actions button { flex: 1; border-radius: 8px; padding: 8px 10px; font-size: 12.5px; font-weight: 700; border: 1px solid var(--line-light, #E4E1D8); background: var(--surface, #fff); color: var(--text, #14171C); font-family: inherit; }
    .gm-cart-row-actions button.gm-wa-action { border-color: #25D366; color: #1a8b47; }
    .gm-cart-row-actions button.gm-remove-action { border-color: var(--red-dark, #A60F1E); color: var(--red-dark, #A60F1E); }
    .gm-cart-empty { text-align: center; color: var(--slate, #8A93A0); font-size: 13.5px; padding: 30px 10px; }
    .gm-pill { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .gm-pill-new { background: rgba(216,37,59,0.12); color: var(--red-dark, #A60F1E); }
    .gm-pill-confirmed { background: rgba(95,112,82,0.15); color: var(--sage, #5F7052); }
    .gm-pill-done { background: rgba(20,23,28,0.1); color: var(--text, #14171C); }
    .gm-pill-cancelled { background: rgba(138,147,160,0.18); color: var(--slate, #8A93A0); }

    @media (max-width: 640px) {
      .gm-cart-overlay { align-items: flex-end; justify-content: center; }
      .gm-cart-panel { max-width: 100%; height: auto; max-height: 80vh; border-radius: 18px 18px 0 0; }
    }
  `;
  document.head.appendChild(style);

  let cartBtn = null;
  let cartOverlay = null;

  function ensureCartWidget() {
    if (cartBtn) return;
    cartBtn = document.createElement('button');
    cartBtn.type = 'button';
    cartBtn.className = 'gm-cart-btn';
    cartBtn.setAttribute('aria-label', TEXT.cartTitle);
    cartBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
      <span class="gm-cart-badge" id="gmCartBadge"></span>
    `;
    cartBtn.addEventListener('click', openCartPanel);
    document.body.appendChild(cartBtn);

    cartOverlay = document.createElement('div');
    cartOverlay.className = 'gm-cart-overlay';
    cartOverlay.hidden = true;
    cartOverlay.innerHTML = `
      <div class="gm-cart-panel" role="dialog" aria-modal="true" aria-labelledby="gmCartTitle">
        <div class="gm-cart-head">
          <h2 id="gmCartTitle">${TEXT.cartTitle}</h2>
          <button type="button" class="gm-cart-close" id="gmCartCloseBtn" aria-label="${TEXT.close}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div id="gmCartList"></div>
      </div>
    `;
    cartOverlay.addEventListener('mousedown', (e) => { if (e.target === cartOverlay) closeCartPanel(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cartOverlay.hidden) closeCartPanel(); });
    document.body.appendChild(cartOverlay);
    document.getElementById('gmCartCloseBtn').addEventListener('click', closeCartPanel);
  }

  function openCartPanel() {
    renderCartList();
    cartOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeCartPanel() {
    cartOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  function renderCartList() {
    const list = gmOrderStore.list();
    const listEl = document.getElementById('gmCartList');
    if (!list.length) {
      listEl.innerHTML = `<div class="gm-cart-empty">${TEXT.emptyCart}</div>`;
      return;
    }
    listEl.innerHTML = list.map((o) => `
      <div class="gm-cart-row">
        <div class="gm-cart-row-top"><span>${esc(o.code)}</span>${statusPillHtml(o.status)}</div>
        <div class="gm-cart-row-name">${esc(o.name)} × ${o.qty}</div>
        <div class="gm-cart-row-meta">${esc(formatDMY(o.date))} ${esc(o.time)}</div>
        <div class="gm-cart-row-total">${formatPrice(o.total)} ₾</div>
        <div class="gm-cart-row-actions">
          <button type="button" class="gm-wa-action" data-wa="${esc(o.code)}">${TEXT.waSend}</button>
          <button type="button" class="gm-remove-action" data-remove="${esc(o.code)}">${TEXT.removeBtn}</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-wa]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const order = list.find((o) => o.code === btn.dataset.wa);
        if (order && order.waLinkOrder) window.open(gm.waLinkFor(order.waLinkOrder), '_blank', 'noopener');
      });
    });
    listEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeCartRow(btn.dataset.remove, list));
    });
  }

  async function removeCartRow(code, list) {
    if (!window.confirm(TEXT.cancelConfirm)) return;
    const order = list.find((o) => o.code === code);
    if (!order) return;

    let currentUserId = null;
    try {
      const { data } = await window.gmAuthClient.auth.getSession();
      currentUserId = data.session && data.session.user ? data.session.user.id : null;
    } catch (e) {}

    if (currentUserId && order.ownerId === currentUserId && order.id) {
      const { error } = await supabaseClient.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      if (error) console.error('Could not cancel order', error);
    } else {
      gm.notify(TEXT.guestRemoveNote);
    }

    gmOrderStore.remove(code);
    renderCartList();
    renderCartWidget(false);
  }

  function renderCartWidget(bounce) {
    ensureCartWidget();
    const list = gmOrderStore.list();
    cartBtn.hidden = list.length === 0;
    document.getElementById('gmCartBadge').textContent = String(list.length);
    if (bounce) {
      cartBtn.classList.remove('gm-bounce');
      void cartBtn.offsetWidth;
      cartBtn.classList.add('gm-bounce');
    }
  }

  document.addEventListener('gm:order-placed', () => renderCartWidget(true));
  renderCartWidget(false);
})();
