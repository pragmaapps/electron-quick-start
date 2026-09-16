/**
 * The preload script runs before the page loads.
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

/**
 * With contextIsolation, preload cannot patch the page's console directly.
 * Inject a small formatter into the page (main) world so objects are printed
 * instead of "[object Object]" for Electron's console-message → file logger.
 */
function installConsoleObjectFormatter () {
  const source = `(() => {
    if (window.__kioskConsoleFormatInstalled) return;
    window.__kioskConsoleFormatInstalled = true;

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
        return json === undefined ? String(arg) : json;
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

    originals.table = console.table.bind(console);
    console.table = (tabularData, properties) => {
      originals.log('[console.table]', formatArg(tabularData), properties != null ? formatArg(properties) : '');
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

contextBridge.exposeInMainWorld('electron', {
  openNewWindow: (url, features) => ipcRenderer.send('create-new-window', { url, features })
});
