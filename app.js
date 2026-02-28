// Two Moon Studio - IMAGE-BASED Visual Editor
import { database, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js';

let currentOrientation = 'landscape';
let isEditMode = false;
let isCottageZoomed = false;

// Night/day state (single source of truth for lights + dusk)
let isNightNow = false;

// Cached DOM refs (set in initApp)
let duskEl = null;
let lightsEl = null;

let layoutLandscape = {
  'cottage-small': { left: 20, top: 40, width: 20 },
  'cottage-zoomed': { left: 10, top: 10, width: 80 },
  'lights': { left: 20, top: 40, width: 20 },
  'solena-orb': { left: 85, top: 80, size: 8 }
};

let layoutPortrait = {
  'cottage-small': { left: 15, top: 35, width: 25 },
  'cottage-zoomed': { left: 5, top: 5, width: 90 },
  'lights': { left: 15, top: 35, width: 25 },
  'solena-orb': { left: 80, top: 75, size: 10 }
};

let dragElement = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let resizeElement = null;
let initialSize = 0;
let initialDistance = 0;

document.addEventListener('DOMContentLoaded', async function () {
  detectOrientation();
  await loadLayout();
  applyLayout();
  initEditMode();
  initChat();
  initApp();
  initStorageTest();

  window.addEventListener('resize', handleOrientationChange);
});

function detectOrientation() {
  currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

function handleOrientationChange() {
  const oldOrientation = currentOrientation;
  detectOrientation();
  if (oldOrientation !== currentOrientation) {
    applyLayout();
  }
}

function getCurrentLayout() {
  return currentOrientation === 'landscape' ? layoutLandscape : layoutPortrait;
}

async function loadLayout() {
  try {
    const response = await fetch('layout.json');
    const data = await response.json();
    if (data.landscape) layoutLandscape = data.landscape;
    if (data.portrait) layoutPortrait = data.portrait;
    console.log('Layout loaded');
  } catch (error) {
    console.log('Using default layout');
  }
}

function applyLayout() {
  const layout = getCurrentLayout();
  const container = document.getElementById('landing-container');
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  Object.keys(layout).forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;

    const config = layout[id];
    const left = (config.left / 100) * containerWidth;
    const top = (config.top / 100) * containerHeight;

    if (config.size !== undefined) {
      const size = Math.min(
        (config.size / 100) * containerWidth,
        (config.size / 100) * containerHeight
      );
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
    } else {
      const width = (config.width / 100) * containerWidth;
      element.style.width = `${width}px`;
      element.style.height = 'auto';
    }

    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  });

  syncLightsInstant(isCottageZoomed ? 'cottage-zoomed' : 'cottage-small');
  refreshNightMode(); // <-- IMPORTANT: re-assert correct lights state after layout
}

function syncLights(cottageId) {
  const cottage = document.getElementById(cottageId);
  const lights = lightsEl || document.getElementById('lights');
  if (!cottage || !lights) return;

  lights.style.left = cottage.style.left;
  lights.style.top = cottage.style.top;
  lights.style.width = cottage.style.width;
  lights.style.height = cottage.style.height;
}

// Reposition lights with ZERO lag
function syncLightsInstant(cottageId) {
  const lights = lightsEl || document.getElementById('lights');
  if (!lights) return;

  const prev = lights.style.transition;
  lights.style.transition = 'none';
  syncLights(cottageId);
  void lights.offsetHeight; // force reflow
  lights.style.transition = prev;
}

// ---- NIGHT MODE: single source of truth ----
function computeIsNight(date = new Date()) {
  const hour = date.getHours();
  return hour >= 19 || hour < 7;
}

function setNightMode(nightBool) {
  isNightNow = !!nightBool;

  if (duskEl) {
    if (isNightNow) duskEl.classList.add('active');
    else duskEl.classList.remove('active');
  }

  if (lightsEl) {
    if (isNightNow) lightsEl.classList.add('active');
    else lightsEl.classList.remove('active');
  }
}

function refreshNightMode() {
  setNightMode(computeIsNight());
}

// Optional manual tester from console / bookmarklet:
// window.forceNight(true) or window.forceNight(false)
window.forceNight = (v) => setNightMode(!!v);

// -------------------------------------------

function initEditMode() {
  const editBtn = document.getElementById('editModeBtn');

  editBtn.addEventListener('click', function () {
    isEditMode = !isEditMode;
    if (isEditMode) enterEditMode();
    else exitEditMode();
  });
}

function enterEditMode() {
  const editBtn = document.getElementById('editModeBtn');
  const grid = document.getElementById('grid-overlay');
  const layoutInfo = document.getElementById('layoutInfo');

  editBtn.classList.add('active');
  editBtn.textContent = 'Editing...';
  grid.classList.remove('hidden');
  layoutInfo.classList.remove('hidden');

  updateLayoutInfo();
  makeElementsEditable();
}

