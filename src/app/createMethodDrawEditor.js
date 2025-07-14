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
   * Fast-path ▸ if Method-Draw scripts are already loaded, just re-parent
   * the existing #method-draw root instead of loading everything again.
   * This avoids re-executing the same <script> files which would throw
   * "Identifier has already been declared" errors for const bindings.
   * ----------------------------------------------------------------*/
  if (window.__mdSharedRoot && window.svgCanvas && window.editor) {
    // Re-attach the root element into the new container
    container.appendChild(window.__mdSharedRoot);

    // Ensure it fills the new wrapper
    const sizeFix = document.createElement('style');
    sizeFix.textContent = `.${WRAP} #method-draw, .${WRAP} #method-draw .app {width:100%;height:100%;}`;
    container.prepend(sizeFix);

    // Blank the canvas so caller starts from a fresh document
    window.svgCanvas.clear();

    // Recompute layout now that the DOM node has a new parent
    if (window.editor && window.editor.canvas && window.editor.canvas.update) {
      window.editor.canvas.update(true);
      requestAnimationFrame(()=>{
        window.editor.canvas.update(true);
      });
    }
    if (window.editor && window.editor.zoom && window.editor.zoom.reset) {
      window.editor.zoom.reset();
    }

    // Force panel context refresh and default mode
    if (window.state && typeof window.state.set === 'function') {
      window.state.set('canvasMode', 'select');
    }
    if (window.editor && window.editor.panel && window.editor.panel.updateContextPanel) {
      window.editor.panel.updateContextPanel();
    }

    if (window.editor && window.editor.toolbar && window.editor.toolbar.setMode) {
      window.editor.toolbar.setMode('select');
    }

    if (window.state && typeof window.state.refresh === 'function') {
      window.state.refresh();
    }

    // Ensure context panel follows future selections
    if (!window.__mdRebindDone) {
      window.svgCanvas.bind('selected', function(_, elems){
        console.log('[MD wrapper] selected event with elems', elems);
        if (window.editor && window.editor.panel) {
          window.editor.panel.updateContextPanel(elems);
        }
      });
      window.svgCanvas.bind('changed', function(){
        if (window.editor && window.editor.panel) {
          window.editor.panel.updateContextPanel();
        }
      });
      window.__mdRebindDone = true;
    }

    return buildFacade(container, opts, sizeFix);
  }

  /* ------------------------------------------------------------------
   * 1 ▸ inject pristine HTML (strip inline <script>)
   * ----------------------------------------------------------------*/
  const rawHtml = await fetch(asset('index.html')).then(r => r.text());
  const htmlDoc = parseHTML(rawHtml);
  container.innerHTML = htmlDoc.body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  // Keep a reference to the root element so we can move it around later
  window.__mdSharedRoot = container.querySelector('#method-draw');

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
   * 3 ▸ load JS dependencies (skip loading.js) ONCE ONLY
   * ----------------------------------------------------------------*/
  if (!window.__mdScriptsLoaded) {
    const scripts = Array.from(htmlDoc.querySelectorAll('script[src]'))
      .map(s => s.getAttribute('src'))
      .filter(src => src && src !== 'js/loading.js');
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
  return buildFacade(container, opts, sizeFix);
}

function buildFacade(containerEl, options, styleEl){
  return {
    exportSvg: ()      => svgCanvas.getSvgString(),
    importSvg: s       => svgCanvas.setSvgString(s),
    importSvgFromUrl: async u => svgCanvas.setSvgString(await (await fetch(u)).text()),
    undo: ()           => svgCanvas.undoMgr.undo(),
    redo: ()           => svgCanvas.undoMgr.redo(),
    zoom: z            => svgCanvas.setZoom(z),
    clear: ()          => svgCanvas.clear(),
    destroy: ()        => {
      try { if (window.svgCanvas && typeof window.svgCanvas.clear === 'function') { window.svgCanvas.clear(); } } catch {}
      if (window.__mdSharedRoot && window.__mdSharedRoot.parentNode) {
        window.__mdSharedRoot.parentNode.removeChild(window.__mdSharedRoot);
      }
      if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
      containerEl.innerHTML = '';
    },
    hideTool: m        => toggleTool(m, true),
    showTool: m        => toggleTool(m, false),
    addMenuItem: el    => { const m = containerEl.querySelector('#cmenu_canvas'); if (m) m.appendChild(el); },
    svgCanvas,
    editor
  };
}

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