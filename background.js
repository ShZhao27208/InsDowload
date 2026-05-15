const CONFIG = {
  IG_APP_ID: '936619743392459',
  DEFAULT_FOLDER: 'Instagram'
};

const LOG = (...args) => console.log('[InsDowload BG]', ...args);

let state = {
  csrftoken: '',
  dtsg: '',
  appId: CONFIG.IG_APP_ID,
  userId: '',
  docIds: {}
};

// --- Cookie ---
async function getCsrfToken() {
  const cookie = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'csrftoken' });
  if (cookie) state.csrftoken = cookie.value;
  return state.csrftoken;
}

async function getUserId() {
  const cookie = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'ds_user_id' });
  if (cookie) state.userId = cookie.value;
  return state.userId;
}

// --- Fetch with session ---
function getHeaders() {
  return {
    'X-CSRFToken': state.csrftoken,
    'X-IG-App-ID': CONFIG.IG_APP_ID,
    'X-Requested-With': 'XMLHttpRequest',
    'X-Instagram-AJAX': '1'
  };
}

async function igFetch(url, options = {}) {
  await getCsrfToken();
  LOG('Fetch:', url);
  const resp = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) }
  });
  LOG('Response:', resp.status);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

// --- Download a single file (no queue, just download) ---
function downloadFile(url, filename) {
  return new Promise((resolve) => {
    LOG('Downloading:', filename);
    chrome.downloads.download(
      { url, filename, saveAs: false, conflictAction: 'uniquify' },
      (id) => {
        if (chrome.runtime.lastError) {
          LOG('Download error:', chrome.runtime.lastError.message);
        }
        resolve(id);
      }
    );
  });
}

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').substring(0, 200);
}

function buildPath(username, url, index, timestamp, caption) {
  const ext = url.includes('.mp4') || url.includes('video') ? 'mp4' : 'jpg';
  const date = timestamp ? new Date(timestamp * 1000).toISOString().slice(0, 10) : '';

  // Extract original filename from URL (e.g. "123456789_123_n" from CDN URL)
  let originalName = '';
  try {
    const urlPath = new URL(url).pathname;
    const segments = urlPath.split('/');
    const last = segments[segments.length - 1];
    originalName = last.replace(/\.[^.]+$/, '');
  } catch (e) {}

  // Build filename: caption_originalName_date_author.ext
  // If no caption: originalName_date_author.ext
  let parts = [];
  if (caption) {
    const shortCaption = caption.substring(0, 50).trim();
    parts.push(shortCaption);
  }
  if (originalName) parts.push(originalName);
  if (date) parts.push(date);
  parts.push(username);

  const filename = sanitize(parts.join('_')) + '.' + ext;
  return `${CONFIG.DEFAULT_FOLDER}/${username}/${filename}`;
}

// --- Get media info via API ---
async function getMediaInfo(mediaId) {
  return igFetch(`https://www.instagram.com/api/v1/media/${mediaId}/info/`);
}

// --- Fallback: GraphQL query by shortcode ---
async function getMediaByShortcode(shortcode) {
  LOG('Fallback: GraphQL query for shortcode', shortcode);
  const variables = JSON.stringify({
    shortcode,
    child_comment_count: 0,
    fetch_comment_count: 0,
    parent_comment_count: 0,
    has_threaded_comments: false
  });
  const url = `https://www.instagram.com/graphql/query/?query_hash=b3055c01b4b222b8a47dc12b090e4e64&variables=${encodeURIComponent(variables)}`;
  return igFetch(url);
}