function exitEditMode() {
  const editBtn = document.getElementById('editModeBtn');
  const grid = document.getElementById('grid-overlay');
  const layoutInfo = document.getElementById('layoutInfo');

  editBtn.classList.remove('active');
  editBtn.textContent = 'Edit Layout';
  grid.classList.add('hidden');
  layoutInfo.classList.add('hidden');

  removeEditListeners();
}

function makeElementsEditable() {
  const editables = document.querySelectorAll('.editable-element');

  editables.forEach(element => {
    const view = element.dataset.editView;

    if (view === 'zoomed' && !isCottageZoomed) {
      element.classList.remove('edit-mode');
      return;
    }
    if (view === 'normal' && isCottageZoomed && element.classList.contains('cottage-element')) {
      element.classList.remove('edit-mode');
      return;
    }

    element.classList.add('edit-mode');

    element.removeEventListener('touchstart', onDragStart);
    element.removeEventListener('touchmove', onDragMove);
    element.removeEventListener('touchend', onDragEnd);

    element.addEventListener('touchstart', onDragStart);
    element.addEventListener('touchmove', onDragMove);
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

    const touch = e.touches[0];
    const rect = dragElement.getBoundingClientRect();

    dragOffsetX = touch.clientX - rect.left;
    dragOffsetY = touch.clientY - rect.top;

  } else if (e.touches.length === 2) {
    e.preventDefault();
    resizeElement = e.target.closest('.editable-element');

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

  if (dragElement && e.touches.length === 1) {
    e.preventDefault();

    const touch = e.touches[0];
    const container = document.getElementById('landing-container');
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
      syncLightsInstant(dragElement.id);
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

    const container = document.getElementById('landing-container');
    newSize = Math.max(50, Math.min(container.clientWidth * 0.95, newSize));

    resizeElement.style.width = `${newSize}px`;

    if (resizeElement.classList.contains('orb-element')) {
      resizeElement.style.height = `${newSize}px`;
    } else {
      resizeElement.style.height = 'auto';
    }

    if (resizeElement.id === 'cottage-small' || resizeElement.id === 'cottage-zoomed') {
      syncLightsInstant(resizeElement.id);
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
  const layoutInfo = document.getElementById('layoutInfo');
  const layout = getCurrentLayout();
  const orientationIcon = currentOrientation === 'landscape' ? '🖥️' : '📱';
  const orientationName = currentOrientation === 'landscape' ? 'Landscape' : 'Portrait';
  const viewIcon = isCottageZoomed ? '🔍' : '🏠';
  const viewName = isCottageZoomed ? 'Zoomed' : 'Normal';

  const currentViewElements = Array.from(document.querySelectorAll('.editable-element.edit-mode'));

  let html = `
    <div style="text-align: center; margin-bottom: 15px;">
      <strong style="font-size: 16px;">Visual Editor</strong><br>
      <div style="background: rgba(180, 140, 255, 0.15); padding: 10px; border-radius: 8px; margin: 10px 0;">
        ${orientationIcon} ${orientationName} • ${viewIcon} ${viewName}
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

function saveLayout() {
  const dataObj = { landscape: layoutLandscape, portrait: layoutPortrait };
  const dataStr = JSON.stringify(dataObj, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = 'layout.json';
  link.click();
  alert('Layout saved! Replace layout.json in Textastic.');
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

function zoomCottage() {
  const cottageSmall = document.getElementById('cottage-small');
  const cottageZoomed = document.getElementById('cottage-zoomed');
  const background = document.getElementById('background');
  const orb = document.getElementById('solena-orb');

  if (!cottageSmall || !cottageZoomed) return;

  isCottageZoomed = true;

  // Align lights immediately (but NEVER force them on)
  syncLightsInstant('cottage-small');
  refreshNightMode();

  const smallRect = cottageSmall.getBoundingClientRect();
  const layout = getCurrentLayout();
  const zoomedConfig = layout['cottage-zoomed'];
  const container = document.getElementById('landing-container');

  const targetLeft = (zoomedConfig.left / 100) * container.clientWidth;
  const targetTop = (zoomedConfig.top / 100) * container.clientHeight;
  const targetWidth = (zoomedConfig.width / 100) * container.clientWidth;

  cottageZoomed.style.left = `${smallRect.left - container.getBoundingClientRect().left}px`;
  cottageZoomed.style.top = `${smallRect.top - container.getBoundingClientRect().top}px`;
  cottageZoomed.style.width = `${smallRect.width}px`;

  cottageZoomed.classList.remove('hidden');
  cottageZoomed.classList.add('zooming');

  background.classList.add('faded');
  if (orb) orb.classList.add('faded');

  setTimeout(() => {
    cottageZoomed.style.left = `${targetLeft}px`;
    cottageZoomed.style.top = `${targetTop}px`;
    cottageZoomed.style.width = `${targetWidth}px`;

    // Lock lights to zoomed cottage during/after animation
    setTimeout(() => {
      syncLightsInstant('cottage-zoomed');
      refreshNightMode();
    }, 60);

  }, 50);

  setTimeout(() => {
    cottageZoomed.classList.remove('zooming');
    cottageZoomed.classList.add('active');

    if (isEditMode) {
      removeEditListeners();
      makeElementsEditable();
      updateLayoutInfo();
    }
  }, 650);
}

function unzoomCottage() {
  const cottageZoomed = document.getElementById('cottage-zoomed');
  const background = document.getElementById('background');
  const orb = document.getElementById('solena-orb');

  if (!cottageZoomed) return;

  cottageZoomed.classList.remove('active');
  cottageZoomed.classList.add('zooming');

  background.classList.remove('faded');
  if (orb) orb.classList.remove('faded');

  const layout = getCurrentLayout();
  const smallConfig = layout['cottage-small'];
  const container = document.getElementById('landing-container');

  const targetLeft = (smallConfig.left / 100) * container.clientWidth;
  const targetTop = (smallConfig.top / 100) * container.clientHeight;
  const targetWidth = (smallConfig.width / 100) * container.clientWidth;

  cottageZoomed.style.left = `${targetLeft}px`;
  cottageZoomed.style.top = `${targetTop}px`;
  cottageZoomed.style.width = `${targetWidth}px`;

  syncLightsInstant('cottage-zoomed');
  refreshNightMode();

  setTimeout(() => {
    cottageZoomed.classList.remove('zooming');
    cottageZoomed.classList.add('hidden');

    isCottageZoomed = false;

    syncLightsInstant('cottage-small');
    refreshNightMode();

    if (isEditMode) {
      removeEditListeners();
      makeElementsEditable();
      updateLayoutInfo();
    }
  }, 650);
}

function initChat() {
  const chatOverlay = document.getElementById('solena-chat');
  const closeBtn = document.getElementById('close-chat');
  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');
  const voiceBtn = document.getElementById('voice-input-btn');

  closeBtn.addEventListener('click', function () {
    chatOverlay.classList.remove('active');
    setTimeout(() => chatOverlay.classList.add('hidden'), 300);
  });

  chatOverlay.addEventListener('click', function (e) {
    if (e.target === chatOverlay) {
      chatOverlay.classList.remove('active');
      setTimeout(() => chatOverlay.classList.add('hidden'), 300);
    }
  });

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  voiceBtn.addEventListener('click', function () {
    alert('Voice input coming soon!');
  });
}

function sendMessage() {
  const chatInput = document.getElementById('chat-input');
  const message = chatInput.value.trim();
  if (message === '') return;

  addMessageToChat(message, 'user');
  chatInput.value = '';

  setTimeout(() => {
    addMessageToChat("I understand, dear one. I'm here to help guide you through your creative journey. What would you like to explore today? ✨", 'solena');
  }, 1000);
}

function addMessageToChat(text, sender) {
  const chatMessages = document.getElementById('chat-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  bubbleDiv.textContent = text;
  messageDiv.appendChild(bubbleDiv);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function initApp() {
  const cottageSmall = document.getElementById('cottage-small');
  const container = document.getElementById('landing-container');
  duskEl = document.getElementById('dusk-overlay');
  lightsEl = document.getElementById('lights');
  const orb = document.getElementById('solena-orb');
  const chatOverlay = document.getElementById('solena-chat');

  // Set immediately, then refresh periodically
  refreshNightMode();
  setInterval(refreshNightMode, 60 * 1000); // every minute

  if (cottageSmall) {
    cottageSmall.addEventListener('click', function (e) {
      if (isEditMode) return;
      e.stopPropagation();
      if (!isCottageZoomed) zoomCottage();
    });
  }

  container.addEventListener('click', function (e) {
    if (isEditMode) return;
    if (
      isCottageZoomed &&
      e.target !== cottageSmall &&
      e.target !== orb &&
      !e.target.closest('.editable-element')
    ) {
      unzoomCottage();
    }
  });

  if (orb) {
    orb.addEventListener('click', function (e) {
      if (isEditMode) return;
      e.stopPropagation();
      chatOverlay.classList.remove('hidden');
      setTimeout(() => chatOverlay.classList.add('active'), 10);
    });
  }
}

function initStorageTest() {
  const testBtn = document.getElementById('testStorageBtn');

  if (testBtn) {
    testBtn.addEventListener('click', async function () {
      try {
        alert('Testing Firebase Storage...');

        const testText = 'Hello from Two Moon Studio!';
        const testFile = new Blob([testText], { type: 'text/plain' });

        const storageRef = ref(storage, 'test/hello.txt');
        await uploadBytes(storageRef, testFile);

        const url = await getDownloadURL(storageRef);

        alert('SUCCESS! ✅ Firebase Storage is working!\n\nFile URL: ' + url);
        console.log('File URL:', url);

      } catch (error) {
        alert('ERROR ❌: ' + error.message);
        console.error('Firebase Storage error:', error);
      }
    });
  }
}