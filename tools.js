// tools.js
// Two Moons Toolbelt
// - Edit menu controller
// - FULL Layout editor (drag + pinch resize + info panel + save/close)
// - Tailor (token + patcher + function viewer + editable replacement UI)
//
// NOTE: Tailor Function Finder reads from GitHub (same source as Dry Run/Commit),
// eliminating the "local preview vs GitHub" mismatch.

(() => {
  // ------------------------------------------------------------
  // Public entrypoint (app.js can call this with ctx)
  // ------------------------------------------------------------
  window.initTwoMoonsTools = function initTwoMoonsTools(ctx = {}) {
    try { initEditMenu(ctx); } catch (e) { console.warn('initEditMenu failed', e); }
    try { initLayoutEditor(ctx); } catch (e) { console.warn('initLayoutEditor failed', e); }
    try { initTailor(ctx); } catch (e) { console.warn('initTailor failed', e); }
  };

  // Optional auto-init (safe): only runs if page has the Edit button.
  document.addEventListener('DOMContentLoaded', () => {
    const hasEdit = document.getElementById('editModeBtn');
    if (!hasEdit) return;

    if (!window.__TWO_MOONS_TOOLS_INIT__) {
      window.__TWO_MOONS_TOOLS_INIT__ = true;
      window.initTwoMoonsTools(window.__TWO_MOONS_CTX__ || {});
    }
  });

  // ------------------------------------------------------------
  // Edit Menu
  // ------------------------------------------------------------
  function initEditMenu(ctx) {
    const menu = document.getElementById('editMenu');
    const layoutOption = document.getElementById('editLayoutOption');
    const codeOption = document.getElementById('editCodeOption');
    const uploadOption = document.getElementById('uploadAssetsOption');
    const tailorOverlay = document.getElementById('tailorOverlay');

    layoutOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__TWO_MOONS_LAYOUT_EDITOR__?.toggle?.();
    });

    codeOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tailorOverlay) tailorOverlay.style.display = 'flex';
    });

    uploadOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      const uploadUI = document.getElementById('uploadUI');
      uploadUI?.classList.remove('upload-hidden');
      uploadUI?.classList.add('active');
    });
  }

  // ------------------------------------------------------------
  // Layout Editor (FULL)
  // ------------------------------------------------------------
  function initLayoutEditor(ctx) {
    const grid = document.getElementById('grid-overlay');
    const layoutInfo = document.getElementById('layoutInfo');
    const container = document.getElementById('landing-container');

    if (!container) return;

    const getCurrentLayout = () =>
      (typeof ctx.getCurrentLayout === 'function')
        ? ctx.getCurrentLayout()
        : (window.getCurrentLayout ? window.getCurrentLayout() : null);

    const applyLayout = () => {
  // LAYOUT_EDITOR_START
  // LAYOUT_EDITOR:applicator_START

      if (typeof ctx.applyLayout === 'function') return ctx.applyLayout();
      if (typeof window.applyLayout === 'function') return window.applyLayout();

  // LAYOUT_EDITOR:applicator_END
  // LAYOUT_EDITOR_END
    };

    const syncLights = (cottageId) => {
      if (typeof ctx.syncLights === 'function') return ctx.syncLights(cottageId);
      if (typeof window.syncLights === 'function') return window.syncLights(cottageId);
    };

    const saveLayoutToFirebase = async () => {
      if (typeof ctx.saveLayoutToFirebase === 'function') return ctx.saveLayoutToFirebase();
      if (typeof window.saveLayoutToFirebase === 'function') return window.saveLayoutToFirebase();
      throw new Error('No saveLayoutToFirebase hook found.');
    };

    const isZoomed = () => {
      if (typeof ctx.isCottageZoomed === 'function') return !!ctx.isCottageZoomed();
      if (typeof window.isCottageZoomed !== 'undefined') return !!window.isCottageZoomed;
      return false;
    };

    let isEditMode = false;

    // drag / pinch state
    let dragElement = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    let resizeElement = null;
    let initialSize = 0;
    let initialDistance = 0;

    function enterEditMode() {
  // EDIT_MENU_START
  // EDIT_MENU:handler_START

      isEditMode = true;

      grid?.classList.remove('hidden');
      layoutInfo?.classList.remove('hidden');

      updateLayoutInfo();
      makeElementsEditable();

  // EDIT_MENU:handler_END
  // EDIT_MENU_END
    }

    function exitEditMode() {
  // EDIT_MENU_START
  // EDIT_MENU:handler_START

      isEditMode = false;

      grid?.classList.add('hidden');
      layoutInfo?.classList.add('hidden');

      removeEditListeners();

  // EDIT_MENU:handler_END
  // EDIT_MENU_END
    }

    function toggle() {
      isEditMode ? exitEditMode() : enterEditMode();
    }

    window.__TWO_MOONS_LAYOUT_EDITOR__ = { toggle };

    function makeElementsEditable() {
      const editables = document.querySelectorAll('.editable-element');
      
      const zoomedNow = isZoomed() || 
                        (typeof window.isCottageZoomed !== 'undefined' && window.isCottageZoomed) ||
                        document.getElementById('cottage-zoomed')?.classList.contains('active');

      editables.forEach((element) => {
        const view = element.dataset.editView;

        if (view === 'zoomed' && !zoomedNow) {
          element.classList.remove('edit-mode');
          return;
        }
        if (view === 'normal' && zoomedNow && element.classList.contains('cottage-element')) {
          element.classList.remove('edit-mode');
          return;
        }

        element.classList.add('edit-mode');

        element.removeEventListener('touchstart', onDragStart);
        element.removeEventListener('touchmove', onDragMove);
        element.removeEventListener('touchend', onDragEnd);

        element.addEventListener('touchstart', onDragStart, { passive: false });
        element.addEventListener('touchmove', onDragMove, { passive: false });
        element.addEventListener('touchend', onDragEnd, { passive: false });
      });
    }

    function removeEditListeners() {
      const editables = document.querySelectorAll('.editable-element');
      editables.forEach((element) => {
        element.classList.remove('edit-mode');
        element.removeEventListener('touchstart', onDragStart);
        element.removeEventListener('touchmove', onDragMove);
        element.removeEventListener('touchend', onDragEnd);
      });
    }

    function onDragStart(e) {
      if (!isEditMode) return;

      if (e.touches.length === 1) {
        e.preventDefault();
        dragElement = e.target.closest('.editable-element');
        if (!dragElement) return;

        const touch = e.touches[0];
        const rect = dragElement.getBoundingClientRect();

        dragOffsetX = touch.clientX - rect.left;
        dragOffsetY = touch.clientY - rect.top;
      }

      if (e.touches.length === 2) {
        e.preventDefault();
        resizeElement = e.target.closest('.editable-element');
        if (!resizeElement) return;

        const [t1, t2] = e.touches;
        initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const rect = resizeElement.getBoundingClientRect();
        initialSize = rect.width;
      }
    }

    function onDragMove(e) {
      if (!isEditMode) return;

      if (dragElement && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const containerRect = container.getBoundingClientRect();

        let newLeft = touch.clientX - containerRect.left - dragOffsetX;
        let newTop = touch.clientY - containerRect.top - dragOffsetY;

        const elementWidth = dragElement.offsetWidth;
        const elementHeight = dragElement.offsetHeight;

        newLeft = Math.max(0, Math.min(containerRect.width - elementWidth, newLeft));
        newTop = Math.max(0, Math.min(containerRect.height - elementHeight, newTop));

        dragElement.style.left = `${newLeft}px`;
        dragElement.style.top = `${newTop}px`;

        if (dragElement.id === 'cottage-small' || dragElement.id === 'cottage-zoomed') {
          syncLights(dragElement.id);
        }

        updateLayoutInfo();
        return;
      }

      if (resizeElement && e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const scale = currentDistance / initialDistance;
        let newSize = initialSize * scale;

        newSize = Math.max(50, Math.min(container.clientWidth * 0.95, newSize));

        resizeElement.style.width = `${newSize}px`;

        if (resizeElement.classList.contains('orb-element')) {
          resizeElement.style.height = `${newSize}px`;
        } else {
          resizeElement.style.height = 'auto';
        }

        if (resizeElement.id === 'cottage-small' || resizeElement.id === 'cottage-zoomed') {
          syncLights(resizeElement.id);
        }

        updateLayoutInfo();
      }
    }

    function onDragEnd() {
      if (dragElement) {
        saveElementPosition(dragElement);
        dragElement = null;
      }
      if (resizeElement) {
        saveElementPosition(resizeElement);
        resizeElement = null;
      }
    }

    function saveElementPosition(element) {
      const layout = getCurrentLayout();
      if (!layout) return;

      const containerRect = container.getBoundingClientRect();
      const rect = element.getBoundingClientRect();

      const left = ((rect.left - containerRect.left) / containerRect.width) * 100;
      const top = ((rect.top - containerRect.top) / containerRect.height) * 100;
      const width = (rect.width / containerRect.width) * 100;

      if (element.classList.contains('orb-element')) {
        layout[element.id] = { left, top, size: width };
      } else {
        layout[element.id] = { left, top, width };
      }
    }

    function updateLayoutInfo() {
      if (!layoutInfo) return;

      const layout = getCurrentLayout();
      if (!layout) {
        layoutInfo.querySelector('.layout-info-content').innerHTML =
          `<div style="padding:12px;">Layout editor active, but no layout object found.</div>`;
        return;
      }

      const zoomedNow = isZoomed();

      const orientationIcon = (window.innerWidth > window.innerHeight ? '[Landscape]' : '[Portrait]');
      const orientationName = (window.innerWidth > window.innerHeight ? 'Landscape' : 'Portrait');
      const viewIcon = zoomedNow ? '[Zoomed]' : '[Normal]';
      const viewName = zoomedNow ? 'Zoomed' : 'Normal';

      const currentViewElements = Array.from(document.querySelectorAll('.editable-element.edit-mode'));

      let html = `
        <div style="text-align:center; margin-bottom: 15px;">
          <strong style="font-size: 16px;">Visual Editor</strong><br>
          <div style="background: rgba(180, 140, 255, 0.15); padding: 10px; border-radius: 8px; margin: 10px 0;">
            ${orientationIcon} ${orientationName} | ${viewIcon} ${viewName}
          </div>
          <em style="font-size: 12px;">Drag to move | Pinch to resize</em>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:15px;">
          <button id="__tm_save_btn" style="flex:1; padding:12px; background: rgba(100, 200, 100, 0.9); color:white; border:none; border-radius: 8px; font-size:14px; cursor:pointer; font-weight:bold;">Save</button>
          <button id="__tm_close_btn" style="flex:1; padding:12px; background: rgba(150, 150, 150, 0.9); color:white; border:none; border-radius: 8px; font-size:14px; cursor:pointer; font-weight:bold;">Close</button>
        </div>

        <div style="font-size: 12px; line-height: 1.8; color: #555;">
      `;

      currentViewElements.forEach((el) => {
        const name = el.dataset.editName || el.id;
        const icon = el.dataset.editIcon || '';
        const config = layout[el.id];
        if (!config) return;

        html += `<strong>${icon} ${name}</strong><br>`;
        html += `Position: ${Number(config.left).toFixed(1)}%, ${Number(config.top).toFixed(1)}%<br>`;
        if (config.size !== undefined) html += `Size: ${Number(config.size).toFixed(1)}%<br><br>`;
        else html += `Width: ${Number(config.width).toFixed(1)}%<br><br>`;
      });

      html += `</div>`;

      layoutInfo.querySelector('.layout-info-content').innerHTML = html;

      const saveBtn = document.getElementById('__tm_save_btn');
      const closeBtn = document.getElementById('__tm_close_btn');

      saveBtn?.addEventListener('click', async () => {
        try {
          await saveLayoutToFirebase();
          alert('Layout saved!');
        } catch (e) {
          alert('Could not save: ' + (e?.message || e));
        }
        exitEditMode();
      });

      closeBtn?.addEventListener('click', () => {
        try { applyLayout(); } catch {}
        exitEditMode();
      });
    }
  }

  // ------------------------------------------------------------
  // Tailor System (token + patch + function viewer)
  // ------------------------------------------------------------
  function initTailor(ctx) {
    if (window.__TAILOR_INITIALIZED__) {
      console.log('Tailor already initialized, skipping...');
      return;
    }
    window.__TAILOR_INITIALIZED__ = true;
    
    const overlay = document.getElementById('tailorOverlay');
    const closeBtn = document.getElementById('tailorCloseBtn');

    const tokenInput = document.getElementById('tailorToken');
    const saveTokenBtn = document.getElementById('tailorSaveTokenBtn');
    const clearTokenBtn = document.getElementById('tailorClearTokenBtn');
    const status = document.getElementById('tailorTokenStatus');

    const patchArea = document.getElementById('tailorPatch');
    const dryRunBtn = document.getElementById('tailorDryRunBtn');
    const commitBtn = document.getElementById('tailorCommitBtn');
    const result = document.getElementById('tailorResult');

    const functionOutput = document.getElementById('tailor-output');
    const fileSelect = document.getElementById('tailor-file');
    const functionBtn = document.getElementById('tailor-go');

    if (fileSelect) {
      fileSelect.innerHTML = '';
      const files = ['app.js', 'tools.js', 'index.html', 'styles.css', 'firebase-config.js'];
      files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file;
        fileSelect.appendChild(option);
      });
    }

    if (!overlay || !result) return;

    const GH_DEFAULTS = {
      owner: "twomoonsonesky",
      repo: "Twomoonsstudio",
      branch: "rescuemission",
    };

    const STORAGE_KEY = 'TWO_MOONS_TAILOR_TOKEN';

    let currentMode = 'replace';

    function setResult(text) {
      const now = new Date();
      const time = now.toLocaleTimeString();
      result.textContent = `[${time}] ${text}`;
    }

    function loadTokenFromLocal() {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) {
        status && (status.textContent = 'Token saved on this iPad');
        if (tokenInput) tokenInput.value = t;
      } else {
        status && (status.textContent = 'No token saved yet.');
        if (tokenInput) tokenInput.value = '';
      }
    }

    function requireToken() {
      const t = (tokenInput?.value || '').trim();
      if (!t) throw new Error('No token. Paste token, press Save Token.');
      return t;
    }

    function parsePatch() {
      const raw = (patchArea?.value || '').trim();
      if (!raw) throw new Error('Paste a patch JSON first.');
      let obj;
      try { obj = JSON.parse(raw); }
      catch { throw new Error('Patch JSON is not valid JSON. (Missing comma / bracket).'); }

      const required = ['owner', 'repo', 'branch', 'filePath', 'find', 'replace', 'commitMessage'];
      for (const k of required) {
        if (!obj[k] || typeof obj[k] !== 'string') throw new Error(`Patch missing "${k}" (must be a string).`);
      }
      return obj;
    }

    function ghPath(path) {
      return String(path).split('/').map(encodeURIComponent).join('/');
    }

    async function ghRequest(token, url, options = {}) {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.headers || {})
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub error ${res.status}: ${text}`);
      }
      return res.json();
    }

    async function getFileContent(token, owner, repo, path, refName) {
  // TAILOR_ENGINE_START
  // TAILOR_ENGINE:loader_START

      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${ghPath(path)}?ref=${encodeURIComponent(refName)}`;
      const data = await ghRequest(token, url);
      if (!data.content) throw new Error('GitHub did not return file content. Is filePath correct?');
      
      const content = data.content.replace(/\n/g, '');
      const bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      
      return { decoded, sha: data.sha };

  // TAILOR_ENGINE:loader_END
  // TAILOR_ENGINE_END
    }

    function normalizeNewlines(s) {
      return String(s).replace(/\r\n/g, '\n');
    }

    function applyReplace(sourceText, find, replace) {
  // TAILOR_ENGINE_START
  // TAILOR_ENGINE:patch_applicator_START

      const S = normalizeNewlines(sourceText);
      const F = normalizeNewlines(find);
      const R = normalizeNewlines(replace);

      const count = S.split(F).length - 1;
      if (count <= 0) return { updated: sourceText, count: 0 };

      return { updated: S.split(F).join(R), count };

  // TAILOR_ENGINE:patch_applicator_END
  // TAILOR_ENGINE_END
    }

    async function putFileContent(token, owner, repo, path, branch, message, newText, sha) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${ghPath(path)}`;
      
      const bytes = new TextEncoder().encode(String(newText));
      const binString = String.fromCharCode(...bytes);
      const base64Content = btoa(binString);
      
      const body = {
        message,
        content: base64Content,
        sha,
        branch
      };
      
      return ghRequest(token, url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    closeBtn?.addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    saveTokenBtn?.addEventListener('click', () => {
      const t = (tokenInput?.value || '').trim();
      if (!t) {
        status && (status.textContent = 'Paste token first.');
        return;
      }
      localStorage.setItem(STORAGE_KEY, t);
      status && (status.textContent = 'Token saved on this iPad');
      setResult('Token saved.');
    });

    clearTokenBtn?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      if (tokenInput) tokenInput.value = '';
      status && (status.textContent = 'Token cleared.');
      setResult('Token cleared.');
    });

    dryRunBtn?.addEventListener('click', async () => {
      try {
        setResult('Dry run...');
        const token = requireToken();
        const patch = parsePatch();

        const { decoded } = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);
        const { count } = applyReplace(decoded, patch.find, patch.replace);

        if (count === 0) {
          setResult(`Dry Run: find-text not found in ${patch.filePath}\n\nTip: generate the find-text from GitHub (Function Finder now does).`);
          return;
        }

        setResult(`Dry Run OK\nFile: ${patch.filePath}\nReplacements: ${count}\n\n(No commit made.)`);
      } catch (e) {
        setResult('Error: ' + (e?.message || e));
      }
    });

    commitBtn?.addEventListener('click', async () => {
      try {
        setResult('Committing patch...');
        const token = requireToken();
        const patch = parsePatch();

        const before = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);
        const { updated, count } = applyReplace(before.decoded, patch.find, patch.replace);

        if (count === 0) {
          setResult(`Commit blocked: find-text not found in ${patch.filePath}`);
          return;
        }

        const latest = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);

        const same = normalizeNewlines(latest.decoded) === normalizeNewlines(updated);
        if (same) {
          setResult(`No changes to commit.\nFile: ${patch.filePath}\n(Replacement produced identical content.)`);
          return;
        }

        await putFileContent(
          token,
          patch.owner,
          patch.repo,
          patch.filePath,
          patch.branch,
          patch.commitMessage,
          updated,
          latest.sha
        );

        setResult(`Patch committed!\nFile: ${patch.filePath}\nReplacements: ${count}\n\nRefresh your page to load the new code.`);
      } catch (e) {
        setResult('Error: ' + (e?.message || e));
      }
    });

    if (!functionOutput || !functionBtn) {
      loadTokenFromLocal();
      return;
    }

    async function getFileText(file) {
  // TAILOR_ENGINE_START
  // TAILOR_ENGINE:loader_START

      const token = requireToken();
      const { decoded } = await getFileContent(
        token,
        GH_DEFAULTS.owner,
        GH_DEFAULTS.repo,
        file,
        GH_DEFAULTS.branch
      );
      return decoded;

  // TAILOR_ENGINE:loader_END
  // TAILOR_ENGINE_END
    }

    async function getFunctionNames(file) {
      const text = await getFileText(file);
      const names = new Set();

      for (const m of text.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)) {
        names.add(m[1] + '()');
      }

      for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?function\s*\(/g)) {
        names.add(m[1] + '()');
      }

      for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)) {
        names.add(m[1] + '()');
      }

      for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/g)) {
        names.add(m[1] + '()');
      }

      return [...names].sort();
    }

    function extractFunctionSource(text, funcName) {
  // TAILOR_ENGINE_START
  // TAILOR_ENGINE:parser_START

      const name = String(funcName).replace(/[.*+?^${}()|[\]\\]/g, '\\function extractFunctionSource(text, funcName) {
      const name = String(funcName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const patterns = [
        new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'm'),
        new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{`, 'm'),
        new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?function\\s*\\([^)]*\\)\\s*\\{`, 'm'),
      ];

      let match = null;
      for (const rx of patterns) {
        match = text.match(rx);
        if (match) break;
      }
      if (!match) return null;

      const startIndex = match.index;
      const braceIndex = text.indexOf('{', startIndex);
      if (braceIndex < 0) return null;

      let depth = 0;
      let inS = false, inD = false, inT = false;
      let inLine = false, inBlock = false;
      let esc = false;

      for (let i = braceIndex; i < text.length; i++) {
        const c = text[i];
        const n = text[i + 1];

        if (inLine) { if (c === '\n') inLine = false; continue; }
        if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }

        if (!inS && !inD && !inT) {
          if (c === '/' && n === '/') { inLine = true; i++; continue; }
          if (c === '/' && n === '*') { inBlock = true; i++; continue; }
        }

        if (inS) { if (!esc && c === "'") inS = false; esc = (!esc && c === '\\'); continue; }
        if (inD) { if (!esc && c === '"') inD = false; esc = (!esc && c === '\\'); continue; }
        if (inT) { if (!esc && c === '`') inT = false; esc = (!esc && c === '\\'); continue; }

        if (c === "'") { inS = true; esc = false; continue; }
        if (c === '"') { inD = true; esc = false; continue; }
        if (c === '`') { inT = true; esc = false; continue; }

        if (c === '{') depth++;
        if (c === '}') depth--;

        if (depth === 0) return text.slice(startIndex, i + 1);
      }

      return null;
    }');

      const patterns = [
        new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'm'),
        new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{`, 'm'),
        new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?function\\s*\\([^)]*\\)\\s*\\{`, 'm'),
      ];

      let match = null;
      for (const rx of patterns) {
        match = text.match(rx);
        if (match) break;
      }
      if (!match) return null;

      const startIndex = match.index;
      const braceIndex = text.indexOf('{', startIndex);
      if (braceIndex < 0) return null;

      let depth = 0;
      let inS = false, inD = false, inT = false;
      let inLine = false, inBlock = false;
      let esc = false;

      for (let i = braceIndex; i < text.length; i++) {
        const c = text[i];
        const n = text[i + 1];

        if (inLine) { if (c === '\n') inLine = false; continue; }
        if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }

        if (!inS && !inD && !inT) {
          if (c === '/' && n === '/') { inLine = true; i++; continue; }
          if (c === '/' && n === '*') { inBlock = true; i++; continue; }
        }

        if (inS) { if (!esc && c === "'") inS = false; esc = (!esc && c === '\\'); continue; }
        if (inD) { if (!esc && c === '"') inD = false; esc = (!esc && c === '\\'); continue; }
        if (inT) { if (!esc && c === '`') inT = false; esc = (!esc && c === '\\'); continue; }

        if (c === "'") { inS = true; esc = false; continue; }
        if (c === '"') { inD = true; esc = false; continue; }
        if (c === '`') { inT = true; esc = false; continue; }

        if (c === '{') depth++;
        if (c === '}') depth--;

        if (depth === 0) return text.slice(startIndex, i + 1);
      }

      return null;

  // TAILOR_ENGINE:parser_END
  // TAILOR_ENGINE_END
    }

    function getSectionNames(text) {
      const sections = [];
      
      const htmlPattern = /<!--\s*([A-Z_]+)_START\s*-->/g;
      const cssPattern = /\/\*\s*([A-Z_]+)_START\s*\*\//g;
      
      for (const m of text.matchAll(htmlPattern)) {
        sections.push(m[1]);
      }
      
      for (const m of text.matchAll(cssPattern)) {
        sections.push(m[1]);
      }
      
      return [...new Set(sections)].sort();
    }

    function extractSectionContent(text, sectionName) {
  // TAILOR_ENGINE_START
  // TAILOR_ENGINE:parser_START

      const htmlStart = `<!-- ${sectionName}_START -->`;
      const htmlEnd = `<!-- ${sectionName}_END -->`;
      
      let startIdx = text.indexOf(htmlStart);
      let endIdx = text.indexOf(htmlEnd);
      
      if (startIdx === -1) {
        const cssStart = `/* ${sectionName}_START */`;
        const cssEnd = `/* ${sectionName}_END */`;
        
        startIdx = text.indexOf(cssStart);
        endIdx = text.indexOf(cssEnd);
        
        if (startIdx !== -1 && endIdx !== -1) {
          return text.slice(startIdx, endIdx + cssEnd.length);
        }
      } else if (endIdx !== -1) {
        return text.slice(startIdx, endIdx + htmlEnd.length);
      }
      
      return null;

  // TAILOR_ENGINE:parser_END
  // TAILOR_ENGINE_END
    }

    async function renderDebugContext(targetId) {
      functionOutput.innerHTML = '';
      
      const backBtn = document.createElement('button');
      backBtn.textContent = '<- Back';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = renderModeSelector;
      functionOutput.appendChild(backBtn);

      const title = document.createElement('div');
      title.textContent = `[DEBUG] ${targetId}`;
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '12px';
      functionOutput.appendChild(title);

      const loading = document.createElement('div');
      loading.textContent = 'Searching all files...';
      functionOutput.appendChild(loading);

      try {
        const token = requireToken();
        
        const files = ['index.html', 'styles.css', 'app.js', 'tools.js', 'firebase-config.js'];
        const results = {
          html: '',
          css: [],
          jsListeners: [],
          jsReferences: [],
          issues: []
        };

        for (const file of files) {
          const { decoded } = await getFileContent(token, GH_DEFAULTS.owner, GH_DEFAULTS.repo, file, GH_DEFAULTS.branch);
          
          if (file === 'index.html') {
            const idPattern = new RegExp(`id=["']${targetId}["']`, 'g');
            if (idPattern.test(decoded)) {
              const lines = decoded.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(`id="${targetId}"`)) {
                  results.html = lines.slice(i, i + 6).join('\n');
                  break;
                }
              }
            }
          }
          
          if (file === 'styles.css') {
            const idSelector = new RegExp(`#${targetId}\\s*\\{[^}]+\\}`, 'g');
            const classMatches = decoded.match(idSelector);
            if (classMatches) {
              results.css.push(...classMatches);
            }
          }
          
          if (file.endsWith('.js')) {
            const getByIdPattern = new RegExp(`getElementById\\(['"]${targetId}['"]\\)`, 'g');
            if (getByIdPattern.test(decoded)) {
              results.jsReferences.push(`Found in ${file}`);
              
              const listenerPattern = new RegExp(`${targetId}[^;]+addEventListener\\(['"]([^'"]+)['"][^)]+\\)`, 'g');
              const listeners = decoded.match(listenerPattern);
              if (listeners) {
                results.jsListeners.push(...listeners);
              }
            }
          }
        }

        functionOutput.innerHTML = '';
        functionOutput.appendChild(backBtn);
        functionOutput.appendChild(title);

        if (results.html) {
          const htmlSection = document.createElement('div');
          htmlSection.innerHTML = `<strong>[HTML]</strong>`;
          htmlSection.style.marginTop = '12px';
          htmlSection.style.marginBottom = '6px';
          functionOutput.appendChild(htmlSection);

          const htmlBox = document.createElement('pre');
          htmlBox.textContent = results.html;
          htmlBox.style.background = '#f5f5f5';
          htmlBox.style.padding = '10px';
          htmlBox.style.borderRadius = '6px';
          htmlBox.style.fontSize = '11px';
          htmlBox.style.overflow = 'auto';
          htmlBox.style.fontFamily = 'monospace';
          functionOutput.appendChild(htmlBox);
        }

        if (results.jsListeners.length > 0) {
          const jsSection = document.createElement('div');
          jsSection.innerHTML = `<strong>[EVENT LISTENERS]</strong>`;
          jsSection.style.marginTop = '12px';
          jsSection.style.marginBottom = '6px';
          functionOutput.appendChild(jsSection);

          results.jsListeners.forEach(listener => {
            const listenerBox = document.createElement('pre');
            listenerBox.textContent = listener;
            listenerBox.style.background = '#fff3cd';
            listenerBox.style.padding = '8px';
            listenerBox.style.borderRadius = '6px';
            listenerBox.style.fontSize = '11px';
            listenerBox.style.marginBottom = '6px';
            listenerBox.style.fontFamily = 'monospace';
            functionOutput.appendChild(listenerBox);
          });
        }

        if (results.css.length > 0) {
          const cssSection = document.createElement('div');
          cssSection.innerHTML = `<strong>[CSS]</strong>`;
          cssSection.style.marginTop = '12px';
          cssSection.style.marginBottom = '6px';
          functionOutput.appendChild(cssSection);

          results.css.forEach(rule => {
            const cssBox = document.createElement('pre');
            cssBox.textContent = rule;
            cssBox.style.background = '#e3f2fd';
            cssBox.style.padding = '8px';
            cssBox.style.borderRadius = '6px';
            cssBox.style.fontSize = '11px';
            cssBox.style.marginBottom = '6px';
            cssBox.style.fontFamily = 'monospace';
            functionOutput.appendChild(cssBox);
          });
        }

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '[COPY DEBUG BUNDLE]';
        copyBtn.style.marginTop = '12px';
        copyBtn.style.padding = '10px';
        copyBtn.style.width = '100%';
        copyBtn.style.borderRadius = '8px';
        copyBtn.style.border = 'none';
        copyBtn.style.background = '#4CAF50';
        copyBtn.style.color = 'white';
        copyBtn.style.fontWeight = 'bold';
        copyBtn.style.cursor = 'pointer';
        
        copyBtn.onclick = async () => {
          const bundle = `
[DEBUG CONTEXT: ${targetId}]

[HTML:]
${results.html || 'Not found'}

[EVENT LISTENERS:]
${results.jsListeners.join('\n\n') || 'None found'}

[CSS:]
${results.css.join('\n\n') || 'None found'}

[REFERENCES:]
${results.jsReferences.join('\n') || 'None found'}
          `;
          
          try {
            await navigator.clipboard.writeText(bundle);
            copyBtn.textContent = '[COPIED!]';
            setTimeout(() => { copyBtn.textContent = '[COPY DEBUG BUNDLE]'; }, 2000);
          } catch {
            alert('Copy the text above manually');
          }
        };
        
        functionOutput.appendChild(copyBtn);

      } catch (error) {
        functionOutput.innerHTML = `Error: ${error.message}`;
      }
    }

    function renderModeSelector() {
  functionOutput.innerHTML = '';
  
  const file = fileSelect?.value || 'app.js';
  
  const title = document.createElement('div');
  title.textContent = 'Choose Edit Mode:';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '12px';
  functionOutput.appendChild(title);

  const modes = [
    { id: 'replace', label: 'Replace Function', desc: 'Update existing function (JS files only)', showFor: ['app.js', 'tools.js', 'firebase-config.js'] },
    { id: 'insertAfter', label: 'Insert After Function', desc: 'Add new function after selected (JS only)', showFor: ['app.js', 'tools.js', 'firebase-config.js'] },
    { id: 'append', label: 'Append to End', desc: 'Add new code at end of file', showFor: 'all' },
    { id: 'editSection', label: 'Edit Section', desc: 'Edit marked sections (HTML/CSS)', showFor: ['index.html', 'styles.css'] },
    { id: 'viewFull', label: 'View/Edit Full File', desc: 'Edit entire file content', showFor: 'all' },
    { id: 'debugContext', label: '[DEBUG] Code Explorer', desc: 'Find all code related to an element', showFor: 'all' },
    { id: 'quickPaste', label: '[QUICK] Paste Command', desc: 'Paste pre-formatted code block with headers', showFor: 'all' },
    { id: 'auditCode', label: '[AUDIT] Code Quality', desc: 'Find unmarked functions and sections', showFor: 'all' }
  ];

  modes.forEach(mode => {
    if (mode.showFor !== 'all' && !mode.showFor.includes(file)) {
      return;
    }
    
    const btn = document.createElement('button');
    btn.textContent = mode.label;
    btn.style.width = '100%';
    btn.style.padding = '12px';
    btn.style.marginBottom = '8px';
    btn.style.textAlign = 'left';
    btn.style.cursor = 'pointer';
    btn.style.border = '2px solid #ccc';
    btn.style.borderRadius = '6px';
    btn.style.background = currentMode === mode.id ? '#e3f2fd' : 'white';

    const desc = document.createElement('div');
    desc.textContent = mode.desc;
    desc.style.fontSize = '0.85em';
    desc.style.color = '#666';
    desc.style.marginTop = '4px';
    btn.appendChild(desc);

    btn.onclick = () => {
      currentMode = mode.id;
      if (mode.id === 'debugContext') {
        showDebugContextInput();
      } else if (mode.id === 'quickPaste') {
        showQuickPasteInput();
      } else if (mode.id === 'auditCode') {
        showAuditMode();
      } else {
        startEditMode();
      }
    };

    functionOutput.appendChild(btn);
  });
}

