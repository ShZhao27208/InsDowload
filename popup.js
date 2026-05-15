document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const typeBtns = document.querySelectorAll('.type-btn');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const statusEl = document.getElementById('status');
  const usernameInput = document.getElementById('username');
  const currentPostDiv = document.getElementById('current-post');
  const btnCurrent = document.getElementById('btn-current');
  const currentStatus = document.getElementById('current-status');

  let selectedType = 'posts';

  // --- Detect current post and show download button ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    const url = tabs[0].url || '';

    // Check if on a post/reel page
    const postMatch = url.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (postMatch) {
      currentPostDiv.style.display = 'block';
      const shortcode = postMatch[2];

      btnCurrent.addEventListener('click', async () => {
        btnCurrent.disabled = true;
        btnCurrent.textContent = 'Downloading...';
        currentStatus.textContent = '';

        const mediaId = shortcodeToMediaId(shortcode);
        // Try to get username from URL
        const userMatch = url.match(/instagram\.com\/([A-Za-z0-9._]+)\//);
        const username = (userMatch && !['p','reel','reels','tv'].includes(userMatch[1]))
          ? userMatch[1] : 'unknown';

        try {
          const resp = await chrome.runtime.sendMessage({
            type: 'download_post',
            data: { mediaId, shortcode, username }
          });
          if (resp?.ok) {
            currentStatus.textContent = `Downloaded ${resp.count} file(s)`;
            currentStatus.className = 'status success';
          } else {
            currentStatus.textContent = resp?.error || 'Download failed';
            currentStatus.className = 'status error';
          }
        } catch (e) {
          currentStatus.textContent = e.message;
          currentStatus.className = 'status error';
        }

        btnCurrent.disabled = false;
        btnCurrent.textContent = 'Download Current Post';
      });
    }

    // Auto-fill username for batch
    const profileMatch = url.match(/instagram\.com\/([A-Za-z0-9._]+)\/?(\?|$)/);
    if (profileMatch && !['p','reel','reels','tv','stories','explore','direct','accounts'].includes(profileMatch[1])) {
      usernameInput.value = profileMatch[1];
    }
  });

  // Shortcode to media ID (same algorithm as content.js)
  function shortcodeToMediaId(sc) {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = BigInt(0);
    for (const c of sc) id = id * 64n + BigInt(alpha.indexOf(c));
    return id.toString();
  }

  // --- Tabs ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // --- Type selection ---
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedType = btn.dataset.type;
    });
  });

  // --- Start batch download ---
  btnStart.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) {
      showStatus('Please enter a username', 'error');
      return;
    }

    btnStart.style.display = 'none';
    btnStop.style.display = 'block';
    progressSection.style.display = 'block';
    showStatus('Starting download...', '');

    try {
      await chrome.runtime.sendMessage({
        type: 'batch_download',
        data: { username, downloadType: selectedType }
      });
    } catch (e) {
      showStatus(e.message, 'error');
      resetUI();
    }
  });

  // --- Stop ---
  btnStop.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'stop_batch' });
    showStatus('Stopped', '');
    resetUI();
  });

  // --- Progress listener ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'progress') {
      updateProgress(msg.data);
    }
  });

  // Poll progress on open
  async function pollProgress() {
    try {
      const progress = await chrome.runtime.sendMessage({ type: 'get_progress' });
      if (progress && progress.running) {
        btnStart.style.display = 'none';
        btnStop.style.display = 'block';
        progressSection.style.display = 'block';
        updateProgress(progress);
      }
    } catch (e) {}
  }
  pollProgress();

  function updateProgress(data) {
    const { total, done, running } = data;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${done} / ${total}`;

    if (!running && total > 0) {
      showStatus(`Done! Downloaded ${done} files.`, 'success');
      resetUI();
    }
  }

  function resetUI() {
    btnStart.style.display = 'block';
    btnStop.style.display = 'none';
  }

  function showStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = `status ${type}`;
  }

  // --- Settings ---
  const folderInput = document.getElementById('folder');
  const subfolderInput = document.getElementById('subfolder');
  const concurrentInput = document.getElementById('concurrent');
  const btnSave = document.getElementById('btn-save');

  chrome.storage.local.get(['folder', 'subfolder', 'concurrent'], (data) => {
    folderInput.value = data.folder || 'Instagram';
    subfolderInput.checked = data.subfolder !== false;
    concurrentInput.value = data.concurrent || 3;
  });

  btnSave.addEventListener('click', () => {
    chrome.storage.local.set({
      folder: folderInput.value.trim() || 'Instagram',
      subfolder: subfolderInput.checked,
      concurrent: parseInt(concurrentInput.value) || 3
    }, () => {
      showStatus('Settings saved!', 'success');
      setTimeout(() => showStatus('', ''), 2000);
    });
  });
});
