(() => {
  'use strict';

  const tr = !(document.documentElement.lang || '').toLowerCase().startsWith('en');
  const signInHref = tr ? '/oturum-ac/' : '/en/sign-in/';
  let activeSlug = '';

  function slugFromNode(node) {
    const target = node?.closest?.('[data-slug]');
    return target?.dataset?.slug || '';
  }

  function currentDrawer() {
    return document.querySelector('.drawer.open .dialog');
  }

  function actionHost(dialog) {
    return dialog?.querySelector('.dialog-head') || null;
  }

  async function session() {
    if (window.ATSCommunitySession) return window.ATSCommunitySession;
    try {
      const response = await fetch('/api/account/session', { credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'} });
      return await response.json();
    } catch { return { authenticated:false }; }
  }

  async function decorateDrawer() {
    const dialog = currentDrawer();
    const host = actionHost(dialog);
    if (!dialog || !host || !activeSlug) return;
    host.querySelectorAll('.community-drawer-action').forEach(node => node.remove());
    const current = await session();
    if (!current?.authenticated) {
      const link = document.createElement('a');
      link.className = 'community-drawer-action community-drawer-login';
      link.href = `${signInHref}?return=${encodeURIComponent(location.pathname + location.search)}`;
      link.textContent = tr ? '☆ Favoriler için oturum aç' : '☆ Sign in for favourites';
      host.appendChild(link);
      return;
    }

    let favourite = false;
    try {
      const response = await fetch(`/api/account/favorites/${encodeURIComponent(activeSlug)}`, { credentials:'same-origin', cache:'no-store', headers:{Accept:'application/json'} });
      const data = await response.json();
      favourite = Boolean(data?.favorite);
    } catch {}

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'community-drawer-action community-drawer-favourite';
    const sync = () => {
      button.setAttribute('aria-pressed', favourite ? 'true' : 'false');
      button.textContent = favourite ? (tr ? '★ Favorilerde' : '★ Favourite') : (tr ? '☆ Favorilere ekle' : '☆ Add to favourites');
    };
    sync();
    button.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation();
      button.disabled = true;
      try {
        const response = await fetch(`/api/account/favorites/${encodeURIComponent(activeSlug)}`, {
          method: favourite ? 'DELETE' : 'PUT',
          credentials:'same-origin',
          headers:{Accept:'application/json','X-CSRF-Token':current.csrfToken}
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'request_failed');
        favourite = Boolean(data.favorite); sync();
      } catch (error) { console.error('[ATS favourites]', error); }
      finally { button.disabled = false; }
    });
    host.appendChild(button);
  }

  function installStyle() {
    if (document.getElementById('ats-community-dictionary-style')) return;
    const style = document.createElement('style');
    style.id = 'ats-community-dictionary-style';
    style.textContent = `
      .community-drawer-action{flex:0 0 auto;margin-left:auto;min-height:32px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #cfc7b8;border-radius:8px;background:#fffefa;color:#2f4e71;text-decoration:none;font:600 11.5px Cambria,Georgia,serif;cursor:pointer;white-space:nowrap}
      .community-drawer-action:hover,.community-drawer-action:focus-visible{border-color:#2f4e71}
      .community-drawer-favourite[aria-pressed="true"]{background:#2f4e71;border-color:#2f4e71;color:#fff}
      @media(max-width:650px){.community-drawer-action{margin-left:0;margin-top:7px}.dialog-head{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('click', event => {
    const slug = slugFromNode(event.target);
    if (slug) activeSlug = slug;
    if (slug) setTimeout(decorateDrawer, 30);
  }, true);

  const observer = new MutationObserver(() => {
    if (currentDrawer() && activeSlug && !currentDrawer().querySelector('.community-drawer-action')) decorateDrawer();
  });
  observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  installStyle();
})();