// QUICK_PASTE_SYSTEM_START
  // QUICK_PASTE_SYSTEM:input_ui_START
  function showQuickPasteInput() {
  // QUICK_PASTE_SYSTEM_START
  // QUICK_PASTE_SYSTEM:input_ui_START
  
  functionOutput.innerHTML = '';
  
  const backBtn = document.createElement('button');
  backBtn.textContent = '<- Back';
  backBtn.style.marginBottom = '10px';
  backBtn.onclick = renderModeSelector;
  functionOutput.appendChild(backBtn);

  const title = document.createElement('div');
  title.textContent = '[QUICK] Paste Command Block';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '12px';
  functionOutput.appendChild(title);

  const instructions = document.createElement('div');
  instructions.innerHTML = `
    <div style="padding: 10px; background: #e3f2fd; border-radius: 8px; margin-bottom: 12px; font-size: 12px;">
      <strong>Format:</strong><br>
      <code style="display: block; margin-top: 6px; font-family: monospace;">
---<br>
FILE: tools.js<br>
MODE: replace<br>
FUNCTION: initEditMenu()<br>
---<br>
[your code here]
      </code>
      <div style="margin-top: 8px;">
        <strong>Modes:</strong> replace, insertAfter, append, editSection<br>
        <strong>For sections:</strong> Use SECTION: instead of FUNCTION:
      </div>
    </div>
  `;
  functionOutput.appendChild(instructions);

  const pasteBox = document.createElement('textarea');
  pasteBox.placeholder = 'Paste your command block here...';
  pasteBox.style.width = '100%';
  pasteBox.style.minHeight = '300px';
  pasteBox.style.fontFamily = 'monospace';
  pasteBox.style.fontSize = '12px';
  pasteBox.style.padding = '10px';
  pasteBox.style.borderRadius = '8px';
  pasteBox.style.border = '2px solid rgba(180,140,255,0.4)';
  pasteBox.style.marginBottom = '10px';
  functionOutput.appendChild(pasteBox);

  const processBtn = document.createElement('button');
  processBtn.textContent = 'Generate Patch';
  processBtn.style.width = '100%';
  processBtn.style.padding = '12px';
  processBtn.style.borderRadius = '8px';
  processBtn.style.border = 'none';
  processBtn.style.background = '#4CAF50';
  processBtn.style.color = 'white';
  processBtn.style.fontWeight = 'bold';
  processBtn.style.cursor = 'pointer';
  
  processBtn.onclick = async () => {
    const content = pasteBox.value.trim();
    if (!content) {
      alert('Please paste a command block first!');
      return;
    }

    try {
      const parsed = parseQuickPasteBlock(content);
      await executeQuickPaste(parsed);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };
  
  functionOutput.appendChild(processBtn);
  
  // QUICK_PASTE_SYSTEM:input_ui_END
  // QUICK_PASTE_SYSTEM_END
}
  // QUICK_PASTE_SYSTEM:input_ui_END
// QUICK_PASTE_SYSTEM_END

async function showAuditMode() {
  // AUDIT_SYSTEM_START
  // AUDIT_SYSTEM:ui_renderer_START
  
  functionOutput.innerHTML = '';
  
  const backBtn = document.createElement('button');
  backBtn.textContent = '<- Back';
  backBtn.style.marginBottom = '10px';
  backBtn.onclick = renderModeSelector;
  functionOutput.appendChild(backBtn);

  const title = document.createElement('div');
  title.textContent = '[AUDIT] Code Quality Scanner';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '12px';
  functionOutput.appendChild(title);

  const file = fileSelect?.value || 'app.js';
  
  const fileLabel = document.createElement('div');
  fileLabel.textContent = `Scanning: ${file}`;
  fileLabel.style.padding = '8px';
  fileLabel.style.background = '#e3f2fd';
  fileLabel.style.borderRadius = '6px';
  fileLabel.style.marginBottom = '12px';
  fileLabel.style.fontSize = '14px';
  functionOutput.appendChild(fileLabel);

  const loading = document.createElement('div');
  loading.textContent = 'Analyzing code...';
  loading.style.padding = '20px';
  loading.style.textAlign = 'center';
  loading.style.color = '#666';
  functionOutput.appendChild(loading);

  try {
    const token = requireToken();
    const results = await auditFile(file, token);
    const fileText = await getFileText(file);
    
    functionOutput.removeChild(loading);
    
    // Store selections for each function
    const selections = {};
    
    // Display unmarked snippets with accordion
    if (results.unmarked.length > 0) {
      const unmarkedHeader = document.createElement('div');
      unmarkedHeader.textContent = `UNMARKED (${results.unmarked.length} functions):`;
      unmarkedHeader.style.fontWeight = 'bold';
      unmarkedHeader.style.marginTop = '12px';
      unmarkedHeader.style.marginBottom = '12px';
      unmarkedHeader.style.color = '#d32f2f';
      functionOutput.appendChild(unmarkedHeader);

      results.unmarked.forEach((name, index) => {
        const container = document.createElement('div');
        container.style.marginBottom = '8px';
        container.style.border = '2px solid #ddd';
        container.style.borderRadius = '8px';
        container.style.overflow = 'hidden';
        
        // Header (always visible)
        const header = document.createElement('div');
        header.style.padding = '10px';
        header.style.background = '#f5f5f5';
        header.style.cursor = 'pointer';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        
        const headerText = document.createElement('span');
        headerText.textContent = `▶ ${name}`;
        headerText.style.fontWeight = 'bold';
        headerText.style.fontSize = '13px';
        header.appendChild(headerText);
        
        const statusBadge = document.createElement('span');
        statusBadge.style.fontSize = '11px';
        statusBadge.style.padding = '2px 8px';
        statusBadge.style.borderRadius = '4px';
        statusBadge.style.background = '#ccc';
        statusBadge.style.color = 'white';
        statusBadge.textContent = 'Not labeled';
        header.appendChild(statusBadge);
        
        container.appendChild(header);
        
        // Expandable content (hidden initially)
        const content = document.createElement('div');
        content.style.display = 'none';
        content.style.padding = '12px';
        content.style.background = '#fff3cd';
        
        // Feature dropdown
        const featureRow = document.createElement('div');
        featureRow.style.marginBottom = '10px';
        
        const featureLabel = document.createElement('div');
        featureLabel.textContent = 'Feature:';
        featureLabel.style.fontSize = '12px';
        featureLabel.style.marginBottom = '4px';
        featureLabel.style.fontWeight = 'bold';
        featureRow.appendChild(featureLabel);
        
        const featureSelect = document.createElement('select');
        featureSelect.style.width = '100%';
        featureSelect.style.padding = '8px';
        featureSelect.style.borderRadius = '4px';
        featureSelect.style.border = '1px solid #ccc';
        
        const featureOptions = [
          'Select...',
          'TAILOR_ENGINE',
          'QUICK_PASTE_SYSTEM',
          'AUDIT_SYSTEM',
          'DEBUG_CONTEXT',
          'EDIT_MENU',
          'LAYOUT_EDITOR',
          'ORB_INTERACTION',
          'UPLOAD_SYSTEM',
          'COTTAGE_ZOOM',
          '+ Create New...'
        ];
        
        featureOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          featureSelect.appendChild(option);
        });
        
        featureRow.appendChild(featureSelect);
        content.appendChild(featureRow);
        
        // Custom feature input
        const customFeatureRow = document.createElement('div');
        customFeatureRow.style.display = 'none';
        customFeatureRow.style.marginBottom = '10px';
        
        const customFeatureInput = document.createElement('input');
        customFeatureInput.type = 'text';
        customFeatureInput.placeholder = 'MY_FEATURE';
        customFeatureInput.style.width = '100%';
        customFeatureInput.style.padding = '8px';
        customFeatureInput.style.borderRadius = '4px';
        customFeatureInput.style.border = '1px solid #ccc';
        customFeatureInput.style.textTransform = 'uppercase';
        customFeatureRow.appendChild(customFeatureInput);
        content.appendChild(customFeatureRow);
        
        featureSelect.addEventListener('change', () => {
          if (featureSelect.value === '+ Create New...') {
            customFeatureRow.style.display = 'block';
            customFeatureInput.focus();
          } else {
            customFeatureRow.style.display = 'none';
          }
        });
        
        // Subcomponent dropdown
        const subRow = document.createElement('div');
        subRow.style.marginBottom = '10px';
        
        const subLabel = document.createElement('div');
        subLabel.textContent = 'Subcomponent:';
        subLabel.style.fontSize = '12px';
        subLabel.style.marginBottom = '4px';
        subLabel.style.fontWeight = 'bold';
        subRow.appendChild(subLabel);
        
        const subSelect = document.createElement('select');
        subSelect.style.width = '100%';
        subSelect.style.padding = '8px';
        subSelect.style.borderRadius = '4px';
        subSelect.style.border = '1px solid #ccc';
        
        const subOptions = [
          'Select...',
          'initializer',
          'handler',
          'renderer',
          'validator',
          'scanner',
          'builder',
          'parser',
          'formatter',
          '+ Custom...'
        ];
        
        subOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          subSelect.appendChild(option);
        });
        
        subRow.appendChild(subSelect);
        content.appendChild(subRow);
        
        // Custom subcomponent input
        const customSubRow = document.createElement('div');
        customSubRow.style.display = 'none';
        customSubRow.style.marginBottom = '10px';
        
        const customSubInput = document.createElement('input');
        customSubInput.type = 'text';
        customSubInput.placeholder = 'my_handler';
        customSubInput.style.width = '100%';
        customSubInput.style.padding = '8px';
        customSubInput.style.borderRadius = '4px';
        customSubInput.style.border = '1px solid #ccc';
        customSubInput.style.textTransform = 'lowercase';
        customSubRow.appendChild(customSubInput);
        content.appendChild(customSubRow);
        
        subSelect.addEventListener('change', () => {
          if (subSelect.value === '+ Custom...') {
            customSubRow.style.display = 'block';
            customSubInput.focus();
          } else {
            customSubRow.style.display = 'none';
          }
        });
        
        // Done button
        const doneBtn = document.createElement('button');
        doneBtn.textContent = '✓ Done';
        doneBtn.style.width = '100%';
        doneBtn.style.padding = '10px';
        doneBtn.style.borderRadius = '6px';
        doneBtn.style.border = 'none';
        doneBtn.style.background = '#4CAF50';
        doneBtn.style.color = 'white';
        doneBtn.style.fontWeight = 'bold';
        doneBtn.style.cursor = 'pointer';
        
        doneBtn.onclick = () => {
          let feature = featureSelect.value;
          let sub = subSelect.value;
          
          if (feature === '+ Create New...') {
            feature = customFeatureInput.value.trim().toUpperCase().replace(/\s+/g, '_');
          }
          
          if (sub === '+ Custom...') {
            sub = customSubInput.value.trim().toLowerCase().replace(/\s+/g, '_');
          }
          
          if (!feature || feature === 'Select...') {
            alert('Please select a feature!');
            return;
          }
          
          if (!sub || sub === 'Select...') {
            alert('Please select a subcomponent!');
            return;
          }
          
          // Save selection
          selections[name] = { feature, sub };
          
          // Update UI
          headerText.textContent = `✓ ${name}`;
          statusBadge.textContent = `${feature}:${sub}`;
          statusBadge.style.background = '#4CAF50';
          content.style.display = 'none';
          
          // Update apply button count
          updateApplyButton();
        };
        
        content.appendChild(doneBtn);
        container.appendChild(content);
        
        // Toggle accordion
        header.onclick = () => {
          const isOpen = content.style.display === 'block';
          document.querySelectorAll('.audit-content').forEach(c => c.style.display = 'none');
          content.style.display = isOpen ? 'none' : 'block';
          const arrow = isOpen ? '▶' : '▼';
          headerText.textContent = headerText.textContent.replace(/^[▶▼✓]\s/, arrow + ' ');
        };
        
        content.classList.add('audit-content');
        functionOutput.appendChild(container);
      });
      
      // Apply All button
      const applyBtn = document.createElement('button');
      applyBtn.id = 'applyAllMarkersBtn';
      applyBtn.textContent = 'Apply All Markers (0 ready)';
      applyBtn.style.width = '100%';
      applyBtn.style.padding = '14px';
      applyBtn.style.marginTop = '16px';
      applyBtn.style.borderRadius = '8px';
      applyBtn.style.border = 'none';
      applyBtn.style.background = '#ccc';
      applyBtn.style.color = 'white';
      applyBtn.style.fontWeight = 'bold';
      applyBtn.style.fontSize = '15px';
      applyBtn.style.cursor = 'not-allowed';
      applyBtn.disabled = true;
      
      function updateApplyButton() {
        const count = Object.keys(selections).length;
        applyBtn.textContent = `Apply All Markers (${count} ready)`;
        if (count > 0) {
          applyBtn.style.background = '#2196F3';
          applyBtn.style.cursor = 'pointer';
          applyBtn.disabled = false;
        } else {
          applyBtn.style.background = '#ccc';
          applyBtn.style.cursor = 'not-allowed';
          applyBtn.disabled = true;
        }
      }
      
      applyBtn.onclick = async () => {
        const count = Object.keys(selections).length;
        if (count === 0) return;
        
        if (!confirm(`Apply feature markers to ${count} functions?`)) return;
        
        applyBtn.textContent = 'Applying...';
        applyBtn.disabled = true;
        
        try {
          await applyAllMarkers(file, fileText, selections, token);
          alert(`Success! Applied markers to ${count} functions!`);
          showAuditMode();
        } catch (error) {
          alert('Error: ' + error.message);
          applyBtn.textContent = `Apply All Markers (${count} ready)`;
          applyBtn.disabled = false;
        }
      };
      
      functionOutput.appendChild(applyBtn);
    }
    
    // Display marked snippets
    if (results.marked.length > 0) {
      const markedHeader = document.createElement('div');
      markedHeader.textContent = `MARKED (${results.marked.length} labeled):`;
      markedHeader.style.fontWeight = 'bold';
      markedHeader.style.marginTop = '20px';
      markedHeader.style.marginBottom = '8px';
      markedHeader.style.color = '#388e3c';
      functionOutput.appendChild(markedHeader);

      results.marked.forEach(item => {
        const div = document.createElement('div');
        div.textContent = `✓ ${item.name} [${item.feature}]`;
        div.style.padding = '8px';
        div.style.fontSize = '13px';
        div.style.background = '#e8f5e9';
        div.style.borderRadius = '6px';
        div.style.marginBottom = '4px';
        functionOutput.appendChild(div);
      });
    }
    
    // Progress
    const total = results.marked.length + results.unmarked.length;
    const progress = document.createElement('div');
    progress.textContent = `Progress: ${results.marked.length} of ${total} labeled`;
    progress.style.marginTop = '16px';
    progress.style.padding = '10px';
    progress.style.background = '#f5f5f5';
    progress.style.borderRadius = '6px';
    progress.style.textAlign = 'center';
    progress.style.fontWeight = 'bold';
    functionOutput.appendChild(progress);
    
  } catch (error) {
    loading.textContent = 'Error: ' + error.message;
    loading.style.color = '#d32f2f';
  }
  
  // AUDIT_SYSTEM:ui_renderer_END
  // AUDIT_SYSTEM_END
}

