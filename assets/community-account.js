(() => {
  'use strict';

  const body = document.body;
  const mode = body.dataset.mode || '';
  const tr = body.dataset.lang !== 'en';
  const $ = id => document.getElementById(id);
  let config = null;
  let session = null;
  let csrf = '';
  const turnstileWidgets = new Map();

  const text = {
    requiredConfig: tr ? 'Üyelik sistemi henüz etkinleştirilmedi. Sözlük üyelik olmadan açık ve ücretsizdir.' : 'Membership is not enabled yet. The dictionary remains open and free without an account.',
    genericError: tr ? 'İşlem tamamlanamadı.' : 'The request could not be completed.',
    weakPassword: tr ? 'Parola en az 12 karakter olmalı; en az bir harf ve bir rakam içermelidir.' : 'Password must be at least 12 characters and include at least one letter and one number.',
    invalidEmail: tr ? 'Geçerli bir e-posta adresi yazın.' : 'Enter a valid email address.',
    emailExists: tr ? 'Bu e-posta ile doğrulanmış bir üyelik zaten bulunuyor.' : 'A verified account already exists for this email.',
    invalidCredentials: tr ? 'E-posta veya parola doğrulanamadı.' : 'Email or password could not be verified.',
    notVerified: tr ? 'E-posta adresiniz henüz doğrulanmamış.' : 'Your email address has not been verified yet.',
    rateLimited: tr ? 'Çok fazla deneme yapıldı. Lütfen bir süre sonra yeniden deneyin.' : 'Too many attempts. Please try again later.',
    turnstile: tr ? 'Güvenlik doğrulaması tamamlanamadı. Lütfen yeniden deneyin.' : 'Security verification failed. Please try again.'
  };

  function status(message, type = '') {
    const box = $('communityStatus');
    if (!box) return;
    box.textContent = message || '';
    box.className = `community-status${type ? ` ${type}` : ''}`;
  }

  function errorMessage(error) {
    const code = error?.message || error?.error || '';
    const map = {
      weak_password: text.weakPassword,
      invalid_email: text.invalidEmail,
      email_exists: text.emailExists,
      invalid_credentials: text.invalidCredentials,
      email_not_verified: text.notVerified,
      rate_limited: text.rateLimited,
      turnstile_required: text.turnstile,
      turnstile_failed: text.turnstile,
      turnstile_action_mismatch: text.turnstile,
      turnstile_unavailable: text.turnstile,
      turnstile_not_configured: text.requiredConfig,
      community_email_not_configured: text.requiredConfig,
      community_security_not_configured: text.requiredConfig,
      database_not_configured: text.requiredConfig,
      verification_email_failed: tr ? 'Doğrulama e-postası gönderilemedi. Biraz sonra yeniden deneyin.' : 'Verification email could not be sent. Please try again later.',
      invalid_reset_token: tr ? 'Parola yenileme bağlantısı geçersiz veya süresi dolmuş.' : 'The password reset link is invalid or expired.',
      contribution_too_short: tr ? 'Katkı notu en az 10 karakter olmalıdır.' : 'Contribution note must be at least 10 characters.'
    };
    return map[code] || text.genericError;
  }

  async function api(path, options = {}) {
    const headers = { Accept:'application/json', ...(options.headers || {}) };
    if (options.body && typeof options.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    if (csrf && options.method && options.method !== 'GET') headers['X-CSRF-Token'] = csrf;
    const response = await fetch(path, { credentials:'same-origin', cache:'no-store', ...options, headers });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok || !data.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.data = data; throw error;
    }
    return data;
  }

  async function loadConfig() {
    config = await api('/api/account/config');
    return config;
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-ats-turnstile]');
      if (existing) {
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true; script.dataset.atsTurnstile = '1';
      script.addEventListener('load', resolve, { once:true });
      script.addEventListener('error', reject, { once:true });
      document.head.appendChild(script);
    });
  }

  async function renderTurnstile(containerId, action) {
    if (!config?.turnstileSiteKey) return;
    await loadTurnstileScript();
    const element = $(containerId);
    if (!element || turnstileWidgets.has(containerId)) return;
    const widgetId = window.turnstile.render(element, {
      sitekey: config.turnstileSiteKey,
      action,
      theme: 'light',
      size: 'flexible',
      language: tr ? 'tr' : 'en'
    });
    turnstileWidgets.set(containerId, widgetId);
  }

  function turnstileToken(containerId) {
    const widgetId = turnstileWidgets.get(containerId);
    if (widgetId === undefined || !window.turnstile) return '';
    return window.turnstile.getResponse(widgetId) || '';
  }

  function resetTurnstile(containerId) {
    const widgetId = turnstileWidgets.get(containerId);
    if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId);
  }

  function safeReturn(value) {
    try {
      const target = new URL(value || '', location.origin);
      return target.origin === location.origin ? target.pathname + target.search + target.hash : '';
    } catch { return ''; }
  }

  function profileValues() {
    return {
      displayName: $('displayName')?.value || '',
      institution: $('institution')?.value || '',
      interestArea: $('interestArea')?.value || '',
      locale: tr ? 'tr' : 'en',
      notifyNewTerms: Boolean($('notifyNewTerms')?.checked),
      notifyUpdates: Boolean($('notifyUpdates')?.checked)
    };
  }

  function setButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = Boolean(busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  async function initSignup() {
    await loadConfig();
    const form = $('signupForm');
    if (!config.registrationReady) {
      status(text.requiredConfig, 'error');
      form?.querySelectorAll('input,select,button').forEach(el => el.disabled = true);
      return;
    }
    await renderTurnstile('turnstileSignup', 'signup');
    form.addEventListener('submit', async event => {
      event.preventDefault(); status('');
      const button = event.submitter; setButtonBusy(button, true);
      try {
        const payload = {
          email: $('email').value,
          password: $('password').value,
          ...profileValues(),
          turnstileToken: turnstileToken('turnstileSignup')
        };
        await api('/api/account/register', { method:'POST', body:payload });
        form.reset();
        status(tr ? 'Doğrulama bağlantısı e-posta adresinize gönderildi. Bağlantıyı açtıktan sonra oturum açabilirsiniz.' : 'A verification link has been sent to your email. Open it before signing in.', 'success');
      } catch (error) { status(errorMessage(error), 'error'); }
      finally { setButtonBusy(button, false); resetTurnstile('turnstileSignup'); }
    });
  }

  async function initSignin() {
    await loadConfig();
    const params = new URLSearchParams(location.search);
    if (params.get('verification') === 'success') status(tr ? 'E-posta adresiniz doğrulandı. Şimdi oturum açabilirsiniz.' : 'Your email has been verified. You can sign in now.', 'success');
    if (params.get('verification') === 'invalid') status(tr ? 'Doğrulama bağlantısı geçersiz veya süresi dolmuş.' : 'The verification link is invalid or expired.', 'error');
    if (!config.turnstileConfigured) status(text.requiredConfig, 'error');
    await Promise.all([
      renderTurnstile('turnstileLogin', 'login'),
      renderTurnstile('turnstileResend', 'resend'),
      renderTurnstile('turnstileResetRequest', 'reset')
    ]);

    $('signinForm')?.addEventListener('submit', async event => {
      event.preventDefault(); status('');
      const button = event.submitter; setButtonBusy(button, true);
      try {
        const data = await api('/api/account/login', {
          method:'POST', body:{ email:$('email').value, password:$('password').value, turnstileToken:turnstileToken('turnstileLogin') }
        });
        csrf = data.csrfToken || '';
        const target = safeReturn(params.get('return')) || (tr ? '/hesabim/' : '/en/account/');
        location.replace(target);
      } catch (error) { status(errorMessage(error), 'error'); }
      finally { setButtonBusy(button, false); resetTurnstile('turnstileLogin'); }
    });

    $('resendForm')?.addEventListener('submit', async event => {
      event.preventDefault(); status(''); const button = event.submitter; setButtonBusy(button, true);
      try {
        await api('/api/account/resend-verification', { method:'POST', body:{ email:$('resendEmail').value, turnstileToken:turnstileToken('turnstileResend') } });
        status(tr ? 'Hesap doğrulanmamışsa yeni doğrulama bağlantısı gönderildi.' : 'If the account is unverified, a new verification link has been sent.', 'success');
      } catch (error) { status(errorMessage(error), 'error'); }
      finally { setButtonBusy(button, false); resetTurnstile('turnstileResend'); }
    });

    $('resetRequestForm')?.addEventListener('submit', async event => {
      event.preventDefault(); status(''); const button = event.submitter; setButtonBusy(button, true);
      try {
        await api('/api/account/password-reset/request', { method:'POST', body:{ email:$('resetEmail').value, turnstileToken:turnstileToken('turnstileResetRequest') } });
        status(tr ? 'Bu adresle doğrulanmış bir hesap varsa parola yenileme bağlantısı gönderildi.' : 'If a verified account exists for this address, a password reset link has been sent.', 'success');
      } catch (error) { status(errorMessage(error), 'error'); }
      finally { setButtonBusy(button, false); resetTurnstile('turnstileResetRequest'); }
    });
  }

  async function loadSessionOrRedirect() {
    const data = await api('/api/account/session');
    if (!data.authenticated) {
      const here = location.pathname + location.search;
      location.replace(`${tr ? '/oturum-ac/' : '/en/sign-in/'}?return=${encodeURIComponent(here)}`);
      return null;
    }
    session = data; csrf = data.csrfToken || '';
    return data;
  }

  function fillProfile(user) {
    if ($('accountEmail')) $('accountEmail').textContent = user.email || '';
    if ($('displayName')) $('displayName').value = user.displayName || '';
    if ($('institution')) $('institution').value = user.institution || '';
    if ($('interestArea')) $('interestArea').value = user.interestArea || '';
    if ($('notifyNewTerms')) $('notifyNewTerms').checked = Boolean(user.notifyNewTerms);
    if ($('notifyUpdates')) $('notifyUpdates').checked = Boolean(user.notifyUpdates);
  }

  async function loadFavorites() {
    const box = $('favoriteList'); if (!box) return;
    const data = await api('/api/account/favorites');
    if (!data.items?.length) {
      box.innerHTML = `<div class="empty-state">${tr ? 'Henüz favori madde eklemediniz.' : 'You have not added any favourite entries yet.'}</div>`;
      return;
    }
    box.innerHTML = '';
    for (const item of data.items) {
      const wrapper = document.createElement('div'); wrapper.className = 'favorite-item';
      const info = document.createElement('div');
      const link = document.createElement('a');
      link.href = tr ? `/terim/${encodeURIComponent(item.slug)}/` : `/en/term/${encodeURIComponent(item.slug)}/`;
      link.textContent = item.headword_en || item.slug;
      const small = document.createElement('small'); small.textContent = item.modern_equivalent_tr || item.ottoman_period_term || '';
      info.append(link, small);
      const remove = document.createElement('button'); remove.type='button'; remove.className='favorite-remove'; remove.title = tr ? 'Favorilerden çıkar' : 'Remove from favourites'; remove.textContent='×';
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try { await api(`/api/account/favorites/${encodeURIComponent(item.slug)}`, { method:'DELETE' }); await loadFavorites(); }
        catch (error) { status(errorMessage(error), 'error'); remove.disabled=false; }
      });
      wrapper.append(info, remove); box.appendChild(wrapper);
    }
  }

  async function loadContributions() {
    const box = $('contributionList'); if (!box) return;
    const data = await api('/api/account/contributions');
    if (!data.items?.length) { box.innerHTML=''; return; }
    box.innerHTML = data.items.map(item => {
      const date = String(item.created_at || '').slice(0,10);
      const label = item.status === 'new' ? (tr ? 'Yeni' : 'New') : item.status;
      return `<div class="contribution-item"><strong>${item.term_slug || (tr ? 'Genel öneri' : 'General suggestion')}</strong><br>${escapeHtml(item.message)}<br><small>${date} · ${label}</small></div>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function initAccount() {
    const current = await loadSessionOrRedirect(); if (!current) return;
    fillProfile(current.user);
    const params = new URLSearchParams(location.search);
    if (params.get('unsubscribed') === '1') status(tr ? 'E-posta bildirimleri kapatıldı.' : 'Email notifications have been disabled.', 'success');
    const suggestedSlug = params.get('term'); if (suggestedSlug && $('contributionTerm')) $('contributionTerm').value = suggestedSlug;
    await Promise.all([loadFavorites(), loadContributions()]);

    $('profileForm')?.addEventListener('submit', async event => {
      event.preventDefault(); status(''); const button=event.submitter; setButtonBusy(button,true);
      try {
        const data = await api('/api/account/profile', { method:'PUT', body:profileValues() });
        fillProfile(data.user); status(tr ? 'Profil ve bildirim tercihleri kaydedildi.' : 'Profile and notification preferences saved.', 'success');
      } catch(error){ status(errorMessage(error),'error'); }
      finally{ setButtonBusy(button,false); }
    });

    $('contributionForm')?.addEventListener('submit', async event => {
      event.preventDefault(); status(''); const button=event.submitter; setButtonBusy(button,true);
      try {
        await api('/api/account/contributions', { method:'POST', body:{ termSlug:$('contributionTerm').value, suggestionType:$('suggestionType').value, message:$('contributionMessage').value } });
        $('contributionMessage').value=''; status(tr ? 'Katkı öneriniz editör incelemesine gönderildi.' : 'Your contribution suggestion has been sent for editorial review.', 'success'); await loadContributions();
      } catch(error){ status(errorMessage(error),'error'); }
      finally{ setButtonBusy(button,false); }
    });

    $('passwordForm')?.addEventListener('submit', async event => {
      event.preventDefault(); status(''); const button=event.submitter; setButtonBusy(button,true);
      try {
        await api('/api/account/password', { method:'PUT', body:{ currentPassword:$('currentPassword').value, newPassword:$('newPassword').value } });
        event.currentTarget.reset(); status(tr ? 'Parolanız değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.' : 'Your password has been changed. Sessions on other devices were signed out.', 'success');
      } catch(error){ status(errorMessage(error),'error'); }
      finally{ setButtonBusy(button,false); }
    });

    $('logoutBtn')?.addEventListener('click', async () => {
      try { await api('/api/account/logout', { method:'POST' }); } catch {}
      location.replace(tr ? '/' : '/en/');
    });

    $('deleteAccountForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      const confirmation = tr ? 'Üyelik hesabınız, favorileriniz ve katkı kayıtlarınız silinecek. Bu işlem geri alınamaz. Devam edilsin mi?' : 'Your account, favourites and contribution records will be deleted. This cannot be undone. Continue?';
      if (!confirm(confirmation)) return;
      const button=event.submitter; setButtonBusy(button,true);
      try {
        await api('/api/account/profile', { method:'DELETE', body:{ password:$('deletePassword').value } });
        location.replace(tr ? '/?account=deleted' : '/en/?account=deleted');
      } catch(error){ status(errorMessage(error),'error'); setButtonBusy(button,false); }
    });
  }

  async function initReset() {
    const token = new URLSearchParams(location.search).get('token') || '';
    if (!token) { status(errorMessage(new Error('invalid_reset_token')), 'error'); $('resetPasswordForm')?.querySelectorAll('input,button').forEach(el=>el.disabled=true); return; }
    $('resetPasswordForm')?.addEventListener('submit', async event => {
      event.preventDefault(); status(''); const button=event.submitter; setButtonBusy(button,true);
      try {
        await api('/api/account/password-reset/confirm', { method:'POST', body:{ token, password:$('newPassword').value } });
        status(tr ? 'Parolanız yenilendi. Oturum açma sayfasına yönlendiriliyorsunuz.' : 'Your password has been reset. Redirecting to sign in.', 'success');
        setTimeout(()=>location.replace(tr?'/oturum-ac/':'/en/sign-in/'),1200);
      } catch(error){ status(errorMessage(error),'error'); setButtonBusy(button,false); }
    });
  }

  (async () => {
    try {
      if (mode === 'signup') await initSignup();
      else if (mode === 'signin') await initSignin();
      else if (mode === 'account') await initAccount();
      else if (mode === 'reset') await initReset();
    } catch (error) {
      console.error('[ATS community account]', error);
      status(errorMessage(error), 'error');
    }
  })();
})();
