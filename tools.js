// tools.js
// Two Moons Toolbelt
// - Edit menu controller
// - Layout editor (drag + pinch resize)  ✅ restored
// - Tailor (patcher + function viewer + editable replacement UI)

window.initTwoMoonsTools = function initTwoMoonsTools(ctx) {
  initEditMenu(ctx);
  initLayoutEditor(ctx);
  initTailor(ctx);
};

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
    window.__TWO_MOONS_LAYOUT_EDITOR__?.toggle();
  });

  codeOption?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();
    if (tailorOverlay) tailorOverlay.style.display = 'flex';
  });

  document.addEventListener('click', closeMenu);
}

// ------------------------------------------------------------
// Layout Editor (FULL engine restored)
// ------------------------------------------------------------
function initLayoutEditor(ctx) {
  const grid = document.getElementById('grid-overlay');
  const layoutInfo = document.getElementById('layoutInfo');
  const editBtn = document.getElementById('editModeBtn');

  let isEditMode = false;

  // touch drag/resize state
  let dragElement = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  let resizeElement = null;
  let initialSize = 0;
  let initialDistance = 0;

  function getIsZoomed() {
    if (typeof ctx?.isCottageZoomed === 'function') return !!ctx.isCottageZoomed();
    // fallback: infer from DOM
    const z = document.getElementById('cottage-zoomed');
    return z && !z.classList.contains('hidden');
  }

  function getCurrentLayout() {
    if (typeof ctx?.getCurrentLayout === 'function') return ctx.getCurrentLayout();
    // fallback to global if you ever exposed it
    if (typeof window.getCurrentLayout === 'function') return window.getCurrentLayout();
    return null;
  }

  function syncLightsFor(id) {
    if (typeof ctx?.syncLights === 'function') ctx.syncLights(id);
    else if (typeof window.syncLights === 'function') window.syncLights(id);
  }

  function applyLayout() {
    if (typeof ctx?.applyLayout === 'function') ctx.applyLayout();
    else if (typeof window.applyLayout === 'function') window.applyLayout();
  }

  function makeElementsEditable() {
    const editables = document.querySelectorAll('.editable-element');

    editables.forEach(element => {
      const view = element.dataset.editView;
      const zoomed = getIsZoomed();

      // Respect view rules (same as your original logic)
      if (view === 'zoomed' && !zoomed) {
        element.classList.remove('edit-mode');
        return;
      }
      if (view === 'normal' && zoomed && element.classList.contains('cottage-element')) {
        element.classList.remove('edit-mode');
        return;
      }

      element.classList.add('edit-mode');

      element.removeEventListener('touchstart', onDragStart);
      element.removeEventListener('touchmove', onDragMove);
      element.removeEventListener('touchend', onDragEnd);

      element.addEventListener('touchstart', onDragStart, { passive: false });
      element.addEventListener('touchmove', onDragMove, { passive: false });
      element.addEventListener('touchend', onDragEnd);
    });
  }

  function removeEditListeners() {
    const editables = document.querySelectorAll('.editable-element');
    editables.forEach(element => {
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

    } else if (e.touches.length === 2) {
      e.preventDefault();
      resizeElement = e.target.closest('.editable-element');
      if (!resizeElement) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const rect = resizeElement.getBoundingClientRect();
      initialSize = rect.width;
    }
  }

  function onDragMove(e) {
    if (!isEditMode) return;

    const container = document.getElementById('landing-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    if (dragElement && e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];

      let newLeft = touch.clientX - containerRect.left - dragOffsetX;
      let newTop = touch.clientY - containerRect.top - dragOffsetY;

      const elementWidth = dragElement.offsetWidth;
      const elementHeight = dragElement.offsetHeight;

      newLeft = Math.max(0, Math.min(containerRect.width - elementWidth, newLeft));
      newTop = Math.max(0, Math.min(containerRect.height - elementHeight, newTop));

      dragElement.style.left = `${newLeft}px`;
      dragElement.style.top = `${newTop}px`;

      if (dragElement.id === 'cottage-small' || dragElement.id === 'cottage-zoomed') {
        syncLightsFor(dragElement.id);
      }

      updateLayoutInfo();

    } else if (resizeElement && e.touches.length === 2) {
      e.preventDefault();

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

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
        syncLightsFor(resizeElement.id);
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
    const container = document.getElementById('landing-container');
    if (!layout || !container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const left = ((rect.left - containerRect.left) / containerWidth) * 100;
    const top = ((rect.top - containerRect.top) / containerHeight) * 100;
    const width = (rect.width / containerWidth) * 100;

    if (element.classList.contains('orb-element')) {
      layout[element.id] = { left, top, size: width };
    } else {
      layout[element.id] = { left, top, width };
    }
  }

  function updateLayoutInfo() {
    const layout = getCurrentLayout();
    if (!layoutInfo || !layoutInfo.querySelector('.layout-info-content') || !layout) return;

    const orientationName =
      (typeof ctx?.currentOrientation === 'function' ? ctx.currentOrientation() : null) ||
      (window.innerWidth > window.innerHeight ? 'Landscape' : 'Portrait');

    const viewName = getIsZoomed() ? 'Zoomed' : 'Normal';

    const currentViewElements = Array.from(document.querySelectorAll('.editable-element.edit-mode'));

    let html = `
      <div style="text-align: center; margin-bottom: 15px;">
        <strong style="font-size: 16px;">Visual Editor</strong><br>
        <div style="background: rgba(180, 140, 255, 0.15); padding: 10px; border-radius: 8px; margin: 10px 0;">
          ${orientationName} • ${viewName}
        </div>
        <em style="font-size: 12px;">Drag to move • Pinch to resize</em>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 15px;">
        <button onclick="saveLayout()" style="flex: 1; padding: 12px; background: rgba(100, 200, 100, 0.9); color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold;">💾 Save</button>
        <button onclick="closeWithoutSaving()" style="flex: 1; padding: 12px; background: rgba(150, 150, 150, 0.9); color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; font-weight: bold;">✕ Close</button>
      </div>

      <div style="font-size: 12px; line-height: 1.8; color: #555;">
    `;

    currentViewElements.forEach(el => {
      const name = el.dataset.editName || el.id;
      const icon = el.dataset.editIcon || '📦';
      const config = layout[el.id];

      if (config) {
        html += `<strong>${icon} ${name}</strong><br>`;
        html += `Position: ${config.left.toFixed(1)}%, ${config.top.toFixed(1)}%<br>`;
        if (config.size) html += `Size: ${config.size.toFixed(1)}%<br><br>`;
        else html += `Width: ${config.width.toFixed(1)}%<br><br>`;
      }
    });

    html += `</div>`;
    layoutInfo.querySelector('.layout-info-content').innerHTML = html;
  }

  async function saveLayout() {
    try {
      if (typeof ctx?.saveLayoutToFirebase === 'function') {
        await ctx.saveLayoutToFirebase();
        alert('✅ Layout saved to Firebase!');
      } else {
        alert('⚠️ saveLayoutToFirebase() not wired yet, but positions are updated in memory.');
      }
    } catch (e) {
      alert('❌ Could not save layout: ' + (e?.message || e));
    }
    exitEditMode();
    isEditMode = false;
  }
  window.saveLayout = saveLayout;

  function closeWithoutSaving() {
    applyLayout();
    exitEditMode();
    isEditMode = false;
  }
  window.closeWithoutSaving = closeWithoutSaving;

  function enterEditMode() {
    isEditMode = true;
    editBtn?.classList.add('active');
    if (editBtn) editBtn.textContent = 'Editing...';
    grid?.classList.remove('hidden');
    layoutInfo?.classList.remove('hidden');

    updateLayoutInfo();
    makeElementsEditable();
  }

  function exitEditMode() {
    isEditMode = false;
    editBtn?.classList.remove('active');
    if (editBtn) editBtn.textContent = 'Edit';
    grid?.classList.add('hidden');
    layoutInfo?.classList.add('hidden');
    removeEditListeners();
  }

  function toggle() {
    isEditMode ? exitEditMode() : enterEditMode();
  }

  window.__TWO_MOONS_LAYOUT_EDITOR__ = { toggle };
}

// ------------------------------------------------------------
// Tailor System (your current version)
// ------------------------------------------------------------
function initTailor(ctx) {

  const functionOutput = document.getElementById('tailor-output');
  const fileSelect = document.getElementById('tailor-file');
  const functionBtn = document.getElementById('tailor-go');
  const patchArea = document.getElementById('tailorPatch');

  // Patch buttons + result area (needed so Dry Run / Commit actually do something)
  const dryRunBtn = document.getElementById('tailorDryRunBtn');
  const commitBtn = document.getElementById('tailorCommitBtn');
  const result = document.getElementById('tailorResult');

  const tokenInput = document.getElementById('tailorToken');

  if (!functionOutput) return;

  const STORAGE_KEY = 'TWO_MOONS_TAILOR_TOKEN';

  function setResult(text) {
    if (result) result.textContent = text;
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
    catch { throw new Error('Patch JSON is not valid JSON.'); }

    const required = ['owner', 'repo', 'branch', 'filePath', 'find', 'replace', 'commitMessage'];
    for (const k of required) {
      if (!obj[k] || typeof obj[k] !== 'string') throw new Error(`Patch missing "${k}" (must be a string).`);
    }
    return obj;
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
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(refName)}`;
    const data = await ghRequest(token, url);
    if (!data.content) throw new Error('GitHub did not return file content. Is filePath correct?');
    const decoded = atob(data.content.replace(/\n/g, ''));
    return { decoded, sha: data.sha };
  }

  function applyReplace(sourceText, find, replace) {
    const count = sourceText.split(find).length - 1;
    if (count <= 0) return { updated: sourceText, count: 0 };
    return { updated: sourceText.split(find).join(replace), count };
  }

  async function putFileContent(token, owner, repo, path, branch, message, newText, sha) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(newText))),
      sha,
      branch
    };
    return ghRequest(token, url, { method: 'PUT', body: JSON.stringify(body) });
  }

  // ---------- Load file text ----------
  async function getFileText(file) {
    const res = await fetch(file, { cache: 'no-store' });
    return await res.text();
  }

  // ---------- Extract function names ----------
  async function getFunctionNames(file) {
    const text = await getFileText(file);
    const names = new Set();

    for (const m of text.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)) {
      names.add(m[1] + '()');
    }
    for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/g)) {
      names.add(m[1] + '()');
    }
    return [...names].sort();
  }

  // ---------- Extract full function block ----------
  function extractFunctionSource(text, funcName) {
    const regex = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'm');
    const match = text.match(regex);
    if (!match) return null;

    const startIndex = match.index;
    const braceIndex = text.indexOf('{', startIndex);

    let depth = 0;
    for (let i = braceIndex; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
    return null;
  }

  // ---------- Render function list ----------
  async function renderFunctionList(file) {
    functionOutput.innerHTML = '';
    const names = await getFunctionNames(file);

    names.forEach(displayName => {
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

  // ---------- Render function detail with editable replacement ----------
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
    backBtn.textContent = '← Back';
    backBtn.style.marginBottom = '10px';
    backBtn.onclick = () => renderFunctionList(file);
    functionOutput.appendChild(backBtn);

    // Title
    const title = document.createElement('div');
    title.textContent = `${displayName} — (${file})`;
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

    // Replacement (blank)
    const replaceBox = document.createElement('textarea');
    replaceBox.value = '';
    replaceBox.placeholder = 'Paste your replacement function block here…';
    replaceBox.style.width = '100%';
    replaceBox.style.minHeight = '180px';
    replaceBox.style.marginBottom = '10px';
    functionOutput.appendChild(replaceBox);

    // Copy current
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy current code';
    copyBtn.style.marginRight = '8px';
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(currentBox.value);
        setResult('✅ Copied current function to clipboard.');
      } catch {
        setResult('⚠️ Copy failed (iOS sometimes blocks clipboard). You can still select+copy manually.');
      }
    };

    // Make Patch JSON
    const makePatchBtn = document.createElement('button');
    makePatchBtn.textContent = 'Make Patch JSON';
    makePatchBtn.onclick = () => {
      const replacement = replaceBox.value.trim();
      if (!replacement) {
        setResult('❌ Paste replacement code into the second box first.');
        return;
      }
      const patch = {
        owner: "twomoonsonesky",
        repo: "Twomoonsstudio",
        branch: "main",
        filePath: file,
        find: currentBox.value,
        replace: replacement,
        commitMessage: `Tailor patch: update ${funcName}`
      };
      if (patchArea) patchArea.value = JSON.stringify(patch, null, 2);
      setResult('✅ Patch JSON generated. Now press Dry Run.');
    };

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(makePatchBtn);
    functionOutput.appendChild(btnRow);
  }

  // ---------- Button to toggle list ----------
  let open = false;

  functionBtn?.addEventListener('click', async () => {
    const file = fileSelect?.value || 'app.js';
    if (open) {
      functionOutput.innerHTML = '';
      functionBtn.textContent = 'Functions ▾';
      open = false;
    } else {
      await renderFunctionList(file);
      functionBtn.textContent = 'Functions ▴';
      open = true;
    }
  });

  // ---------- Hook up Dry Run / Commit ----------
  dryRunBtn?.addEventListener('click', async () => {
    try {
      setResult('Dry run…');
      const token = requireToken();
      const patch = parsePatch();

      const { decoded } = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);
      const { updated, count } = applyReplace(decoded, patch.find, patch.replace);

      if (count === 0) {
        setResult(`❌ Dry Run: find-text not found in ${patch.filePath}\n\nTip: use Copy current code and don’t edit the find block.`);
        return;
      }
      setResult(`✅ Dry Run OK\nFile: ${patch.filePath}\nReplacements: ${count}\n\n(No commit made.)`);
    } catch (e) {
      setResult('❌ ' + (e?.message || e));
    }
  });

  commitBtn?.addEventListener('click', async () => {
    try {
      setResult('Committing patch…');
      const token = requireToken();
      const patch = parsePatch();

      const { decoded, sha } = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);
      const { updated, count } = applyReplace(decoded, patch.find, patch.replace);

      if (count === 0) {
        setResult(`❌ Commit blocked: find-text not found in ${patch.filePath}`);
        return;
      }

      await putFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch, patch.commitMessage, updated, sha);
      setResult(`✅ Patch committed!\nFile: ${patch.filePath}\nReplacements: ${count}\n\nRefresh to load new code.`);
    } catch (e) {
      setResult('❌ ' + (e?.message || e));
    }
  });

  setResult('Ready.');
}