async function auditFile(fileName, token) {
  // AUDIT_SYSTEM_START
  // AUDIT_SYSTEM:scanner_START

  const fileText = await getFileText(fileName);
  
  let snippets = [];
  
  if (fileName.endsWith('.js')) {
    snippets = await getFunctionNames(fileName);
  } else {
    snippets = getSectionNames(fileText);
  }
  
  const results = {
    marked: [],
    unmarked: []
  };
  
  for (const snippet of snippets) {
    const snippetName = snippet.replace(/\(\)$/, '');
    
    // Get the actual code for this specific snippet
    let snippetCode = null;
    if (fileName.endsWith('.js')) {
      snippetCode = extractFunctionSource(fileText, snippetName);
    } else {
      snippetCode = extractSectionContent(fileText, snippetName);
    }
    
    if (!snippetCode) {
      results.unmarked.push(snippet);
      continue;
    }
    
    // Check if THIS CODE BLOCK has feature markers
    const hasMarkers = checkForFeatureMarkers(snippetCode);
    
    if (hasMarkers) {
      const featureName = extractFeatureName(snippetCode);
      results.marked.push({
        name: snippet,
        feature: featureName || 'UNKNOWN'
      });
    } else {
      results.unmarked.push(snippet);
    }
  }
  
  return results;

  // AUDIT_SYSTEM:scanner_END
  // AUDIT_SYSTEM_END
}

