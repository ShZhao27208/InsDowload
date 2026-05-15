(() => {
  const dispatch = () => {
    const data = {
      dtsg: '',
      appId: '936619743392459',
      userId: ''
    };

    // Extract fb_dtsg from page
    try {
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const script of scripts) {
        const text = script.textContent;
        if (text.includes('DTSGInitialData') || text.includes('dtsg')) {
          const match = text.match(/"token":"([^"]+)"/);
          if (match) { data.dtsg = match[1]; break; }
        }
      }
    } catch (e) {}

    if (!data.dtsg && window.fb_dtsg) {
      data.dtsg = window.fb_dtsg;
    }

    // Extract app ID
    try {
      const metaAppId = document.querySelector('meta[property="al:ios:app_store_id"]');
      if (metaAppId) data.appId = metaAppId.content;
    } catch (e) {}

    // Extract user ID from cookie
    try {
      const match = document.cookie.match(/ds_user_id=(\d+)/);
      if (match) data.userId = match[1];
    } catch (e) {}

    window.postMessage({ type: '__insdownload_params', payload: data }, '*');
  };

  // Intercept fetch to capture docIds from Relay requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options] = args;
    if (typeof url === 'string' && url.includes('/graphql/query') && options?.body) {
      try {
        const body = typeof options.body === 'string' ? options.body : '';
        const params = new URLSearchParams(body);
        const friendlyName = params.get('fb_api_req_friendly_name') || '';
        const docId = params.get('doc_id') || '';

        const mapping = {
          'PolarisProfilePostsTabContentQuery_connection_instagramRelayOperation': 'posts',
          'PolarisProfileReelsTabContentQuery_instagramRelayOperation': 'reels',
          'PolarisProfileTaggedTabContentQuery_instagramRelayOperation': 'tagged'
        };

        if (mapping[friendlyName] && docId) {
          window.postMessage({
            type: '__insdownload_docid',
            payload: { name: mapping[friendlyName], docId }
          }, '*');
        }
      } catch (e) {}
    }
    return originalFetch.apply(this, args);
  };

  // Listen for requests from content script
  window.addEventListener('message', (e) => {
    if (e.data?.type === '__insdownload_request_params') {
      dispatch();
    }
  });

  // Auto-dispatch after page loads
  setTimeout(dispatch, 1500);
  setTimeout(dispatch, 5000);
})();
