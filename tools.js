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
    const editBtn = document.getElementById('editModeBtn');
    const container = document.getElementById('landing-container');

    if (!editBtn || !container) return;

    const getCurrentLayout = () =>
      (typeof ctx.getCurrentLayout === 'function')
        ? ctx.getCurrentLayout()
        : (window.getCurrentLayout ? window.getCurrentLayout() : null);

    const applyLayout = () => {
      if (typeof ctx.applyLayout === 'function') return ctx.applyLayout();
      if (typeof window.applyLayout === 'function') return window.applyLayout();
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
      isEditMode = true;

      editBtn.classList.add('active');
      editBtn.textContent = 'Editing...';

      grid?.classList.remove('hidden');
      layoutInfo?.classList.remove('hidden');

      updateLayoutInfo();
      makeElementsEditable();
    }

    function exitEditMode() {
      isEditMode = false;

      editBtn.classList.remove('active');
      editBtn.textContent = 'Edit';

      grid?.classList.add('hidden');
      layoutInfo?.classList.add('hidden');

      removeEditListeners();
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
      branch: "main",
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
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${ghPath(path)}?ref=${encodeURIComponent(refName)}`;
      const data = await ghRequest(token, url);
      if (!data.content) throw new Error('GitHub did not return file content. Is filePath correct?');
      
      const content = data.content.replace(/\n/g, '');
      const bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      
      return { decoded, sha: data.sha };
    }

    function normalizeNewlines(s) {
      return String(s).replace(/\r\n/g, '\n');
    }

    function applyReplace(sourceText, find, replace) {
      const S = normalizeNewlines(sourceText);
      const F = normalizeNewlines(find);
      const R = normalizeNewlines(replace);

      const count = S.split(F).length - 1;
      if (count <= 0) return { updated: sourceText, count: 0 };

      return { updated: S.split(F).join(R), count };
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
      const token = requireToken();
      const { decoded } = await getFileContent(
        token,
        GH_DEFAULTS.owner,
        GH_DEFAULTS.repo,
        file,
        GH_DEFAULTS.branch
      );
      return decoded;
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
        { id: 'debugContext', label: '[DEBUG] Code Explorer', desc: 'Find all code related to an element', showFor: 'all' }
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
          } else {
            startEditMode();
          }
        };

        functionOutput.appendChild(btn);
      });
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
