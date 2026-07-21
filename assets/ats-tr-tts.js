(() => {
  'use strict';

  const STYLE_ID = 'ats-tr-tts-style';
  const BUTTON_CLASS = 'ats-tr-tts-button';
  const isEnglishUi = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  let activeAudio = null;
  let activeButton = null;
  let activeObjectUrl = '';

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BUTTON_CLASS}{
        display:inline-grid;place-items:center;flex:0 0 auto;width:26px;height:26px;margin-left:6px;padding:0;
        border:1px solid rgba(47,78,113,.20);border-radius:999px;background:rgba(255,255,255,.74);
        color:#2f4e71;font:400 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;
        transition:border-color .14s ease,background .14s ease,box-shadow .14s ease,transform .14s ease;
      }
      .${BUTTON_CLASS}:hover{border-color:#7f95ad;background:#fff;box-shadow:0 4px 12px -9px rgba(32,57,90,.65);transform:translateY(-1px)}
      .${BUTTON_CLASS}:focus-visible{outline:2px solid rgba(47,78,113,.32);outline-offset:2px}
      .${BUTTON_CLASS}[aria-pressed="true"]{background:#2f4e71;border-color:#2f4e71;color:#fff}
      .${BUTTON_CLASS}[data-loading="true"]{cursor:progress;opacity:.68}
      .${BUTTON_CLASS}:disabled{cursor:progress;opacity:.58}
      .detail-card .label-row .${BUTTON_CLASS}{width:25px;height:25px;margin-left:7px}
    `;
    document.head.appendChild(style);
  }

  function cleanText(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text === '—' ? '' : text;
  }

  function buttonLabel(profile, text) {
    if (isEnglishUi) return profile === 'ottoman' ? `Pronounce Ottoman/period form: ${text}` : `Pronounce modern Turkish form: ${text}`;
    return profile === 'ottoman' ? `Osmanlıca / dönem karşılığını seslendir: ${text}` : `Günümüz karşılığını seslendir: ${text}`;
  }

  function makeButton(text, profile) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS;
    button.dataset.ttsText = text;
    button.dataset.ttsProfile = profile;
    button.setAttribute('aria-label', buttonLabel(profile, text));
    button.setAttribute('title', buttonLabel(profile, text));
    button.setAttribute('aria-pressed', 'false');
    button.textContent = '🔊';
    return button;
  }

  function attachListButton(mainline, profile) {
    if (!mainline || mainline.querySelector(`.${BUTTON_CLASS}[data-tts-profile="${profile}"]`)) return;
    const value = mainline.querySelector('.value');
    const text = cleanText(value?.textContent);
    if (!text) return;
    mainline.appendChild(makeButton(text, profile));
  }

  function attachDetailButton(card, profile) {
    if (!card) return;
    const labelRow = card.querySelector('.label-row');
    if (!labelRow || labelRow.querySelector(`.${BUTTON_CLASS}[data-tts-profile="${profile}"]`)) return;
    const text = cleanText(card.querySelector('.detail-value')?.textContent);
    if (!text) return;
    labelRow.appendChild(makeButton(text, profile));
  }

  function scan() {
    document.querySelectorAll('.row .cell-ottoman .cell-mainline').forEach(node => attachListButton(node, 'ottoman'));
    document.querySelectorAll('.row .cell-modern .cell-mainline').forEach(node => attachListButton(node, 'modern'));
    document.querySelectorAll('.detail-card.ottoman').forEach(node => attachDetailButton(node, 'ottoman'));
    document.querySelectorAll('.detail-card.modern').forEach(node => attachDetailButton(node, 'modern'));
  }

  function resetActiveButton() {
    if (activeButton) {
      activeButton.setAttribute('aria-pressed', 'false');
      activeButton.dataset.loading = 'false';
      activeButton.disabled = false;
    }
    activeButton = null;
  }

  function stopAudio() {
    if (activeAudio) {
      try { activeAudio.pause(); activeAudio.currentTime = 0; } catch {}
      activeAudio = null;
    }
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = '';
    }
    resetActiveButton();
  }

  async function play(button) {
    const text = cleanText(button.dataset.ttsText);
    const profile = button.dataset.ttsProfile === 'ottoman' ? 'ottoman' : 'modern';
    if (!text) return;

    if (activeButton === button && activeAudio && !activeAudio.paused) {
      stopAudio();
      return;
    }

    stopAudio();
    activeButton = button;
    button.dataset.loading = 'true';
    button.disabled = true;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'audio/mpeg, application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, profile })
      });

      if (!response.ok) {
        let data = {};
        try { data = await response.json(); } catch {}
        if (data.error === 'tts_not_configured') {
          throw new Error(isEnglishUi ? 'Turkish pronunciation service is not configured yet.' : 'Türkçe seslendirme servisi henüz yapılandırılmadı.');
        }
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      activeObjectUrl = URL.createObjectURL(blob);
      activeAudio = new Audio(activeObjectUrl);
      button.dataset.loading = 'false';
      button.disabled = false;
      button.setAttribute('aria-pressed', 'true');

      activeAudio.addEventListener('ended', stopAudio, { once: true });
      activeAudio.addEventListener('error', stopAudio, { once: true });
      await activeAudio.play();
    } catch (error) {
      stopAudio();
      const message = String(error?.message || error);
      console.error('[ATS TTS]', message);
      window.alert(message);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest(`.${BUTTON_CLASS}`);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    play(button);
  }, true);

  installStyle();
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('beforeunload', stopAudio);
})();
