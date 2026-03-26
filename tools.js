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
      isEditMode = true;

      grid?.classList.remove('hidden');
      layoutInfo?.classList.remove('hidden');

      updateLayoutInfo();
      makeElementsEditable();
    }

    function exitEditMode() {
      isEditMode = false;

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
  // TAILOR_ENGINE_START
  // TAILOR_ENGINE:initializer_START
  
  if (window.__TAILOR_INITIALIZED__) {
    console.log('Tailor already initialized, skipping...');
    return;
  }
  window.__TAILOR_INITIALIZED__ = true;
  
  const overlay = document.getElementById('tailorOverlay');
  const closeBtn = document.getElementById('tailorCloseBtn');
  const content = document.getElementById('tailorContent');

  // Fallback if new HTML not installed yet
  if (!content) {
    console.warn('tailorContent not found - using legacy initialization');
    initTailorLegacy(ctx);
    return;
  }

  const STORAGE_KEY = 'TWO_MOONS_TAILOR_TOKEN';

  // Close handlers
  closeBtn?.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });

  // Build the UI when Tailor opens
  buildMainUI();

  function buildMainUI() {
    content.innerHTML = '';
    
    // Token status (minimal, at top)
    const tokenRow = document.createElement('div');
    tokenRow.style.padding = '12px';
    tokenRow.style.background = 'rgba(76, 175, 80, 0.1)';
    tokenRow.style.borderRadius = '8px';
    tokenRow.style.marginBottom = '20px';
    tokenRow.style.display = 'flex';
    tokenRow.style.justifyContent = 'space-between';
    tokenRow.style.alignItems = 'center';
    
    const tokenText = document.createElement('span');
    const savedToken = localStorage.getItem(STORAGE_KEY);
    tokenText.textContent = savedToken ? '✓ Token Saved' : '⚠️ No Token';
    tokenText.style.fontSize = '13px';
    tokenText.style.fontWeight = 'bold';
    tokenText.style.color = savedToken ? '#4CAF50' : '#f44336';
    tokenRow.appendChild(tokenText);
    
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️';
    settingsBtn.style.padding = '6px 12px';
    settingsBtn.style.border = 'none';
    settingsBtn.style.borderRadius = '6px';
    settingsBtn.style.background = 'rgba(0,0,0,0.05)';
    settingsBtn.style.cursor = 'pointer';
    settingsBtn.style.fontSize = '16px';
    settingsBtn.onclick = showTokenSettings;
    tokenRow.appendChild(settingsBtn);
    
    content.appendChild(tokenRow);
    
    // Main title
    const title = document.createElement('div');
    title.textContent = 'What do you want to do?';
    title.style.fontWeight = 'bold';
    title.style.fontSize = '16px';
    title.style.marginBottom = '16px';
    title.style.textAlign = 'center';
    content.appendChild(title);
    
    // Button grid (2x2)
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '10px';
    grid.style.marginBottom = '20px';
    
    const actions = [
      { id: 'quickPaste', label: '⚡ Quick Paste', color: '#FF6B6B' },
      { id: 'edit', label: '✏️ Edit', color: '#4ECDC4' },
      { id: 'debug', label: '🔍 Debug', color: '#95E1D3' },
      { id: 'audit', label: '📊 Audit', color: '#F38181' }
    ];
    
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.style.padding = '20px 10px';
      btn.style.border = 'none';
      btn.style.borderRadius = '10px';
      btn.style.background = action.color;
      btn.style.color = 'white';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '14px';
      btn.style.fontWeight = 'bold';
      btn.style.transition = 'all 0.2s ease';
      btn.textContent = action.label;
      
      btn.onmouseover = () => {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      };
      btn.onmouseout = () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = 'none';
      };
      
      btn.onclick = () => {
        if (action.id === 'quickPaste') {
          // Call the existing Quick Paste function!
          if (typeof showQuickPasteInput === 'function') {
            showQuickPasteInput();
          }
        } else if (action.id === 'edit') {
          // Call the existing Edit Options function!
          if (typeof showEditOptions === 'function') {
            showEditOptions();
          }
        } else if (action.id === 'debug') {
          // Call the existing Debug function!
          if (typeof showDebugContextInput === 'function') {
            showDebugContextInput();
          }
        } else if (action.id === 'audit') {
          // Call the existing Audit function!
          if (typeof showAuditMode === 'function') {
            showAuditMode();
          }
        }
      };
      
      grid.appendChild(btn);
    });
    
    content.appendChild(grid);
    
    // Status area
    const status = document.createElement('div');
    status.id = 'tailorStatus';
    status.style.padding = '10px';
    status.style.background = '#f5f5f5';
    status.style.borderRadius = '6px';
    status.style.fontSize = '12px';
    status.style.color = '#666';
    status.style.minHeight = '20px';
    status.textContent = 'Ready';
    content.appendChild(status);
  }

  function showTokenSettings() {
    content.innerHTML = '';
    
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back';
    backBtn.style.marginBottom = '15px';
    backBtn.style.padding = '8px 16px';
    backBtn.style.border = 'none';
    backBtn.style.borderRadius = '6px';
    backBtn.style.background = 'rgba(0,0,0,0.1)';
    backBtn.style.cursor = 'pointer';
    backBtn.onclick = buildMainUI;
    content.appendChild(backBtn);
    
    const title = document.createElement('h3');
    title.textContent = 'GitHub Token Settings';
    title.style.marginBottom = '15px';
    content.appendChild(title);
    
    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Paste fine-grained PAT here';
    input.value = localStorage.getItem(STORAGE_KEY) || '';
    input.style.width = '100%';
    input.style.padding = '10px';
    input.style.borderRadius = '8px';
    input.style.border = '2px solid #e0e0e0';
    input.style.marginBottom = '10px';
    content.appendChild(input);
    
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '10px';
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Token';
    saveBtn.style.flex = '1';
    saveBtn.style.padding = '10px';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '8px';
    saveBtn.style.background = '#4CAF50';
    saveBtn.style.color = 'white';
    saveBtn.style.fontWeight = 'bold';
    saveBtn.style.cursor = 'pointer';
    saveBtn.onclick = () => {
      const t = input.value.trim();
      if (!t) { alert('Enter a token first!'); return; }
      localStorage.setItem(STORAGE_KEY, t);
      alert('Token saved!');
      buildMainUI();
    };
    btnRow.appendChild(saveBtn);
    
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear Token';
    clearBtn.style.flex = '1';
    clearBtn.style.padding = '10px';
    clearBtn.style.border = 'none';
    clearBtn.style.borderRadius = '8px';
    clearBtn.style.background = '#f44336';
    clearBtn.style.color = 'white';
    clearBtn.style.fontWeight = 'bold';
    clearBtn.style.cursor = 'pointer';
    clearBtn.onclick = () => {
      localStorage.removeItem(STORAGE_KEY);
      input.value = '';
      alert('Token cleared!');
      buildMainUI();
    };
    btnRow.appendChild(clearBtn);
    
    content.appendChild(btnRow);
  }

  function initTailorLegacy(ctx) {
    // This is a fallback that runs the old initialization
    // if the new HTML isn't installed yet
    console.log('Running legacy Tailor initialization...');
  }
  
  // TAILOR_ENGINE:initializer_END
  // TAILOR_ENGINE_END
}
})();


// Quick Paste Mode test - successfully added!
// This proves the Quick Paste system works!

// TAILOR_ENGINE_START
// TAILOR_ENGINE:backup_test_START

// Backup system test - March 26, 2026
// This tests if backups are created successfully!

// TAILOR_ENGINE:backup_test_END
// TAILOR_ENGINE_END