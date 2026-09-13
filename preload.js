/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

/**
 * With contextIsolation, preload cannot patch the page's console directly.
 * Inject a formatter into the page (main) world so objects are JSON-serialized
 * before Chromium turns them into "[object Object]" for console-message.
 */
function installConsoleObjectFormatter () {
  const source = `(() => {
    if (window.__kioskConsoleFormatInstalled) return;
    window.__kioskConsoleFormatInstalled = true;

    const summarizeTrack = (track) => ({
      kind: track.kind,
      id: track.id,
      label: track.label,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      contentHint: track.contentHint
    });

    const formatArg = (arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
        return String(arg);
      }
      if (typeof arg === 'symbol') return arg.toString();
      if (typeof arg === 'function') {
        return '[Function ' + (arg.name || 'anonymous') + ']';
      }
      if (arg instanceof Error) {
        return arg.stack || (arg.name + ': ' + arg.message);
      }

      // MediaStream / tracks stringify to "{}" with JSON.stringify alone.
      if (typeof MediaStream !== 'undefined' && arg instanceof MediaStream) {
        try {
          return JSON.stringify({
            __type: 'MediaStream',
            id: arg.id,
            active: arg.active,
            tracks: arg.getTracks().map(summarizeTrack)
          });
        } catch (err) {
          return '[MediaStream]';
        }
      }
      if (typeof MediaStreamTrack !== 'undefined' && arg instanceof MediaStreamTrack) {
        try {
          return JSON.stringify(Object.assign({ __type: 'MediaStreamTrack' }, summarizeTrack(arg)));
        } catch (err) {
          return '[MediaStreamTrack]';
        }
      }
      if (typeof HTMLMediaElement !== 'undefined' && arg instanceof HTMLMediaElement) {
        try {
          return JSON.stringify({
            __type: arg.constructor && arg.constructor.name || 'HTMLMediaElement',
            tagName: arg.tagName,
            id: arg.id,
            src: arg.currentSrc || arg.src,
            paused: arg.paused,
            muted: arg.muted,
            readyState: arg.readyState,
            networkState: arg.networkState,
            videoWidth: arg.videoWidth,
            videoHeight: arg.videoHeight
          });
        } catch (err) {
          return '[HTMLMediaElement]';
        }
      }

      try {
        const seen = new WeakSet();
        const json = JSON.stringify(arg, (key, value) => {
          if (typeof value === 'bigint') return String(value);
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
          }
          return value;
        });
        // Non-enumerable host objects often become "{}" — add a type hint.
        if (json === '{}' && arg && arg.constructor && arg.constructor.name) {
          return JSON.stringify({ __type: arg.constructor.name });
        }
        return json;
      } catch (err) {
        try { return String(arg); } catch (_) { return '[Unserializable]'; }
      }
    };

    const originals = {};
    for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
      originals[method] = console[method].bind(console);
      console[method] = (...args) => {
        originals[method](...args.map(formatArg));
      };
    }

    // console.table is not covered by the loop above; emit readable JSON for the file logger.
    originals.table = console.table.bind(console);
    console.table = (tabularData, properties) => {
      try {
        let payload = tabularData;
        if (Array.isArray(properties) && properties.length > 0) {
          if (Array.isArray(tabularData)) {
            payload = tabularData.map((row) => {
              if (!row || typeof row !== 'object') return row;
              const picked = {};
              for (const key of properties) picked[key] = row[key];
              return picked;
            });
          } else if (tabularData && typeof tabularData === 'object') {
            const picked = {};
            for (const key of properties) picked[key] = tabularData[key];
            payload = picked;
          }
        }
        originals.log('[console.table]', formatArg(payload));
      } catch (err) {
        originals.log('[console.table]', formatArg(tabularData));
      }
    };
  })();`;

  return webFrame.executeJavaScript(source, true).catch((err) => {
    console.error('[kiosk-console-format] inject failed:', err);
  });
}

installConsoleObjectFormatter();

window.addEventListener('DOMContentLoaded', () => {
  installConsoleObjectFormatter();

  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  openNewWindow: (url, features) => ipcRenderer.send('create-new-window', { url, features })
});