// --- Fallback: extract video URL from the active tab's page ---
async function getVideoFromPage(shortcode) {
  LOG('Video fallback: extracting from page DOM');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (sc) => {
      // Strategy 1: find video element src (might be blob, but try)
      const videos = document.querySelectorAll('video');
      for (const v of videos) {
        const src = v.src || v.querySelector('source')?.src;
        if (src && src.startsWith('http')) return [src];
      }

      // Strategy 2: look in Instagram's internal data stores
      // Check script tags with JSON data
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const s of scripts) {
        try {
          const text = s.textContent;
          if (text.includes(sc) && text.includes('video_url')) {
            const match = text.match(/"video_url":"([^"]+)"/g);
            if (match) {
              return match.map(m => m.replace(/"video_url":"/, '').replace(/"$/, '').replace(/\\u0026/g, '&'));
            }
          }
        } catch (e) {}
      }

      // Strategy 3: search all script tags for video_versions
      for (const s of document.querySelectorAll('script')) {
        try {
          const text = s.textContent;
          if (text.includes('video_versions') && text.includes(sc)) {
            const urlMatch = text.match(/"url":"(https:[^"]*?\.mp4[^"]*)"/);
            if (urlMatch) {
              return [urlMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/')];
            }
          }
        } catch (e) {}
      }

      // Strategy 4: check window.__additionalData or similar
      try {
        const addData = window.__additionalDataLoaded;
        if (addData) {
          const json = JSON.stringify(addData);
          if (json.includes('video_url')) {
            const m = json.match(/"video_url":"([^"]+)"/);
            if (m) return [m[1].replace(/\\u0026/g, '&')];
          }
        }
      } catch (e) {}

      return [];
    },
    args: [shortcode]
  });

  const urls = results?.[0]?.result || [];
  LOG('Video fallback found:', urls.length, 'URLs');
  return urls;
}

// --- Extract download URLs from API response ---
function extractUrls(item) {
  const urls = [];
  if (item.carousel_media) {
    for (const m of item.carousel_media) {
      if (m.video_versions && m.video_versions.length > 0) {
        urls.push(m.video_versions[0].url);
      } else if (m.image_versions2 && m.image_versions2.candidates.length > 0) {
        urls.push(m.image_versions2.candidates[0].url);
      }
    }
  } else if (item.video_versions && item.video_versions.length > 0) {
    urls.push(item.video_versions[0].url);
  } else if (item.image_versions2 && item.image_versions2.candidates.length > 0) {
    urls.push(item.image_versions2.candidates[0].url);
  }
  return urls;
}

// --- Download a single post (all media, no queue) ---
async function downloadPost(mediaId, shortcode, username) {
  let urls = [];
  let timestamp = 0;
  let caption = '';

  // Try API first
  try {
    const info = await getMediaInfo(mediaId);
    if (info.items && info.items.length > 0) {
      const item = info.items[0];
      urls = extractUrls(item);
      timestamp = item.taken_at || 0;
      caption = item.caption?.text || '';
      LOG('API returned', urls.length, 'media URLs');
    }
  } catch (e) {
    LOG('API failed:', e.message);
  }

  // Fallback: GraphQL by shortcode
  if (urls.length === 0 && shortcode) {
    try {
      const data = await getMediaByShortcode(shortcode);
      const media = data?.data?.shortcode_media;
      if (media) {
        urls = extractGraphQLUrls(media);
        timestamp = media.taken_at_timestamp || 0;
        caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
        LOG('GraphQL fallback returned', urls.length, 'media URLs');
      }
    } catch (e) {
      LOG('GraphQL fallback failed:', e.message);
    }
  }

  if (urls.length === 0) {
    // Last resort: extract video from page DOM
    try {
      const pageUrls = await getVideoFromPage(shortcode);
      if (pageUrls.length > 0) {
        urls = pageUrls;
        LOG('Page DOM extraction returned', urls.length, 'video URLs');
      }
    } catch (e) {
      LOG('Page DOM extraction failed:', e.message);
    }
  }

  if (urls.length === 0) {
    LOG('No media URLs found');
    return { ok: false, error: 'No media found', count: 0 };
  }

  // Download ALL files immediately (no queue)
  LOG('Starting download of', urls.length, 'files, caption:', caption?.substring(0, 30));
  for (let i = 0; i < urls.length; i++) {
    const path = buildPath(username, urls[i], i + 1, timestamp, caption);
    await downloadFile(urls[i], path);
    if (i < urls.length - 1) await sleep(300);
  }

  return { ok: true, count: urls.length };
}