function checkForFeatureMarkers(codeBlock) {
  // AUDIT_SYSTEM_START
  // AUDIT_SYSTEM:checker_START

  // Check ONLY lines 2-5 for feature markers
  // This is where they should ALWAYS be
  
  const lines = codeBlock.split('\n');
  
  // Lines 2-5 (array indices 1-4)
  const markerLines = lines.slice(1, 5).join('\n');
  
  const patterns = [
    /\/\/\s*[A-Z_]+_START/,           // JS: // FEATURE_START
    /<!--\s*[A-Z_]+_START/,            // HTML: <!-- FEATURE_START -->
    /\/\*\s*[A-Z_]+_START/             // CSS: /* FEATURE_START */
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(markerLines)) {
      return true;
    }
  }
  
  return false;

  // AUDIT_SYSTEM:checker_END
  // AUDIT_SYSTEM_END
}

function extractFeatureName(codeBlock) {
  // AUDIT_SYSTEM_START
  // AUDIT_SYSTEM:parser_START

  // Extract feature name from lines 2-5 only
  const lines = codeBlock.split('\n');
  const markerLines = lines.slice(1, 5).join('\n');
  
  const patterns = [
    /\/\/\s*([A-Z_]+)_START/,         // JS
    /<!--\s*([A-Z_]+)_START/,          // HTML
    /\/\*\s*([A-Z_]+)_START/           // CSS
  ];
  
  for (const pattern of patterns) {
    const match = markerLines.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;

  // AUDIT_SYSTEM:parser_END
  // AUDIT_SYSTEM_END
}

function validateFeatureMarkers(code) {
  // AUDIT_SYSTEM_START
  // AUDIT_SYSTEM:validator_START
  
  // Check if code has feature markers in lines 2-5
  const lines = code.split('\n');
  
  // Skip empty lines at start
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) {
      startIndex = i;
      break;
    }
  }
  
  // Check lines 2-5 after first non-empty line
  const markerLines = lines.slice(startIndex + 1, startIndex + 6).join('\n');
  
  const patterns = [
    /\/\/\s*[A-Z_]+_START/,           // JS: // FEATURE_START
    /<!--\s*[A-Z_]+_START/,            // HTML: <!-- FEATURE_START -->
    /\/\*\s*[A-Z_]+_START/             // CSS: /* FEATURE_START */
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(markerLines)) {
      return true;
    }
  }
  
  return false;
  
  // AUDIT_SYSTEM:validator_END
  // AUDIT_SYSTEM_END
}

