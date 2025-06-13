/* eslint-disable */
/**
 * createMethodDrawEditor  – drop-in wrapper for the Method-Draw SVG editor.
 * It embeds the full UI inside any DOM element WITHOUT an iframe, scopes all
 * CSS so it cannot leak into the host app, and keeps the editor constrained
 * to the size of its parent element.
 *
 *     const ed = await createMethodDrawEditor(div, {
 *       toolset: ['select', 'rect', 'ellipse'],
 *       onExport(e){ console.log(e.svg); }
 *     });
 */
export async function createMethodDrawEditor (container, opts = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new Error('createMethodDrawEditor: container must be a DOM element');
  }

  /* give the container a unique namespace class so we can prefix CSS */
  const WRAP = 'md-wrapper';
  container.classList.add(WRAP);

  /* ------------------------------------------------------------------
   * 1 ▸ inject pristine HTML (strip inline <script>)
   * ----------------------------------------------------------------*/
  const rawHtml = await fetch(asset('index.html')).then(r => r.text());
  const htmlDoc = parseHTML(rawHtml);
  container.innerHTML = htmlDoc.body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  /* force the canvas/app to use 100% of wrapper */
  const sizeFix = document.createElement('style');
  sizeFix.textContent = `.${WRAP} #method-draw, .${WRAP} #method-draw .app {width:100%;height:100%;}`;
  container.prepend(sizeFix);

  /* ------------------------------------------------------------------
   * 2 ▸ inject pre-built, prefixed stylesheet once
   * ----------------------------------------------------------------*/
  if (!window.__mdCssScoped) {
    loadStyle(asset('../md-prefixed.css'));
    window.__mdCssScoped = true;
  }

  /* ------------------------------------------------------------------
   * 3 ▸ load JS dependencies (skip loading.js, inject method-draw.js)
   * ----------------------------------------------------------------*/
  if (!window.__mdScriptsLoaded) {
    const scripts = Array.from(htmlDoc.querySelectorAll('script[src]'))
      .map(s => s.getAttribute('src'))
      .filter(src => src && src !== 'js/loading.js');
    if (!scripts.includes('js/method-draw.js')) {
      const idx = scripts.indexOf('js/svgcanvas.js');
      scripts.splice(idx + 1, 0, 'js/method-draw.js');
    }
    for (const rel of scripts) await loadScript(asset(rel));
    window.__mdScriptsLoaded = true;
  }

  /* ------------------------------------------------------------------
   * 4 ▸ wait until editor globals materialise, then blank the canvas
   * ----------------------------------------------------------------*/
  await waitFor(() => {
    try {
      if (!window.svgCanvas && Function('return typeof svgCanvas!=="undefined"')()) {
        window.svgCanvas = Function('return svgCanvas')();
      }
      if (!window.editor && Function('return typeof editor!=="undefined"')()) {
        window.editor = Function('return editor')();
      }
    } catch {}
    return window.svgCanvas && window.editor;
  });
  const svgCanvas = window.svgCanvas;
  const editor    = window.editor;
  svgCanvas.clear();

  /* ------------------------------------------------------------------
   * 5 ▸ optional tool filtering, context-menu & event hooks
   * ----------------------------------------------------------------*/
  if (Array.isArray(opts.toolset)) {
    container.querySelectorAll('#tools_left .tool_button').forEach(btn => {
      if (!opts.toolset.includes(btn.dataset.mode)) btn.style.display = 'none';
    });
  }
  if (typeof opts.extendContextMenu === 'function') {
    const menu = container.querySelector('#cmenu_canvas');
    if (menu) opts.extendContextMenu(menu);
  }
  if (opts.onChange) svgCanvas.bind('changed',  opts.onChange);
  if (opts.onExport) svgCanvas.bind('exported', opts.onExport);

  /* ------------------------------------------------------------------
   * 6 ▸ public façade
   * ----------------------------------------------------------------*/
  return {
    exportSvg: ()      => svgCanvas.getSvgString(),
    importSvg: s       => svgCanvas.setSvgString(s),
    importSvgFromUrl: async u => svgCanvas.setSvgString(await (await fetch(u)).text()),
    undo: ()           => svgCanvas.undoMgr.undo(),
    redo: ()           => svgCanvas.undoMgr.redo(),
    zoom: z            => svgCanvas.setZoom(z),
    clear: ()          => svgCanvas.clear(),
    destroy: ()        => { container.innerHTML = ''; },
    hideTool: m        => toggleTool(m, true),
    showTool: m        => toggleTool(m, false),
    addMenuItem: el    => { const m = container.querySelector('#cmenu_canvas'); if (m) m.appendChild(el); },
    svgCanvas,
    editor
  };

  /* ---------------- helpers ---------------- */
  function toggleTool(mode, hide){ const b = container.querySelector(`#tools_left .tool_button[data-mode="${mode}"]`); if (b) b.style.display = hide? 'none':''; }

  function asset(rel){ const base = (document.querySelector('base')?.getAttribute('href')||'/').replace(/\/$/,''); return `${base}/lib/Method-Draw/src/${rel}`; }

  // helper to append a <link> once
  function loadStyle(href){
    if (document.head.querySelector(`link[data-md-style="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.mdStyle = href;
    document.head.appendChild(link);
  }

  function loadScript(src){ return new Promise((res,rej)=>{ if(document.head.querySelector(`script[data-md="${src}"]`)) return res(); const s=document.createElement('script'); s.src=src; s.async=false; s.dataset.md=src; s.onload=res; s.onerror=()=>rej(new Error('fail '+src)); document.head.appendChild(s); }); }

  function parseHTML(str){ const d=document.implementation.createHTMLDocument(''); d.documentElement.innerHTML=str; return d; }

  function waitFor(cond){ return new Promise((res,rej)=>{ let t=0; const id=setInterval(()=>{ if(cond()) {clearInterval(id); return res();} if((t+=50)>4000){clearInterval(id); rej(new Error('MD timeout'));}},50);}); }
}