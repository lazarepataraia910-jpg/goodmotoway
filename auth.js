(function () {
  const SUPABASE_URL = 'https://lceebrhbvnyzoxkauugo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZWVicmhidm55em94a2F1dWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODkyNzAsImV4cCI6MjEwMTM2NTI3MH0.IeGvLg09wjni7OJdiLeAiO3pvrXxIUgzISNKnVKpXYI';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.gmAuthClient = client;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  window.gmEscapeHtml = escapeHtml;

  var yearEl = document.getElementById('gmYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var CLASSIC_CSS_BY_PAGE = {
    'index.html': 'classic-index.css',
    '': 'classic-index.css',
    'product.html': 'classic-product.css',
    'admin.html': 'classic-admin.css',
    'faq.html': 'classic-faq.css',
    'support.html': 'classic-support.css',
    'compare.html': 'classic-compare.css'
  };

  function classicHrefForCurrentPage() {
    var file = window.location.pathname.split('/').pop();
    return CLASSIC_CSS_BY_PAGE[file] || null;
  }

  function applyTheme(theme) {
    try { localStorage.setItem('gm_theme', theme); } catch (e) {}
    document.documentElement.removeAttribute('data-theme');
    var existingClassic = document.getElementById('gmClassicTheme');

    if (theme === 'classic') {
      if (!existingClassic) {
        var href = classicHrefForCurrentPage();
        if (href) {
          var link = document.createElement('link');
          link.id = 'gmClassicTheme';
          link.rel = 'stylesheet';
          link.href = href;
          document.head.appendChild(link);
        }
      }
      return;
    }

    if (existingClassic) existingClassic.remove();
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }
  window.gmApplyTheme = applyTheme;

  async function syncThemeFromProfile(userId) {
    const { data } = await client.from('profiles').select('theme').eq('id', userId).maybeSingle();
    if (data && data.theme) applyTheme(data.theme);
  }
  window.gmSyncThemeFromProfile = syncThemeFromProfile;

  async function ensureProfile(user) {
    const { data } = await client.from('profiles').select('id, theme').eq('id', user.id).maybeSingle();
    if (!data) {
      let startTheme = 'light';
      try {
        const saved = localStorage.getItem('gm_theme');
        if (saved === 'dark' || saved === 'classic') startTheme = saved;
      } catch (e) {}
      await client.from('profiles').insert({
        id: user.id,
        theme: startTheme,
        display_name: (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || null,
        avatar_url: (user.user_metadata && user.user_metadata.avatar_url) || null
      });
      return startTheme;
    }
    return data.theme;
  }

  function renderAuthSlot(user) {
    const slot = document.getElementById('authSlot');
    if (!slot) return;
    if (user) {
      const name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email || 'პროფილი';
      const avatar = user.user_metadata && user.user_metadata.avatar_url;
      const initial = name.trim().charAt(0).toUpperCase();
      const safeName = escapeHtml(name);
      slot.innerHTML =
        '<a href="profile.html" class="auth-chip auth-avatar-only" title="' + safeName + '" aria-label="' + safeName + '">' +
        (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="" class="auth-avatar" />' : '<span class="auth-avatar-fallback">' + escapeHtml(initial) + '</span>') +
        '</a>';
    } else {
      slot.innerHTML =
        '<button type="button" class="auth-chip auth-login-btn" id="gmGoogleLoginBtn">' +
        '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"/><path fill="#FBBC05" d="M5.4 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.4l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.7l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.6l4 3.1c.9-2.8 3.5-4.9 6.6-4.9z"/></svg>' +
        'შესვლა' +
        '</button>';
      const btn = document.getElementById('gmGoogleLoginBtn');
      if (btn) {
        btn.addEventListener('click', () => {
          client.auth.signInWithOAuth({ provider: 'google' });
        });
      }
    }
  }

  client.auth.getSession().then(({ data }) => {
    const user = data.session && data.session.user;
    renderAuthSlot(user || null);
    if (user) {
      ensureProfile(user).then((theme) => applyTheme(theme));
    }
  });

  client.auth.onAuthStateChange((_event, session) => {
    const user = session && session.user;
    renderAuthSlot(user || null);
    if (user) {
      ensureProfile(user).then((theme) => applyTheme(theme));
    }
  });

  var currentFile = window.location.pathname.split('/').pop() || 'index.html';
  var isAdminPage = currentFile === 'admin.html' || currentFile === 'admin';

  var chromeStyle = document.createElement('style');
  chromeStyle.textContent =
    '.gm-skip-link{position:absolute;left:12px;top:-60px;background:var(--red,#D8253B);color:#fff;' +
    'padding:10px 16px;border-radius:8px;z-index:9999;font-weight:700;font-size:13px;' +
    'transition:top 0.15s ease;text-decoration:none;}' +
    '.gm-skip-link:focus{top:12px;}' +
    '.gm-scroll-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:60;background:transparent;pointer-events:none;}' +
    '.gm-scroll-progress-fill{height:100%;width:0%;background:var(--red,#D8253B);}' +
    '.gm-back-to-top{position:fixed;right:20px;bottom:88px;width:44px;height:44px;border-radius:50%;' +
    'background:var(--surface,#fff);color:var(--text,#14171C);border:1px solid var(--line-light,#E4E1D8);' +
    'display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.15);' +
    'z-index:49;cursor:pointer;opacity:0;pointer-events:none;transform:translateY(8px);' +
    'transition:opacity 0.2s ease,transform 0.2s ease,border-color 0.15s ease,color 0.15s ease;}' +
    '.gm-back-to-top.show{opacity:1;pointer-events:auto;transform:translateY(0);}' +
    '.gm-back-to-top:hover{border-color:var(--red,#D8253B);color:var(--red,#D8253B);}' +
    '.gm-cookie-banner{position:fixed;left:16px;bottom:16px;max-width:300px;z-index:55;' +
    'background:var(--surface,#fff);color:var(--text,#14171C);border:1px solid var(--line-light,#E4E1D8);' +
    'border-radius:12px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,0.18);font-size:13px;line-height:1.5;}' +
    '.gm-cookie-banner button{margin-top:10px;background:var(--red,#D8253B);color:#fff;border:none;' +
    'border-radius:8px;padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;font-family:inherit;}' +
    '@media print{header,footer,.whatsapp-float,.gm-back-to-top,.gm-scroll-progress,.gm-cookie-banner,' +
    '.gm-skip-link,.nav-toggle,#authSlot,button{display:none!important;}' +
    'body{background:#fff!important;color:#000!important;}}';
  document.head.appendChild(chromeStyle);

  var mainEl = document.querySelector('main');
  if (mainEl && !mainEl.id) mainEl.id = 'gmMainContent';
  var skipLink = document.createElement('a');
  skipLink.className = 'gm-skip-link';
  skipLink.href = mainEl ? ('#' + mainEl.id) : '#';
  skipLink.textContent = 'კონტენტზე გადასვლა';
  document.body.insertBefore(skipLink, document.body.firstChild);

  if (!isAdminPage) {
    var progress = document.createElement('div');
    progress.className = 'gm-scroll-progress';
    var progressFill = document.createElement('div');
    progressFill.className = 'gm-scroll-progress-fill';
    progress.appendChild(progressFill);
    document.body.appendChild(progress);

    var backToTop = document.createElement('button');
    backToTop.type = 'button';
    backToTop.className = 'gm-back-to-top';
    backToTop.setAttribute('aria-label', 'ზემოთ დაბრუნება');
    backToTop.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(backToTop);

    function updateScrollChrome() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      progressFill.style.width = pct + '%';
      backToTop.classList.toggle('show', scrollTop > 400);
    }
    window.addEventListener('scroll', updateScrollChrome, { passive: true });
    updateScrollChrome();

    if (!localStorage.getItem('gm_cookie_ack')) {
      var cookieBanner = document.createElement('div');
      cookieBanner.className = 'gm-cookie-banner';
      cookieBanner.innerHTML =
        '<p style="margin:0;">🍪 საიტი იყენებს მხოლოდ აუცილებელ ლოკალურ საცავს თემისა და პროფილის პარამეტრების დასამახსოვრებლად.</p>' +
        '<button type="button">გასაგებია</button>';
      cookieBanner.querySelector('button').addEventListener('click', function () {
        try { localStorage.setItem('gm_cookie_ack', '1'); } catch (e) {}
        cookieBanner.remove();
      });
      document.body.appendChild(cookieBanner);
    }
  }

  function captureUtm() {
    var params = new URLSearchParams(window.location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    var utm = {};
    var found = false;
    keys.forEach(function (k) {
      var v = params.get(k);
      if (v) { utm[k] = v; found = true; }
    });
    if (found) {
      try { sessionStorage.setItem('gm_utm', JSON.stringify(utm)); } catch (e) {}
      if (window.va) window.va('event', { name: 'utm_visit', data: utm });
    }
    try { return JSON.parse(sessionStorage.getItem('gm_utm') || 'null'); } catch (e) { return null; }
  }

  if (!isAdminPage) {
    var utmData = captureUtm();
    if (utmData) {
      var utmSource = utmData.utm_source || utmData.utm_campaign;
      if (utmSource) {
        var waMessage = 'გამარჯობა! მოვედი წყაროდან: ' + utmSource;
        document.querySelectorAll('a.whatsapp-float').forEach(function (a) {
          try {
            var url = new URL(a.href);
            url.searchParams.set('text', waMessage);
            a.href = url.toString();
          } catch (e) {}
        });
      }
    }
  }
})();
