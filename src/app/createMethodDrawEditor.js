/**
 * createMethodDrawEditor – drops the full Method-Draw UI into a given DOM node
 * without iframes.  All CSS & JS assets listed in Method-Draw's original
 * index.html are injected automatically (once per page).
 *
 * Usage:
 *   const editor = await createMethodDrawEditor(containerEl);
 *   editor.importSvg(svgString);
 *   const out = editor.exportSvg();
 */
export async function createMethodDrawEditor (container, opts = {}) {
  if (!container || !(container instanceof HTMLElement)) {
    throw new Error('createMethodDrawEditor: container must be a DOM element');
  }

  /* -------------------------------------------------------------------
   * 1. Fetch & inject the original markup
   * ----------------------------------------------------------------- */
  const htmlText = await fetch(assetUrl('index.html')).then(r => r.text());

  // Parse the fetched HTML to safely pull the body markup
  const htmlDoc   = parseHTML(htmlText);
  const bodyHtml  = htmlDoc.body.innerHTML;

  // Strip out any <script> tags from the body so we can control JS loading ourselves
  const cleanedBody = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  container.innerHTML = cleanedBody.trim();

  /* -------------------------------------------------------------------
   * 2. Ensure CSS is added to <head> (only once per href)
   * ----------------------------------------------------------------- */
  const cssHrefs = Array.from(parseHTML(htmlText).querySelectorAll('link[rel="stylesheet"]'))
    .map(l => l.getAttribute('href'));

  cssHrefs.forEach(href => {
    const abs = assetUrl(href);
    if (!document.head.querySelector(`link[data-md="${href}"]`)) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = abs;
      link.dataset.md = href;
      document.head.appendChild(link);
    }
  });

  /* -------------------------------------------------------------------
   * 3. Load JS dependencies in the same order as the original page
   * ----------------------------------------------------------------- */
  if (!window.__mdScriptsLoaded) {
    const scriptSrcs = Array.from(parseHTML(htmlText).querySelectorAll('script[src]'))
      .map(s => s.getAttribute('src'));

    // The upstream HTML inexplicably omits method-draw.js; inject it after pathseg
    const idx = scriptSrcs.indexOf('js/lib/pathseg.js');
    if (idx !== -1 && !scriptSrcs.includes('js/method-draw.js')) {
      scriptSrcs.splice(idx + 1, 0, 'js/method-draw.js');
    }

    for (const rel of scriptSrcs) {
      await loadScript(assetUrl(rel));
    }

    window.__mdScriptsLoaded = true;
  }

  /* -------------------------------------------------------------------
   * 4. Access the singleton Editor instance that the bundle exposes
   * ----------------------------------------------------------------- */
  const editor = window.methodDraw; // provided by method-draw.js
  if (!editor) {
    throw new Error('Method-Draw failed to load (window.methodDraw missing)');
  }

  // Apply caller-supplied config before the editor becomes ready
  if (Object.keys(opts).length) {
    editor.setConfig(opts);
  }

  // Wait for the library to finish initialising
  await new Promise(res => editor.ready(res));

  /* -------------------------------------------------------------------
   * 5. Public façade – wrapped for cleanliness
   * ----------------------------------------------------------------- */
  return {
    exportSvg: () => editor.canvas.getSvgString(),
    importSvg: svg => editor.canvas.setSvgString(svg),
    undo:      () => editor.canvas.undoMgr.undo(),
    redo:      () => editor.canvas.undoMgr.redo(),
    zoom:      z   => editor.canvas.setZoom(z),
    clear:     () => editor.canvas.clear(),
    destroy:   () => { container.innerHTML = ''; }
  };

  /* -------------------------------------------------------------------
   * helpers
   * ----------------------------------------------------------------- */
  function assetUrl (relativePath) {
    // Use the app's <base href> (or window.location) so URLs are resolved relative
    // to the deployed root, not to the current JS bundle location. This prevents
    // dev-server history-fallback from serving Angular's index.html when the asset
    // is missing or the path calculation is off.
    const base = (document.querySelector('base')?.getAttribute('href') || '/').replace(/\/$/, '');
    return `${base}/lib/Method-Draw/src/${relativePath}`;
  }

  function loadScript (src) {
    return new Promise((resolve, reject) => {
      // Avoid double-injection
      if (document.head.querySelector(`script[data-md="${src}"]`)) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // keep execution order
      s.dataset.md = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  function parseHTML (str) {
    const doc = document.implementation.createHTMLDocument('');
    doc.documentElement.innerHTML = str;
    return doc;
  }
}