async function applyAllMarkers(fileName, fileText, selections, token) {
  // AUDIT_SYSTEM_START
  // AUDIT_SYSTEM:batch_applicator_START
  
  let updatedText = fileText;
  let count = 0;
  
  // Apply markers to each selected function
  for (const [funcName, { feature, sub }] of Object.entries(selections)) {
    const cleanName = funcName.replace(/\(\)$/, '');
    
    // Get the original function code
    let originalCode;
    if (fileName.endsWith('.js')) {
      originalCode = extractFunctionSource(updatedText, cleanName);
    } else {
      originalCode = extractSectionContent(updatedText, cleanName);
    }
    
    if (!originalCode) {
      console.warn(`Could not find ${funcName} - skipping`);
      continue;
    }
    
    // Build the marked version
    const lines = originalCode.split('\n');
    const firstLine = lines[0]; // function declaration
    const restLines = lines.slice(1); // everything else
    
    const markedCode = [
      firstLine,
      `  // ${feature}_START`,
      `  // ${feature}:${sub}_START`,
      '',
      ...restLines.slice(0, -1), // body without closing brace
      '',
      `  // ${feature}:${sub}_END`,
      `  // ${feature}_END`,
      lines[lines.length - 1] // closing brace
    ].join('\n');
    
    // Replace in the full text
    updatedText = updatedText.replace(originalCode, markedCode);
    count++;
  }
  
  if (count === 0) {
    throw new Error('No functions were marked!');
  }
  
  // Create patch to replace entire file
  const patch = {
    owner: GH_DEFAULTS.owner,
    repo: GH_DEFAULTS.repo,
    branch: GH_DEFAULTS.branch,
    filePath: fileName,
    find: fileText,
    replace: updatedText,
    commitMessage: `Audit: Add feature markers to ${count} functions in ${fileName}`
  };
  
  // Get current file SHA
const getUrl = `https://api.github.com/repos/${GH_DEFAULTS.owner}/${GH_DEFAULTS.repo}/contents/${fileName}?ref=${GH_DEFAULTS.branch}`;
const getResp = await fetch(getUrl, {
  headers: { 'Authorization': `token ${token}` }
});

if (!getResp.ok) {
  throw new Error(`Failed to get file: ${getResp.statusText}`);
}

const fileData = await getResp.json();
const sha = fileData.sha;

// Commit the updated file
const commitUrl = `https://api.github.com/repos/${GH_DEFAULTS.owner}/${GH_DEFAULTS.repo}/contents/${fileName}`;
const commitResp = await fetch(commitUrl, {
  method: 'PUT',
  headers: {
    'Authorization': `token ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: `Audit: Add feature markers to ${count} functions in ${fileName}`,
    content: btoa(unescape(encodeURIComponent(updatedText))),
    sha: sha,
    branch: GH_DEFAULTS.branch
  })
});

if (!commitResp.ok) {
  const err = await commitResp.json();
  throw new Error(`Commit failed: ${err.message || commitResp.statusText}`);
}

  
  // AUDIT_SYSTEM:batch_applicator_END
  // AUDIT_SYSTEM_END
}

function parseQuickPasteBlock(content) {
  const lines = content.split('\n');
  
  let headerEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---' && i > 0) {
      headerEnd = i;
      break;
    }
  }
  
  if (headerEnd === -1) {
    throw new Error('Invalid format: Missing closing --- for header');
  }
  
  const headerLines = lines.slice(0, headerEnd);
  const codeLines = lines.slice(headerEnd + 1);
  
  const parsed = {
    file: '',
    mode: '',
    target: '',
    code: codeLines.join('\n').trim()
  };
  
  for (const line of headerLines) {
    const trimmed = line.trim();
    if (trimmed === '---') continue;
    
    const fileMat = trimmed.match(/^FILE:\s*(.+)$/i);
    if (fileMat) {
      parsed.file = fileMat[1].trim();
      continue;
    }
    
    const modeMat = trimmed.match(/^MODE:\s*(.+)$/i);
    if (modeMat) {
      parsed.mode = modeMat[1].trim().toLowerCase();
      continue;
    }
    
    const funcMat = trimmed.match(/^FUNCTION:\s*(.+)$/i);
    if (funcMat) {
      parsed.target = funcMat[1].trim();
      continue;
    }
    
    const sectMat = trimmed.match(/^SECTION:\s*(.+)$/i);
    if (sectMat) {
      parsed.target = sectMat[1].trim();
      parsed.mode = 'editSection';
      continue;
    }
  }
  
  if (!parsed.file) throw new Error('Missing FILE: in header');
  if (!parsed.mode) throw new Error('Missing MODE: in header');
  if (!parsed.code) throw new Error('No code provided after header');
  
  if ((parsed.mode === 'replace' || parsed.mode === 'insertafter') && !parsed.target) {
    throw new Error(`MODE ${parsed.mode} requires FUNCTION: or SECTION:`);
  }
  
  return parsed;
}

async function executeQuickPaste(parsed) {
  // QUICK_PASTE_SYSTEM_START
  // QUICK_PASTE_SYSTEM:executor_START
  
  const token = requireToken();
  const text = await getFileText(parsed.file);
  
  let find, replace, commitMsg;
  
  // Validate markers BEFORE processing
  if (!validateFeatureMarkers(parsed.code)) {
    throw new Error(`Missing feature markers!\n\nYour code must have markers on lines 2-5:\n\n// FEATURE_NAME_START\n// FEATURE_NAME:subcomponent_START\n\nAdd markers and try again.`);
  }
  
  if (parsed.mode === 'replace') {
    if (parsed.file.endsWith('.js')) {
      const funcName = parsed.target.replace(/\(\)$/, '');
      find = extractFunctionSource(text, funcName);
      if (!find) throw new Error(`Function ${parsed.target} not found in ${parsed.file}`);
      replace = parsed.code;
      commitMsg = `Quick Paste: replace ${funcName} in ${parsed.file}`;
    } else {
      find = extractSectionContent(text, parsed.target);
      if (!find) throw new Error(`Section ${parsed.target} not found in ${parsed.file}`);
      replace = parsed.code;
      commitMsg = `Quick Paste: replace section ${parsed.target} in ${parsed.file}`;
    }
  } else if (parsed.mode === 'insertafter') {
    const funcName = parsed.target.replace(/\(\)$/, '');
    find = extractFunctionSource(text, funcName);
    if (!find) throw new Error(`Function ${parsed.target} not found in ${parsed.file}`);
    replace = find + '\n\n' + parsed.code;
    commitMsg = `Quick Paste: insert after ${funcName} in ${parsed.file}`;
  } else if (parsed.mode === 'append') {
    find = text;
    replace = text + '\n\n' + parsed.code;
    commitMsg = `Quick Paste: append to ${parsed.file}`;
  } else if (parsed.mode === 'editsection') {
    find = extractSectionContent(text, parsed.target);
    if (!find) throw new Error(`Section ${parsed.target} not found in ${parsed.file}`);
    replace = parsed.code;
    commitMsg = `Quick Paste: replace section ${parsed.target} in ${parsed.file}`;
  } else {
    throw new Error(`Unknown mode: ${parsed.mode}`);
  }
  
  const patch = {
    owner: GH_DEFAULTS.owner,
    repo: GH_DEFAULTS.repo,
    branch: GH_DEFAULTS.branch,
    filePath: parsed.file,
    find: find,
    replace: replace,
    commitMessage: commitMsg
  };
  
  if (patchArea) patchArea.value = JSON.stringify(patch, null, 2);
  setResult('Quick Paste: Patch JSON generated! Press Dry Run to verify, then Commit.');
  
  // QUICK_PASTE_SYSTEM:executor_END
  // QUICK_PASTE_SYSTEM_END
}

    function showDebugContextInput() {
      functionOutput.innerHTML = '';
      
      const backBtn = document.createElement('button');
      backBtn.textContent = '<- Back';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = renderModeSelector;
      functionOutput.appendChild(backBtn);

      const title = document.createElement('div');
      title.textContent = '[DEBUG] Code Explorer';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '12px';
      functionOutput.appendChild(title);

      const label = document.createElement('div');
      label.textContent = 'Enter element ID to debug:';
      label.style.fontSize = '13px';
      label.style.marginBottom = '8px';
      functionOutput.appendChild(label);

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'e.g., uploadAssetsOption';
      input.style.width = '100%';
      input.style.padding = '10px';
      input.style.borderRadius = '8px';
      input.style.border = '2px solid rgba(180,140,255,0.4)';
      input.style.marginBottom = '10px';
      functionOutput.appendChild(input);

      const searchBtn = document.createElement('button');
      searchBtn.textContent = 'Search All Files';
      searchBtn.style.width = '100%';
      searchBtn.style.padding = '12px';
      searchBtn.style.borderRadius = '8px';
      searchBtn.style.border = 'none';
      searchBtn.style.background = '#4CAF50';
      searchBtn.style.color = 'white';
      searchBtn.style.fontWeight = 'bold';
      searchBtn.style.cursor = 'pointer';
      
      searchBtn.onclick = () => {
        const targetId = input.value.trim();
        if (!targetId) {
          alert('Please enter an element ID');
          return;
        }
        renderDebugContext(targetId);
      };
      
      functionOutput.appendChild(searchBtn);
    }

    async function startEditMode() {
      const file = fileSelect?.value || 'app.js';

      if (currentMode === 'viewFull') {
        await renderViewFullMode(file);
      } else if (currentMode === 'append') {
        await renderAppendMode(file);
      } else if (currentMode === 'editSection') {
        await renderSectionList(file);
      } else {
        await renderFunctionList(file);
      }
    }

    async function renderSectionList(file) {
      functionOutput.innerHTML = '';

      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back - Change Mode';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = renderModeSelector;
      functionOutput.appendChild(backBtn);

      const title = document.createElement('div');
      title.textContent = `Edit Sections: ${file}`;
      title.style.fontWeight = 'bold';
      title.style.margin = '6px 0 12px 0';
      functionOutput.appendChild(title);

      functionBtn.textContent = 'Loading...';
      const text = await getFileText(file);
      const sections = getSectionNames(text);
      functionBtn.textContent = 'Functions';

      if (!sections.length) {
        functionOutput.innerHTML += '<div style="padding:6px 0;">No marked sections found in this file.</div>';
        return;
      }

      sections.forEach((sectionName) => {
        const div = document.createElement('div');
        div.textContent = sectionName.replace(/_/g, ' ');
        div.style.cursor = 'pointer';
        div.style.padding = '6px 0';
        div.style.textDecoration = 'underline';

        div.addEventListener('click', async () => {
          await renderSectionDetail(file, sectionName, text);
        });

        functionOutput.appendChild(div);
      });
    }

    async function renderSectionDetail(file, sectionName, fullText) {
      functionOutput.innerHTML = '';

      const content = extractSectionContent(fullText, sectionName);

      if (!content) {
        functionOutput.innerHTML = 'Could not locate section markers.';
        return;
      }

      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = () => renderSectionList(file);
      functionOutput.appendChild(backBtn);

      const title = document.createElement('div');
      title.textContent = `Section: ${sectionName.replace(/_/g, ' ')} (${file})`;
      title.style.fontWeight = 'bold';
      title.style.margin = '6px 0';
      functionOutput.appendChild(title);

      const modeRow = document.createElement('div');
      modeRow.style.display = 'flex';
      modeRow.style.gap = '8px';
      modeRow.style.marginBottom = '10px';

      let sectionMode = 'replace';

      const replaceBtn = document.createElement('button');
      replaceBtn.textContent = 'Replace Section';
      replaceBtn.style.padding = '8px 12px';
      replaceBtn.style.border = '2px solid #4CAF50';
      replaceBtn.style.borderRadius = '6px';
      replaceBtn.style.background = '#e8f5e9';
      replaceBtn.style.cursor = 'pointer';

      const insertBtn = document.createElement('button');
      insertBtn.textContent = 'Insert After Section';
      insertBtn.style.padding = '8px 12px';
      insertBtn.style.border = '2px solid #ccc';
      insertBtn.style.borderRadius = '6px';
      insertBtn.style.background = 'white';
      insertBtn.style.cursor = 'pointer';

      replaceBtn.onclick = () => {
        sectionMode = 'replace';
        replaceBtn.style.border = '2px solid #4CAF50';
        replaceBtn.style.background = '#e8f5e9';
        insertBtn.style.border = '2px solid #ccc';
        insertBtn.style.background = 'white';
        infoDiv.textContent = 'Replace the entire section with new code.';
      };

      insertBtn.onclick = () => {
        sectionMode = 'insertAfter';
        insertBtn.style.border = '2px solid #4CAF50';
        insertBtn.style.background = '#e8f5e9';
        replaceBtn.style.border = '2px solid #ccc';
        replaceBtn.style.background = 'white';
        infoDiv.textContent = 'New code will be inserted after the section end marker.';
      };

      modeRow.appendChild(replaceBtn);
      modeRow.appendChild(insertBtn);
      functionOutput.appendChild(modeRow);

      const infoDiv = document.createElement('div');
      infoDiv.textContent = 'Replace the entire section with new code.';
      infoDiv.style.padding = '8px';
      infoDiv.style.background = '#fff3cd';
      infoDiv.style.border = '1px solid #ffc107';
      infoDiv.style.borderRadius = '4px';
      infoDiv.style.marginBottom = '10px';
      infoDiv.style.fontSize = '13px';
      functionOutput.appendChild(infoDiv);

      const currentBox = document.createElement('textarea');
      currentBox.value = content;
      currentBox.readOnly = true;
      currentBox.style.width = '100%';
      currentBox.style.minHeight = '150px';
      currentBox.style.marginBottom = '10px';
      currentBox.style.background = '#f5f5f5';
      currentBox.style.fontFamily = 'monospace';
      currentBox.style.fontSize = '12px';
      functionOutput.appendChild(currentBox);

      const replaceBox = document.createElement('textarea');
      replaceBox.value = '';
      replaceBox.placeholder = 'Paste new code here...';
      replaceBox.style.width = '100%';
      replaceBox.style.minHeight = '180px';
      replaceBox.style.marginBottom = '10px';
      replaceBox.style.fontFamily = 'monospace';
      replaceBox.style.fontSize = '12px';
      functionOutput.appendChild(replaceBox);

      const makePatchBtn = document.createElement('button');
      makePatchBtn.textContent = 'Make Patch JSON';
      makePatchBtn.onclick = () => {
        const newCode = replaceBox.value.trim();
        if (!newCode) {
          setResult('Paste code in the box first.');
          return;
        }

        let patch;
        if (sectionMode === 'replace') {
          patch = {
            owner: GH_DEFAULTS.owner,
            repo: GH_DEFAULTS.repo,
            branch: GH_DEFAULTS.branch,
            filePath: file,
            find: content,
            replace: newCode,
            commitMessage: `Tailor: replace section ${sectionName}`
          };
        } else {
          patch = {
            owner: GH_DEFAULTS.owner,
            repo: GH_DEFAULTS.repo,
            branch: GH_DEFAULTS.branch,
            filePath: file,
            find: content,
            replace: content + '\n\n' + newCode,
            commitMessage: `Tailor: insert after section ${sectionName}`
          };
        }

        if (patchArea) patchArea.value = JSON.stringify(patch, null, 2);
        setResult('Patch JSON generated. Press Dry Run to verify.');
      };

      functionOutput.appendChild(makePatchBtn);
    }

    async function renderViewFullMode(file) {
      functionOutput.innerHTML = '';

      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back - Change Mode';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = renderModeSelector;
      functionOutput.appendChild(backBtn);

      const title = document.createElement('div');
      title.textContent = `Full File: ${file}`;
      title.style.fontWeight = 'bold';
      title.style.margin = '6px 0 12px 0';
      functionOutput.appendChild(title);

      functionBtn.textContent = 'Loading...';
      const text = await getFileText(file);
      functionBtn.textContent = 'Functions';

      const editBox = document.createElement('textarea');
      editBox.value = text;
      editBox.style.width = '100%';
      editBox.style.minHeight = '300px';
      editBox.style.fontFamily = 'monospace';
      editBox.style.fontSize = '12px';
      editBox.style.marginBottom = '10px';
      functionOutput.appendChild(editBox);

      const makePatchBtn = document.createElement('button');
      makePatchBtn.textContent = 'Make Patch JSON (Replace Entire File)';
      makePatchBtn.onclick = () => {
        const patch = {
          owner: GH_DEFAULTS.owner,
          repo: GH_DEFAULTS.repo,
          branch: GH_DEFAULTS.branch,
          filePath: file,
          find: text,
          replace: editBox.value,
          commitMessage: `Tailor: edit full file ${file}`
        };
        if (patchArea) patchArea.value = JSON.stringify(patch, null, 2);
        setResult('Patch JSON generated. Press Dry Run to verify.');
      };
      functionOutput.appendChild(makePatchBtn);
    }

    async function renderAppendMode(file) {
      functionOutput.innerHTML = '';

      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back - Change Mode';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = renderModeSelector;
      functionOutput.appendChild(backBtn);

      const title = document.createElement('div');
      title.textContent = `Append to End: ${file}`;
      title.style.fontWeight = 'bold';
      title.style.margin = '6px 0 12px 0';
      functionOutput.appendChild(title);

      functionBtn.textContent = 'Loading...';
      const text = await getFileText(file);
      functionBtn.textContent = 'Functions';

      const newCodeBox = document.createElement('textarea');
      newCodeBox.placeholder = 'Paste new code to append at end of file...';
      newCodeBox.style.width = '100%';
      newCodeBox.style.minHeight = '200px';
      newCodeBox.style.fontFamily = 'monospace';
      newCodeBox.style.marginBottom = '10px';
      functionOutput.appendChild(newCodeBox);

      const makePatchBtn = document.createElement('button');
      makePatchBtn.textContent = 'Make Patch JSON (Append)';
      makePatchBtn.onclick = () => {
        const newCode = newCodeBox.value.trim();
        if (!newCode) {
          setResult('Paste code to append first.');
          return;
        }
        const patch = {
          owner: GH_DEFAULTS.owner,
          repo: GH_DEFAULTS.repo,
          branch: GH_DEFAULTS.branch,
          filePath: file,
          find: text,
          replace: text + '\n\n' + newCode,
          commitMessage: `Tailor: append to ${file}`
        };
        if (patchArea) patchArea.value = JSON.stringify(patch, null, 2);
        setResult('Patch JSON generated. Press Dry Run to verify.');
      };
      functionOutput.appendChild(makePatchBtn);
    }

    async function renderFunctionList(file) {
      functionOutput.innerHTML = '';

      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back - Change Mode';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = renderModeSelector;
      functionOutput.appendChild(backBtn);

      const modeLabel = currentMode === 'replace' ? 'Replace' : 'Insert After';
      const title = document.createElement('div');
      title.textContent = `${modeLabel}: ${file}`;
      title.style.fontWeight = 'bold';
      title.style.margin = '6px 0 12px 0';
      functionOutput.appendChild(title);

      const names = await getFunctionNames(file);

      if (!names.length) {
        functionOutput.innerHTML += '<div style="padding:6px 0;">No functions found.</div>';
        return;
      }

      names.forEach((displayName) => {
        const div = document.createElement('div');
        div.textContent = displayName;
        div.style.cursor = 'pointer';
        div.style.padding = '6px 0';
        div.style.textDecoration = 'underline';

        div.addEventListener('click', async () => {
          await renderFunctionDetail(file, displayName);
        });

        functionOutput.appendChild(div);
      });
    }

    async function renderFunctionDetail(file, displayName) {
      functionOutput.innerHTML = '';

      const text = await getFileText(file);
      const funcName = displayName.replace(/\(\)$/, '');
      const source = extractFunctionSource(text, funcName);

      if (!source) {
        functionOutput.innerHTML = 'Could not locate function.';
        return;
      }

      const backBtn = document.createElement('button');
      backBtn.textContent = 'Back';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = () => renderFunctionList(file);
      functionOutput.appendChild(backBtn);

      const title = document.createElement('div');
      if (currentMode === 'replace') {
        title.textContent = `Replace: ${displayName} (${file})`;
      } else {
        title.textContent = `Insert After: ${displayName} (${file})`;
      }
      title.style.fontWeight = 'bold';
      title.style.margin = '6px 0';
      functionOutput.appendChild(title);

      if (currentMode === 'replace') {
        const currentBox = document.createElement('textarea');
        currentBox.value = source;
        currentBox.readOnly = true;
        currentBox.style.width = '100%';
        currentBox.style.minHeight = '150px';
        currentBox.style.marginBottom = '10px';
        currentBox.style.background = '#f5f5f5';
        functionOutput.appendChild(currentBox);
      } else {
        const info = document.createElement('div');
        info.textContent = `New code will be inserted after this function's closing brace.`;
        info.style.padding = '8px';
        info.style.background = '#fff3cd';
        info.style.border = '1px solid #ffc107';
        info.style.borderRadius = '4px';
        info.style.marginBottom = '10px';
        functionOutput.appendChild(info);
      }

      const replaceBox = document.createElement('textarea');
      replaceBox.value = '';
      replaceBox.placeholder = currentMode === 'replace' 
        ? 'Paste replacement function here...' 
        : 'Paste new function to insert after selected function...';
      replaceBox.style.width = '100%';
      replaceBox.style.minHeight = '180px';
      replaceBox.style.marginBottom = '10px';
      functionOutput.appendChild(replaceBox);

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      btnRow.style.flexWrap = 'wrap';

      if (currentMode === 'replace') {
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy current code';
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(source);
            setResult('Copied current function to clipboard.');
          } catch {
            setResult('Copy failed. Select and copy manually.');
          }
        };
        btnRow.appendChild(copyBtn);
      }

      const makePatchBtn = document.createElement('button');
      makePatchBtn.textContent = 'Make Patch JSON';
      makePatchBtn.onclick = () => {
        const newCode = replaceBox.value.trim();
        if (!newCode) {
          setResult('Paste code in the box first.');
          return;
        }

        let patch;
        if (currentMode === 'replace') {
          patch = {
            owner: GH_DEFAULTS.owner,
            repo: GH_DEFAULTS.repo,
            branch: GH_DEFAULTS.branch,
            filePath: file,
            find: source,
            replace: newCode,
            commitMessage: `Tailor: replace ${funcName}`
          };
        } else {
          patch = {
            owner: GH_DEFAULTS.owner,
            repo: GH_DEFAULTS.repo,
            branch: GH_DEFAULTS.branch,
            filePath: file,
            find: source,
            replace: source + '\n\n' + newCode,
            commitMessage: `Tailor: insert after ${funcName}`
          };
        }

        if (patchArea) patchArea.value = JSON.stringify(patch, null, 2);
        setResult('Patch JSON generated. Press Dry Run to verify.');
      };

      btnRow.appendChild(makePatchBtn);
      functionOutput.appendChild(btnRow);
    }

    let open = false;

    functionBtn.addEventListener('click', async () => {
      try {
        if (open) {
          functionOutput.innerHTML = '';
          functionBtn.textContent = 'Functions';
          open = false;
          return;
        }

        functionBtn.textContent = 'Loading...';
        renderModeSelector();
        functionBtn.textContent = 'Functions';
        open = true;
      } catch (e) {
        functionOutput.innerHTML = '<div style="padding:6px 0;">Error. Is token saved?</div>';
        functionBtn.textContent = 'Functions';
        open = false;
      }
    });

    loadTokenFromLocal();
  }
})();


// Quick Paste Mode test - successfully added!
// This proves the Quick Paste system works!