// --- Batch download profile ---
async function batchDownloadProfile(username, type) {
  await getCsrfToken();
  await getUserId();

  let userInfo;
  try {
    userInfo = await igFetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`
    );
  } catch (e) {
    LOG('Failed to get user info:', e.message);
    return;
  }

  const user = userInfo.data?.user;
  if (!user) { LOG('User not found'); return; }

  const userId = user.id;
  let cursor = '';
  let hasNext = true;
  let index = 0;

  broadcastProgress({ total: 0, done: 0, running: true });

  while (hasNext) {
    let edges = [];
    let pageInfo = {};

    try {
      const data = await fetchProfilePosts(type, userId, username, cursor);
      const connection = findConnection(data);
      if (connection) {
        edges = connection.edges || [];
        pageInfo = connection.page_info || {};
      }
    } catch (e) {
      LOG('Fetch page failed:', e.message);
      break;
    }

    for (const edge of edges) {
      const node = edge.node;
      const urls = extractGraphQLUrls(node);
      const nodeCaption = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
      broadcastProgress({ total: index + urls.length, done: index, running: true });

      for (const url of urls) {
        index++;
        const path = buildPath(username, url, index, node.taken_at_timestamp, nodeCaption);
        await downloadFile(url, path);
        broadcastProgress({ total: index + (hasNext ? 1 : 0), done: index, running: true });
        await sleep(500);
      }
    }

    hasNext = pageInfo.has_next_page || false;
    cursor = pageInfo.end_cursor || '';
    if (hasNext) await sleep(1500);
  }

  broadcastProgress({ total: index, done: index, running: false });
}

async function fetchProfilePosts(type, userId, username, cursor) {
  const docId = state.docIds[type];

  // If we have docId, use Relay
  if (docId && state.dtsg) {
    const pageSize = type === 'posts' ? 12 : 3;
    const variables = { after: cursor || '', before: null, first: pageSize, last: null, username };
    if (type === 'posts') variables.data = { count: pageSize };

    const body = new URLSearchParams({
      fb_dtsg: state.dtsg,
      doc_id: docId,
      variables: JSON.stringify(variables)
    });

    const resp = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST',
      credentials: 'include',
      headers: { ...getHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (resp.ok) return resp.json();
    LOG('Relay failed, trying GraphQL fallback');
  }

  // Fallback: query_hash
  const variables = JSON.stringify({ id: userId, first: 12, after: cursor || '' });
  const url = `https://www.instagram.com/graphql/query/?query_hash=bfa387b2992c3a52dcbe447467b4b771&variables=${encodeURIComponent(variables)}`;
  return igFetch(url);
}

function extractGraphQLUrls(node) {
  const urls = [];
  if (node.edge_sidecar_to_children) {
    for (const edge of node.edge_sidecar_to_children.edges) {
      const n = edge.node;
      urls.push(n.is_video ? n.video_url : n.display_url);
    }
  } else if (node.is_video && node.video_url) {
    urls.push(node.video_url);
  } else if (node.display_url) {
    urls.push(node.display_url);
  }
  return urls;
}

function findConnection(data) {
  if (!data?.data) return null;
  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.edges && obj.page_info) return obj;
    for (const val of Object.values(obj)) {
      const found = walk(val);
      if (found) return found;
    }
    return null;
  };
  return walk(data.data);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function broadcastProgress(data) {
  chrome.runtime.sendMessage({ type: 'progress', data }).catch(() => {});
}

// --- Message handler ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch(e => sendResponse({ error: e.message }));
  return true;
});

async function handleMessage(msg) {
  LOG('Message:', msg.type);

  switch (msg.type) {
    case 'download_post': {
      const { mediaId, shortcode, username } = msg.data;
      return downloadPost(mediaId, shortcode, username);
    }

    case 'download_single': {
      const { url, filename, username } = msg.data;
      const path = `${CONFIG.DEFAULT_FOLDER}/${username || 'unknown'}/${sanitize(filename)}`;
      await downloadFile(url, path);
      return { ok: true };
    }

    case 'batch_download': {
      const { username, downloadType } = msg.data;
      batchDownloadProfile(username, downloadType);
      return { ok: true, started: true };
    }

    case 'stop_batch': {
      return { ok: true };
    }

    case 'get_progress': {
      return { total: 0, done: 0, running: false };
    }

    case 'update_params': {
      if (msg.data.dtsg) state.dtsg = msg.data.dtsg;
      if (msg.data.appId) state.appId = msg.data.appId;
      if (msg.data.userId) state.userId = msg.data.userId;
      LOG('Params updated:', { hasDtsg: !!state.dtsg, appId: state.appId });
      return { ok: true };
    }

    case 'update_doc_id': {
      state.docIds[msg.data.name] = msg.data.docId;
      LOG('DocId updated:', msg.data.name, msg.data.docId);
      return { ok: true };
    }

    case 'get_state': {
      return { hasToken: !!state.csrftoken, hasDtsg: !!state.dtsg, docIds: Object.keys(state.docIds) };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// --- Init ---
chrome.runtime.onInstalled.addListener(async () => {
  await getCsrfToken();
  await getUserId();
  LOG('Initialized. Token:', !!state.csrftoken, 'UserId:', state.userId);
});
