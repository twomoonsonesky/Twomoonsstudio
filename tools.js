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
    const editBtn = document.getElementById('editModeBtn');
    const menu = document.getElementById('editMenu');
    const layoutOption = document.getElementById('editLayoutOption');
    const codeOption = document.getElementById('editCodeOption');
    const tailorOverlay = document.getElementById('tailorOverlay');

    function closeMenu() {
      menu?.classList.add('hidden');
    }

    editBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      menu?.classList.toggle('hidden');
    });

    layoutOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      window.__TWO_MOONS_LAYOUT_EDITOR__?.toggle?.();
    });

    codeOption?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      if (tailorOverlay) tailorOverlay.style.display = 'flex';
    });

    document.addEventListener('click', closeMenu);
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
      if (typeof ctx.isZoomed === 'function') return !!ctx.isZoomed();
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
  
  // Better zoom detection (check multiple sources!)
  const zoomedNow = isZoomed() || 
                    (typeof window.isCottageZoomed !== 'undefined' && window.isCottageZoomed) ||
                    document.getElementById('cottage-zoomed')?.classList.contains('active');

  editables.forEach((element) => {
    const view = element.dataset.editView; // "normal" or "zoomed"

    // Hide edit-mode on elements not relevant to current view
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

      // one finger drag
      if (e.touches.length === 1) {
        e.preventDefault();
        dragElement = e.target.closest('.editable-element');
        if (!dragElement) return;

        const touch = e.touches[0];
        const rect = dragElement.getBoundingClientRect();

        dragOffsetX = touch.clientX - rect.left;
        dragOffsetY = touch.clientY - rect.top;
      }

      // two finger pinch resize
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

      // drag
      if (dragElement && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        const containerRect = container.getBoundingClientRect();

        let newLeft = touch.clientX - containerRect.left - dragOffsetX;
        let newTop = touch.clientY - containerRect.top - dragOffsetY;

        const elementWidth = dragElement.offsetWidth;
        const elementHeight = dragElement.offsetHeight;

        // Keep within container bounds
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

      // pinch resize
      if (resizeElement && e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const scale = currentDistance / initialDistance;
        let newSize = initialSize * scale;

        newSize = Math.max(50, Math.min(container.clientWidth * 0.95, newSize));

        resizeElement.style.width = `${newSize}px`;

        // orbs: square
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

      const orientationIcon =
        (typeof ctx.getOrientationMeta === 'function')
          ? ctx.getOrientationMeta().orientationIcon
          : (window.innerWidth > window.innerHeight ? 'Ã°ÂÂÂ¥Ã¯Â¸Â' : 'Ã°ÂÂÂ±');

      const orientationName =
        (typeof ctx.getOrientationMeta === 'function')
          ? ctx.getOrientationMeta().orientationName
          : (window.innerWidth > window.innerHeight ? 'Landscape' : 'Portrait');

      const viewIcon = zoomedNow ? 'Ã°ÂÂÂ' : 'Ã°ÂÂÂ ';
      const viewName = zoomedNow ? 'Zoomed' : 'Normal';

      const currentViewElements = Array.from(document.querySelectorAll('.editable-element.edit-mode'));

      let html = `
        <div style="text-align:center; margin-bottom: 15px;">
          <strong style="font-size: 16px;">Visual Editor</strong><br>
          <div style="background: rgba(180, 140, 255, 0.15); padding: 10px; border-radius: 8px; margin: 10px 0;">
            ${orientationIcon} ${orientationName} Ã¢ÂÂ¢ ${viewIcon} ${viewName}
          </div>
          <em style="font-size: 12px;">Drag to move Ã¢ÂÂ¢ Pinch to resize</em>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:15px;">
          <button id="__tm_save_btn" style="flex:1; padding:12px; background: rgba(100, 200, 100, 0.9); color:white; border:none; border-radius: 8px; font-size:14px; cursor:pointer; font-weight:bold;">Ã°ÂÂÂ¾ Save</button>
          <button id="__tm_close_btn" style="flex:1; padding:12px; background: rgba(150, 150, 150, 0.9); color:white; border:none; border-radius: 8px; font-size:14px; cursor:pointer; font-weight:bold;">Ã¢ÂÂ Close</button>
        </div>

        <div style="font-size: 12px; line-height: 1.8; color: #555;">
      `;

      currentViewElements.forEach((el) => {
        const name = el.dataset.editName || el.id;
        const icon = el.dataset.editIcon || 'Ã°ÂÂÂ¦';
        const config = layout[el.id];
        if (!config) return;

        html += `<strong>${icon} ${name}</strong><br>`;
        html += `Position: ${Number(config.left).toFixed(1)}%, ${Number(config.top).toFixed(1)}%<br>`;
        if (config.size !== undefined) html += `Size: ${Number(config.size).toFixed(1)}%<br><br>`;
        else html += `Width: ${Number(config.width).toFixed(1)}%<br><br>`;
      });

      html += `</div>`;

      layoutInfo.querySelector('.layout-info-content').innerHTML = html;

      // wire buttons
      const saveBtn = document.getElementById('__tm_save_btn');
      const closeBtn = document.getElementById('__tm_close_btn');

      saveBtn?.addEventListener('click', async () => {
        try {
          await saveLayoutToFirebase();
          alert('Ã¢ÂÂ Layout saved!');
        } catch (e) {
          alert('Ã¢ÂÂ Could not save: ' + (e?.message || e));
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

    if (!overlay || !result) return;

    // Single source of truth for Function Finder defaults
    const GH_DEFAULTS = {
      owner: "twomoonsonesky",
      repo: "Twomoonsstudio",
      branch: "main",
    };

    const STORAGE_KEY = 'TWO_MOONS_TAILOR_TOKEN';

    function setResult(text) {
  const now = new Date();
  const time = now.toLocaleTimeString();
  result.textContent = `[${time}] ${text}`;
}

    function loadTokenFromLocal() {
      const t = localStorage.getItem(STORAGE_KEY);
      if (t) {
        status && (status.textContent = 'Ã¢ÂÂ Token saved on this iPad');
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

    // Encode each segment but keep slashes
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
      const decoded = atob(data.content.replace(/\n/g, ''));
      return { decoded, sha: data.sha };
    }

    function normalizeNewlines(s) {
      return String(s).replace(/\r\n/g, '\n');
    }

    function applyReplace(sourceText, find, replace) {
      // Normalize line endings to reduce false "not found"
      const S = normalizeNewlines(sourceText);
      const F = normalizeNewlines(find);
      const R = normalizeNewlines(replace);

      const count = S.split(F).length - 1;
      if (count <= 0) return { updated: sourceText, count: 0 };

      // Return updated text in normalized newline form (GitHub stores LF fine)
      return { updated: S.split(F).join(R), count };
    }

    async function putFileContent(token, owner, repo, path, branch, message, newText, sha) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${ghPath(path)}`;
      const body = {
        message,
        content: btoa(unescape(encodeURIComponent(String(newText)))),
        sha,
        branch
      };
      return ghRequest(token, url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    // Close overlay
    closeBtn?.addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // Token buttons
    saveTokenBtn?.addEventListener('click', () => {
      const t = (tokenInput?.value || '').trim();
      if (!t) {
        status && (status.textContent = 'Paste token first.');
        return;
      }
      localStorage.setItem(STORAGE_KEY, t);
      status && (status.textContent = 'Ã¢ÂÂ Token saved on this iPad');
      setResult('Token saved.');
    });

    clearTokenBtn?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      if (tokenInput) tokenInput.value = '';
      status && (status.textContent = 'Token cleared.');
      setResult('Token cleared.');
    });

    // Patch buttons
    dryRunBtn?.addEventListener('click', async () => {
      try {
        setResult('Dry runÃ¢ÂÂ¦');
        const token = requireToken();
        const patch = parsePatch();

        const { decoded } = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);
        const { count } = applyReplace(decoded, patch.find, patch.replace);

        if (count === 0) {
          setResult(`Ã¢ÂÂ Dry Run: find-text not found in ${patch.filePath}\n\nTip: generate the find-text from GitHub (Function Finder now does).`);
          return;
        }

        setResult(`Ã¢ÂÂ Dry Run OK\nFile: ${patch.filePath}\nReplacements: ${count}\n\n(No commit made.)`);
      } catch (e) {
        setResult('Ã¢ÂÂ ' + (e?.message || e));
      }
    });

    // Ã¢ÂÂ COMMIT: double-fetch sha + no-op detection
	    // Prevent duplicate listeners (stops 409 errors!)
    if (commitBtn && commitBtn.__tailor_listener_added__) {
      setResult('Already processing...');
      return;
    }
    if (commitBtn) commitBtn.__tailor_listener_added__ = true;

    commitBtn?.addEventListener('click', async () => {
      try {
        setResult('Committing patchÃ¢ÂÂ¦');
        const token = requireToken();
        const patch = parsePatch();

        // 1) Get current content
        const before = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);

        // 2) Apply replace
        const { updated, count } = applyReplace(before.decoded, patch.find, patch.replace);

        if (count === 0) {
          setResult(`Ã¢ÂÂ Commit blocked: find-text not found in ${patch.filePath}`);
          return;
        }

        // 3) Fetch again RIGHT before PUT (proof/guard against sha mismatch)
        const latest = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);

        // 4) If nothing changes, don't commit
        const same = normalizeNewlines(latest.decoded) === normalizeNewlines(updated);
        if (same) {
          setResult(`Ã¢ÂÂ¹Ã¯Â¸Â No changes to commit.\nFile: ${patch.filePath}\n(Replacement produced identical content.)`);
          return;
        }

        // 5) PUT using latest sha
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

        setResult(`Ã¢ÂÂ Patch committed!\nFile: ${patch.filePath}\nReplacements: ${count}\n\nRefresh your page to load the new code.`);
      } catch (e) {
        setResult('Ã¢ÂÂ ' + (e?.message || e));
      }
    });

    // ---------- Function viewer ----------
    if (!functionOutput || !functionBtn) {
      loadTokenFromLocal();
      return;
    }

    // Reads from GitHub (same source as patcher)
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

      // function name(
      for (const m of text.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)) {
        names.add(m[1] + '()');
      }

      // const name = function(
      for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?function\s*\(/g)) {
        names.add(m[1] + '()');
      }

      // const name = (...) =>   OR const name = async (...) =>
      for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)) {
        names.add(m[1] + '()');
      }

      // const name = (   OR const name = async (   (covers some patterns)
      for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/g)) {
        names.add(m[1] + '()');
      }

      return [...names].sort();
    }

    function extractFunctionSource(text, funcName) {
  // Escape function name for regex safety
  const name = String(funcName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match common function-start forms:
  // 1) function name(...) OR async function name(...)
  // 2) const name = (...) => OR const name = async (...) =>
  // 3) const name = function(...) OR const name = async function(...)
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

  // Brace matching while ignoring strings/comments
  let depth = 0;
  let inS = false, inD = false, inT = false;     // ', ", `
  let inLine = false, inBlock = false;           // //, /* */
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


    async function renderFunctionList(file) {
      functionOutput.innerHTML = '';
      const names = await getFunctionNames(file);

      if (!names.length) {
        functionOutput.innerHTML = '<div style="padding:6px 0;">No functions found.</div>';
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

      // Back
      const backBtn = document.createElement('button');
      backBtn.textContent = 'Ã¢ÂÂ Back';
      backBtn.style.marginBottom = '10px';
      backBtn.onclick = () => renderFunctionList(file);
      functionOutput.appendChild(backBtn);

      // Title
      const title = document.createElement('div');
      title.textContent = `${displayName} Ã¢ÂÂ (${file})`;
      title.style.fontWeight = 'bold';
      title.style.margin = '6px 0';
      functionOutput.appendChild(title);

      // Current (readonly)
      const currentBox = document.createElement('textarea');
      currentBox.value = source;
      currentBox.readOnly = true;
      currentBox.style.width = '100%';
      currentBox.style.minHeight = '150px';
      currentBox.style.marginBottom = '10px';
      functionOutput.appendChild(currentBox);

      // Replacement (blank by default)
      const replaceBox = document.createElement('textarea');
      replaceBox.value = '';
      replaceBox.placeholder = 'Paste your replacement function block hereÃ¢ÂÂ¦';
      replaceBox.style.width = '100%';
      replaceBox.style.minHeight = '180px';
      replaceBox.style.marginBottom = '10px';
      functionOutput.appendChild(replaceBox);

      // Buttons row
      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      btnRow.style.flexWrap = 'wrap';

      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy current code';
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(currentBox.value);
          setResult('Ã¢ÂÂ Copied current function to clipboard.');
        } catch {
          setResult('Ã¢ÂÂ Ã¯Â¸Â Copy failed (iOS sometimes blocks clipboard). You can still select+copy manually.');
        }
      };

      const makePatchBtn = document.createElement('button');
      makePatchBtn.textContent = 'Make Patch JSON';
      makePatchBtn.onclick = () => {
        const replacement = replaceBox.value.trim();
        if (!replacement) {
          setResult('Ã¢ÂÂ Paste replacement code into the second box first.');
          return;
        }
        const patch = {
          owner: GH_DEFAULTS.owner,
          repo: GH_DEFAULTS.repo,
          branch: GH_DEFAULTS.branch,
          filePath: file,
          find: currentBox.value,
          replace: replacement,
          commitMessage: `Tailor patch: update ${funcName}`
        };
        if (patchArea) patchArea.value = JSON.stringify(patch, null, 2);
        setResult('Ã¢ÂÂ Patch JSON generated below. Now press Dry Run.');
      };

      btnRow.appendChild(copyBtn);
      btnRow.appendChild(makePatchBtn);
      functionOutput.appendChild(btnRow);
    }

    let open = false;

    functionBtn.addEventListener('click', async () => {
      try {
        const file = fileSelect?.value || 'app.js';

        if (open) {
          functionOutput.innerHTML = '';
          functionBtn.textContent = 'Functions Ã¢ÂÂ¾';
          open = false;
          return;
        }

        functionBtn.textContent = 'LoadingÃ¢ÂÂ¦';
        await renderFunctionList(file);
        functionBtn.textContent = 'Functions Ã¢ÂÂ´';
        open = true;
      } catch (e) {
        functionOutput.innerHTML = '<div style="padding:6px 0;">Error loading file. (Is token saved?)</div>';
        functionBtn.textContent = 'Functions Ã¢ÂÂ¾';
        open = false;
      }
    });

    // initial state
    loadTokenFromLocal();
  }
})();