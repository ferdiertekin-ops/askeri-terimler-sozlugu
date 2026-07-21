(() => {
  'use strict';

  const tr = !(document.documentElement.lang || '').toLowerCase().startsWith('en');
  const accountHref = tr ? '/hesabim/' : '/en/account/';
  const signInHref = tr ? '/oturum-ac/' : '/en/sign-in/';
  const signUpHref = tr ? '/uye-ol/' : '/en/sign-up/';

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function defaultNav() {
    return `<a class="community-login" href="${signInHref}">${tr ? 'Oturum Aç' : 'Sign in'}</a><a class="community-signup" href="${signUpHref}">${tr ? 'Üye Ol' : 'Join'}</a>`;
  }

  function renderNav(session) {
    document.querySelectorAll('[data-community-nav]').forEach(nav => {
      if (session?.authenticated) {
        const count = Number(session.favoriteCount || 0);
        nav.innerHTML = `<a class="community-account" href="${accountHref}">${tr ? 'Hesabım' : 'My account'}${count ? ` <span class="community-count">${count}</span>` : ''}</a>`;
      } else if (!nav.children.length) {
        nav.innerHTML = defaultNav();
      }
    });
  }

  async function readSession() {
    try {
      const response = await fetch('/api/account/session', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) return { authenticated: false };
      return data;
    } catch {
      return { authenticated: false };
    }
  }

  function installStyle() {
    if (document.getElementById('ats-community-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'ats-community-nav-style';
    style.textContent = `
      .community-auth-nav{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
      .community-auth-nav a{min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0 11px;border-radius:8px;text-decoration:none;font:600 12px Cambria,Georgia,serif;letter-spacing:.01em}
      .community-login{border:1px solid #cfc7b8;background:#fffefa;color:#2f4e71}
      .community-signup{border:1px solid #2f4e71;background:#2f4e71;color:#fffefa!important}
      .community-account{border:1px solid #cfc7b8;background:#fffefa;color:#2f4e71!important}
      .community-auth-nav a:hover,.community-auth-nav a:focus-visible{transform:translateY(-1px);box-shadow:0 4px 12px -7px rgba(47,78,113,.38)}
      .community-count{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border-radius:999px;background:#2f4e71;color:#fff;font:700 10px/1 system-ui,sans-serif}
      .community-term-favorite{display:inline-flex;align-items:center;gap:6px;margin:0;padding:7px 10px;border:1px solid #cfc7b8;border-radius:8px;background:#fffefa;color:#2f4e71;font:600 12px Cambria,Georgia,serif;cursor:pointer}
      .community-term-favorite[aria-pressed="true"]{background:#2f4e71;border-color:#2f4e71;color:#fff}
      .community-term-favorite:hover,.community-term-favorite:focus-visible{border-color:#2f4e71}
      @media(max-width:700px){.community-auth-nav{gap:5px}.community-auth-nav a{min-height:32px;padding:0 8px;font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  async function attachTermFavorite(session) {
    if (!session?.authenticated) return;
    const match = location.pathname.match(/^\/(?:en\/term|terim)\/([^/]+)\/?$/);
    if (!match) return;
    const slug = decodeURIComponent(match[1]);
    const head = document.querySelector('.term-head');
    if (!head || head.querySelector('.community-term-favorite')) return;
    let state = false;
    try {
      const response = await fetch(`/api/account/favorites/${encodeURIComponent(slug)}`, { credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'} });
      const data = await response.json();
      state = Boolean(data?.favorite);
    } catch {}
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'community-term-favorite';
    const sync = () => {
      button.setAttribute('aria-pressed', state ? 'true' : 'false');
      button.textContent = state ? (tr ? '★ Favorilerde' : '★ Favourite') : (tr ? '☆ Favorilere ekle' : '☆ Add to favourites');
    };
    sync();
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const response = await fetch(`/api/account/favorites/${encodeURIComponent(slug)}`, {
          method: state ? 'DELETE' : 'PUT', credentials:'same-origin',
          headers:{Accept:'application/json','X-CSRF-Token':session.csrfToken}
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'request_failed');
        state = Boolean(data.favorite); sync();
      } catch (error) { console.error('[ATS community]', error); }
      finally { button.disabled = false; }
    });
    head.appendChild(button);
  }

  installStyle();
  document.querySelectorAll('[data-community-nav]').forEach(nav => {
    if (!nav.children.length) nav.innerHTML = defaultNav();
  });
  const sessionPromise = readSession().then(session => {
    renderNav(session);
    attachTermFavorite(session);
    document.dispatchEvent(new CustomEvent('ats:community-session', { detail: session }));
    return session;
  });
  window.ATSCommunitySession = sessionPromise;
})();
