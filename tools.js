// tools.js
// Two Moons Toolbelt
// - Edit menu controller
// - Layout editor (placeholder toggle)
// - Tailor (GitHub patcher + function finder + editable replacement UI)

window.initTwoMoonsTools = function initTwoMoonsTools(ctx = {}) {
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
// Layout Editor (minimal placeholder; your real logic may live elsewhere)
// ------------------------------------------------------------
function initLayoutEditor(ctx) {
  const grid = document.getElementById('grid-overlay');
  const layoutInfo = document.getElementById('layoutInfo');
  const editBtn = document.getElementById('editModeBtn');

  let isEditMode = false;

  function enterEditMode() {
    isEditMode = true;
    if (editBtn) editBtn.textContent = 'Editing...';
    grid?.classList.remove('hidden');
    layoutInfo?.classList.remove('hidden');
  }

  function exitEditMode() {
    isEditMode = false;
    if (editBtn) editBtn.textContent = 'Edit';
    grid?.classList.add('hidden');
    layoutInfo?.classList.add('hidden');
  }

  function toggle() {
    isEditMode ? exitEditMode() : enterEditMode();
  }

  window.__TWO_MOONS_LAYOUT_EDITOR__ = { toggle };
}

// ------------------------------------------------------------
// Tailor System (PATCHER + FUNCTION FINDER)
// ------------------------------------------------------------
function initTailor(ctx) {
  // Overlay + controls
  const overlay = document.getElementById('tailorOverlay');
  const closeBtn = document.getElementById('tailorCloseBtn');

  const tokenInput = document.getElementById('tailorToken');
  const saveTokenBtn = document.getElementById('tailorSaveTokenBtn');
  const clearTokenBtn = document.getElementById('tailorClearTokenBtn');
  const status = document.getElementById('tailorTokenStatus');

  const patchArea = document.getElementById('tailorPatch');
  const dryRunBtn = document.getElementById('tailorDryRunBtn');
  const commitBtn = document.getElementById('tailorCommitBtn');
  const resultBox = document.getElementById('tailorResult');

  // Function finder UI
  const functionOutput = document.getElementById('tailor-output');
  const fileSelect = document.getElementById('tailor-file');
  const functionBtn = document.getElementById('tailor-go');

  if (!overlay || !patchArea || !resultBox) return;

  // ---------- helpers ----------
  const STORAGE_KEY = 'TWO_MOONS_TAILOR_TOKEN';

  function setResult(text) {
    resultBox.textContent = String(text ?? '');
  }

  function loadTokenFromLocal() {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t) {
      if (status) status.textContent = '✅ Token saved on this iPad';
      if (tokenInput) tokenInput.value = t;
    } else {
      if (status) status.textContent = 'No token saved yet.';
      if (tokenInput) tokenInput.value = '';
    }
  }

  function requireToken() {
    const t = (tokenInput?.value || '').trim();
    if (!t) throw new Error('No token. Paste token, press Save Token.');
    return t;
  }

  function parsePatch() {
    const raw = (patchArea.value || '').trim();
    if (!raw) throw new Error('Paste a patch JSON first.');
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error('Patch JSON is not valid JSON. (Missing comma / bracket).');
    }

    const required = ['owner', 'repo', 'branch', 'filePath', 'find', 'replace', 'commitMessage'];
    for (const k of required) {
      if (!obj[k] || typeof obj[k] !== 'string') {
        throw new Error(`Patch missing "${k}" (must be a string).`);
      }
    }
    return obj;
  }

  async function ghRequest(token, url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async function getFileContent(token, owner, repo, path, refName) {
    const url =
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}` +
      `?ref=${encodeURIComponent(refName)}`;

    const data = await ghRequest(token, url);
    if (!data.content) throw new Error('GitHub did not return file content. Is filePath correct?');

    const decoded = atob(String(data.content).replace(/\n/g, ''));
    return { decoded, sha: data.sha };
  }

  function applyReplace(sourceText, find, replace) {
    const count = sourceText.split(find).length - 1;
    if (count <= 0) return { updated: sourceText, count: 0 };
    return { updated: sourceText.split(find).join(replace), count };
  }

  function b64utf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function putFileContent(token, owner, repo, path, branch, message, newText, sha) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const body = {
      message,
      content: b64utf8(newText),
      sha,
      branch,
    };

    return ghRequest(token, url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // ---------- overlay close ----------
  closeBtn?.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });

  // ---------- token buttons ----------
  saveTokenBtn?.addEventListener('click', () => {
    const t = (tokenInput?.value || '').trim();
    if (!t) {
      if (status) status.textContent = 'Paste token first.';
      return;
    }
    localStorage.setItem(STORAGE_KEY, t);
    if (status) status.textContent = '✅ Token saved on this iPad';
    setResult('Token saved.');
  });

  clearTokenBtn?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    if (tokenInput) tokenInput.value = '';
    if (status) status.textContent = 'Token cleared.';
    setResult('Token cleared.');
  });

  // ---------- dry run ----------
  dryRunBtn?.addEventListener('click', async () => {
    try {
      setResult('Dry run…');
      const token = requireToken();
      const patch = parsePatch();

      const { decoded } = await getFileContent(token, patch.owner, patch.repo, patch.filePath, patch.branch);
      const { updated, count } = applyReplace(decoded, patch.find, patch.replace);

      if (count === 0) {
        setResult(
          `❌ Dry Run: find-text not found in ${patch.filePath}\n\nTip: Make sure "find" matches the current code EXACTLY.`
        );
        return;
      }

      setResult(`✅ Dry Run OK\nFile: ${patch.filePath}\nReplacements: ${count}\n\n(No commit made.)`);
    } catch (e) {
      setResult('❌ ' + (e?.message || e));
    }
  });

  // ---------- commit ----------
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

      await putFileContent(
        token,
        patch.owner,
        patch.repo,
        patch.filePath,
        patch.branch,
        patch.commitMessage,
        updated,
        sha
      );

      setResult(`✅ Patch committed!\nFile: ${patch.filePath}\nReplacements: ${count}\n\nRefresh your page to load the new code.`);
    } catch (e) {
      setResult('❌ ' + (e?.message || e));
    }
  });

  // ------------------------------------------------------------
  // Function Finder
  // ------------------------------------------------------------
  if (!functionOutput) {
    loadTokenFromLocal();
    setResult('Ready.');
    return;
  }

  async function getFileText(file) {
    const res = await fetch(file, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not fetch ${file} (HTTP ${res.status})`);
    return await res.text();
  }

  async function getFunctionNames(file) {
    const text = await getFileText(file);
    const names = new Set();

    // function name(...) {
    for (const m of text.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)) {
      names.add(m[1] + '()');
    }

    // const name = ( ... ) OR const name = async ( ... )
    for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/g)) {
      names.add(m[1] + '()');
    }

    return [...names].sort();
  }

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

    // Replacement (blank by default – this fixes your “two same boxes” pain)
    const replaceBox = document.createElement('textarea');
    replaceBox.value = '';
    replaceBox.placeholder = 'Paste your replacement function block here…';
    replaceBox.style.width = '100%';
    replaceBox.style.minHeight = '180px';
    replaceBox.style.marginBottom = '10px';
    functionOutput.appendChild(replaceBox);

    // Copy current code button (brings back your missing copy button)
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
      patchArea.value = JSON.stringify(patch, null, 2);
      setResult('✅ Patch JSON generated below. Now press Dry Run.');
    };

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(makePatchBtn);
    functionOutput.appendChild(btnRow);
  }

  // Toggle button
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

  // initial state
  loadTokenFromLocal();
  setResult('Ready.');
}