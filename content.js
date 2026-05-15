(() => {
  'use strict';
  const LOG = (...args) => console.log('[InsDowload]', ...args);

  // --- Inject page-context script ---
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('injected.js');
  (document.head || document.documentElement).appendChild(s);
  s.onload = () => s.remove();

  // --- Listen for params from injected.js ---
  window.addEventListener('message', (e) => {
    if (e.data?.type === '__insdownload_params') {
      chrome.runtime.sendMessage({ type: 'update_params', data: e.data.payload });
    }
    if (e.data?.type === '__insdownload_docid') {
      chrome.runtime.sendMessage({ type: 'update_doc_id', data: e.data.payload });
    }
  });

  // --- Utilities ---
  function getShortcode() {
    const m = location.href.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[2] : null;
  }

  function getShortcodeFromEl(el) {
    const link = el.querySelector('a[href*="/p/"], a[href*="/reel/"], a[href*="/tv/"]');
    if (link) {
      const m = link.href.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      if (m) return m[2];
    }
    return null;
  }

  function shortcodeToMediaId(sc) {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = BigInt(0);
    for (const c of sc) id = id * 64n + BigInt(alpha.indexOf(c));
    return id.toString();
  }

  function getUsername() {
    // From article header
    const link = document.querySelector('article header a[href^="/"]');
    if (link) {
      const m = link.getAttribute('href').match(/^\/([A-Za-z0-9._]+)/);
      if (m) return m[1];
    }
    // From URL (profile page)
    const um = location.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (um && !['p','reel','reels','tv','stories','explore','direct','accounts'].includes(um[1])) {
      return um[1];
    }
    return 'unknown';
  }

  function getUsernameFromArticle(article) {
    const link = article.querySelector('header a[href^="/"]');
    if (link) {
      const m = link.getAttribute('href').match(/^\/([A-Za-z0-9._]+)/);
      if (m) return m[1];
    }
    return null;
  }

  // --- Core download action ---
  async function doDownload(shortcode, article) {
    if (!shortcode) {
      LOG('No shortcode found');
      alert('[InsDowload] No shortcode found in URL');
      return false;
    }
    const mediaId = shortcodeToMediaId(shortcode);
    const username = (article && getUsernameFromArticle(article)) || getUsername();
    LOG('Downloading:', { shortcode, mediaId, username });

    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'download_post',
        data: { mediaId, shortcode, username }
      });
      LOG('Response:', resp);
      if (resp?.error) {
        LOG('Download error:', resp.error);
        return false;
      }
      return resp?.ok && resp.count > 0;
    } catch (e) {
      LOG('sendMessage failed:', e.message);
      alert('[InsDowload] Communication error: ' + e.message + '\nPlease refresh this page (Ctrl+R)');
      return false;
    }
  }

  // --- Button creation ---
  const BTN_CLASS = 'insdownload-btn';

  function makeBtn(onClick) {
    const btn = document.createElement('button');
    btn.className = BTN_CLASS;
    btn.title = 'Download';
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('insdownload-loading');
      try {
        const ok = await onClick();
        btn.classList.remove('insdownload-loading');
        if (ok) {
          btn.classList.add('insdownload-done');
          setTimeout(() => btn.classList.remove('insdownload-done'), 3000);
        }
      } catch (err) {
        btn.classList.remove('insdownload-loading');
        LOG('Error:', err);
      }
    };
    return btn;
  }

  // --- Inject into feed articles ---
  function injectArticleButtons() {
    const articles = document.querySelectorAll('article');
    for (const article of articles) {
      if (article.dataset.insdownload) continue;
      article.dataset.insdownload = '1';

      const shortcode = getShortcodeFromEl(article) || getShortcode();
      if (!shortcode) continue;

      const btn = makeBtn(() => doDownload(shortcode, article));

      // Find action bar: section with multiple buttons
      let target = null;
      const sections = article.querySelectorAll('section');
      for (const sec of sections) {
        if (sec.querySelectorAll('button').length >= 2) {
          target = sec;
          break;
        }
      }
      if (!target) target = article.querySelector('section') || article;

      target.appendChild(btn);
      LOG('Button added to article');
    }
  }

  // --- Floating button for single post/reel pages ---
  // Uses Shadow DOM to isolate from Instagram's event system
  const FLOAT_ID = 'insdownload-float-host';
  let lastUrl = '';

  function injectFloatingButton() {
    const shortcode = getShortcode();

    if (!shortcode) {
      const el = document.getElementById(FLOAT_ID);
      if (el) el.remove();
      return;
    }

    if (document.getElementById(FLOAT_ID)) return;

    // Create host element with Shadow DOM
    const host = document.createElement('div');
    host.id = FLOAT_ID;
    host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        button {
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s, opacity 0.2s;
        }
        button:hover { transform: scale(1.1); }
        button.loading { opacity: 0.5; pointer-events: none; }
        button.done { background: #4caf50; }
      </style>
      <button title="Download this post">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
    `;

    const btn = shadow.querySelector('button');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      LOG('Float button clicked! Shortcode:', shortcode);
      btn.classList.add('loading');

      const ok = await doDownload(shortcode, document.querySelector('article'));

      btn.classList.remove('loading');
      if (ok) {
        btn.classList.add('done');
        setTimeout(() => btn.classList.remove('done'), 3000);
      }
    }, true);

    LOG('Floating button injected (shadow DOM) for:', shortcode);
  }

  // --- URL change detection (Instagram SPA) ---
  function checkUrl() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      LOG('URL changed:', lastUrl);
      const old = document.getElementById(FLOAT_ID);
      if (old) old.remove();
      setTimeout(injectFloatingButton, 800);
    }
  }

  // --- Init ---
  function init() {
    LOG('Content script loaded:', location.href);
    lastUrl = location.href;
    window.postMessage({ type: '__insdownload_request_params' }, '*');
    injectArticleButtons();
    injectFloatingButton();

    // Watch for DOM changes
    new MutationObserver(() => {
      injectArticleButtons();
    }).observe(document.body, { childList: true, subtree: true });

    // Watch for SPA navigation
    setInterval(checkUrl, 1000);

    // Retry floating button (Instagram loads slowly)
    setTimeout(injectFloatingButton, 2000);
    setTimeout(injectFloatingButton, 5000);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
