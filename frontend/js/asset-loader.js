(() => {
  const version = document.querySelector('meta[name="asset-version"]')?.content.trim();
  if (!version) {
    console.error('Missing asset-version meta tag.');
    return;
  }

  const stylesheets = [
    'frontend/css/styles.css',
    'frontend/css/auth.css',
    'frontend/css/sharing.css',
    'frontend/css/compare.css',
    'frontend/css/pro.css',
    'frontend/css/cloud.css',
  ];

  const scripts = [
    'frontend/js/vendor/jszip.min.js',
    'frontend/js/history-import.js',
    'frontend/js/analysis-engine.js',
    'frontend/js/wealth-engine.js',
    'frontend/js/pro-ui.js',
    'frontend/js/config.js',
    'frontend/js/gas-api.js',
    'frontend/js/auth.js',
    'frontend/js/sharing.js',
    'frontend/js/compare-engine.js',
    'frontend/js/app.js',
  ];

  const versionedUrl = path => {
    const url = new URL(path, document.baseURI);
    url.searchParams.set('v', version);
    return url.href;
  };

  for (const href of stylesheets) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = versionedUrl(href);
    document.head.append(link);
  }

  const loadScripts = () => {
    let sequence = Promise.resolve();
    for (const src of scripts) {
      sequence = sequence.then(() => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = versionedUrl(src);
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.append(script);
      }));
    }
    sequence.catch(error => console.error('WealthDesk assets failed to load.', error));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadScripts, { once: true });
  } else {
    loadScripts();
  }
})();
