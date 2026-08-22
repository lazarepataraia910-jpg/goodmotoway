(function () {
  const SUPABASE_URL = 'https://lceebrhbvnyzoxkauugo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZWVicmhidm55em94a2F1dWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODkyNzAsImV4cCI6MjEwMTM2NTI3MH0.IeGvLg09wjni7OJdiLeAiO3pvrXxIUgzISNKnVKpXYI';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.gmAuthClient = client;

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
      slot.innerHTML =
        '<a href="profile.html" class="auth-chip auth-avatar-only" title="' + name + '" aria-label="' + name + '">' +
        (avatar ? '<img src="' + avatar + '" alt="" class="auth-avatar" />' : '<span class="auth-avatar-fallback">' + initial + '</span>') +
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
})();
