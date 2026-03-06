// Two Moon Studio - IMAGE-BASED Visual Editor (core world file)
import { database, storage } from './firebase-config.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js';
import { ref as dbRef, get, set } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js';

let currentOrientation = 'landscape';
let isCottageZoomed = false;
let isNightNow = false;

// ===== Layout defaults =====
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

// ===== Firebase layout path (single-user for now) =====
const LAYOUT_PATH = 'layouts/default';

// ===== Boot =====
document.addEventListener('DOMContentLoaded', async function () {
  detectOrientation();

  await loadLayout();
  applyLayout();

  initChat();
  initApp();
  initStorageTest();

  // Toolbelt (layout editor + tailor) lives in tools.js
  if (window.initTwoMoonsTools) {
    window.initTwoMoonsTools({
      // state getters
      currentOrientation: () => currentOrientation,
      isCottageZoomed: () => isCottageZoomed,

      // layout + persistence
      getCurrentLayout,
      applyLayout,
      syncLights,
      updateLightsVisibility,
      saveLayoutToFirebase
    });
  }

  window.addEventListener('resize', handleOrientationChange);
});

// ===== Orientation =====
function detectOrientation() {
  currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

function handleOrientationChange() {
  const oldOrientation = currentOrientation;
  detectOrientation();
  if (oldOrientation !== currentOrientation) applyLayout();
}

function getCurrentLayout() {
  return currentOrientation === 'landscape' ? layoutLandscape : layoutPortrait;
}

// ===== Load/Save Layout =====
async function loadLayout() {
  // 1) Try Firebase
  try {
    const snap = await get(dbRef(database, LAYOUT_PATH));
    if (snap.exists()) {
      const data = snap.val();
      if (data?.landscape) layoutLandscape = data.landscape;
      if (data?.portrait) layoutPortrait = data.portrait;
      return;
    }
  } catch (e) {
    // ignore and fallback
  }

  // 2) Fallback to local layout.json if present
  try {
    const response = await fetch('layout.json');
    const data = await response.json();
    if (data.landscape) layoutLandscape = data.landscape;
    if (data.portrait) layoutPortrait = data.portrait;
  } catch (error) {
    // default layout stays
  }
}

async function saveLayoutToFirebase() {
  const dataObj = { landscape: layoutLandscape, portrait: layoutPortrait };
  await set(dbRef(database, LAYOUT_PATH), dataObj);
}

// ===== Apply layout =====
function applyLayout() {
  const layout = getCurrentLayout();
  const container = document.getElementById('landing-container');
  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  Object.keys(layout).forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;

    // Don't position zoomed cottage when not zoomed
    if (id === 'cottage-zoomed' && !isCottageZoomed) return;

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

  syncLights(isCottageZoomed ? 'cottage-zoomed' : 'cottage-small');
  updateLightsVisibility();
}

// ===== Lights positioning =====
function syncLights(cottageId) {
  const cottage = document.getElementById(cottageId);
  const lights = document.getElementById('lights');
  if (!cottage || !lights) return;

  lights.style.left = cottage.style.left;
  lights.style.top = cottage.style.top;
  lights.style.width = cottage.style.width;
  lights.style.height = cottage.style.height;
}

// ===== Lights visibility =====
function updateLightsVisibility() {
  const lights = document.getElementById('lights');
  if (!lights) return;

  if (isNightNow) lights.classList.add('active');
  else lights.classList.remove('active');
}

// ===== Zoom =====
function zoomCottage() {
  const cottageSmall = document.getElementById('cottage-small');
  const cottageZoomed = document.getElementById('cottage-zoomed');
  const background = document.getElementById('background');
  const orb = document.getElementById('solena-orb');

  if (!cottageSmall || !cottageZoomed) return;

  isCottageZoomed = true;
  
  // HIDE small cottage when zooming (use inline style for reliability!)
  cottageSmall.style.display = 'none';

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

  background?.classList.add('faded');
  orb?.classList.add('faded');

  setTimeout(() => {
    cottageZoomed.style.left = `${targetLeft}px`;
    cottageZoomed.style.top = `${targetTop}px`;
    cottageZoomed.style.width = `${targetWidth}px`;

    syncLights('cottage-zoomed');
    updateLightsVisibility();
  }, 50);

  setTimeout(() => {
    cottageZoomed.classList.remove('zooming');
    cottageZoomed.classList.add('active');
  }, 650);
}

function unzoomCottage() {
  const cottageSmall = document.getElementById('cottage-small');
  const cottageZoomed = document.getElementById('cottage-zoomed');
  const background = document.getElementById('background');
  const orb = document.getElementById('solena-orb');

  if (!cottageZoomed) return;

  cottageZoomed.classList.remove('active');
  cottageZoomed.classList.add('zooming');

  background?.classList.remove('faded');
  orb?.classList.remove('faded');

  const layout = getCurrentLayout();
  const smallConfig = layout['cottage-small'];
  const container = document.getElementById('landing-container');

  const targetLeft = (smallConfig.left / 100) * container.clientWidth;
  const targetTop = (smallConfig.top / 100) * container.clientHeight;
  const targetWidth = (smallConfig.width / 100) * container.clientWidth;

  cottageZoomed.style.left = `${targetLeft}px`;
  cottageZoomed.style.top = `${targetTop}px`;
  cottageZoomed.style.width = `${targetWidth}px`;

  syncLights('cottage-small');
  updateLightsVisibility();

  setTimeout(() => {
    cottageZoomed.classList.remove('zooming');
    cottageZoomed.classList.add('hidden');
    isCottageZoomed = false;

    // SHOW small cottage when unzooming (use inline style for reliability!)
    if (cottageSmall) cottageSmall.style.display = '';

    applyLayout();
  }, 650);
}

// ===== Chat =====
function initChat() {
  const chatOverlay = document.getElementById('solena-chat');
  const closeBtn = document.getElementById('close-chat');
  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');
  const voiceBtn = document.getElementById('voice-input-btn');

  closeBtn?.addEventListener('click', function () {
    chatOverlay.classList.remove('active');
    setTimeout(() => chatOverlay.classList.add('hidden'), 300);
  });

  chatOverlay?.addEventListener('click', function (e) {
    if (e.target === chatOverlay) {
      chatOverlay.classList.remove('active');
      setTimeout(() => chatOverlay.classList.add('hidden'), 300);
    }
  });

  sendBtn?.addEventListener('click', sendMessage);
  chatInput?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  voiceBtn?.addEventListener('click', function () {
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
    addMessageToChat("I understand, dear one. I'm here to help guide you through your creative journey. What would you like to explore today? ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¨", 'solena');
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

// ===== App interactions =====
function initApp() {
  const cottageSmall = document.getElementById('cottage-small');
  const container = document.getElementById('landing-container');
  const dusk = document.getElementById('dusk-overlay');
  const orb = document.getElementById('solena-orb');
  const chatOverlay = document.getElementById('solena-chat');

  function isLayoutEditing() {
    return !!document.querySelector('.editable-element.edit-mode');
  }

  function isHotspotClick(target) {
    // Future-proof: when we add hotspots, give them class="hotspot"
    // or data-hotspot="true" so they don't trigger unzoom.
    return !!target.closest?.('.hotspot, [data-hotspot="true"]');
  }

  function checkTimeAndSetMode() {
  const now = new Date();
  const hour = now.getHours();
  isNightNow = hour >= 19 || hour < 7;

  if (isNightNow) dusk?.classList.add('active');
  else dusk?.classList.remove('active');

  // Debug breadcrumb (throttled): shows once per minute max
  try {
    const stamp = now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    if (window.__TM_LAST_MODE_LOG__ !== stamp) {
      window.__TM_LAST_MODE_LOG__ = stamp;
      console.log('[Two Moons] checkTimeAndSetMode ran', stamp, 'isNightNow=', isNightNow);
    }
  } catch {}

  updateLightsVisibility();
}

  // Tap small cottage -> zoom (unless editing)
  cottageSmall?.addEventListener('click', function (e) {
    if (isLayoutEditing()) return;
    e.stopPropagation();
    if (!isCottageZoomed) zoomCottage();
  });

  // Tap anywhere (including on the zoomed cottage) -> unzoom
  // EXCEPT: orb/chat/hotspots, and EXCEPT while editing.
  container?.addEventListener('click', function (e) {
    if (isLayoutEditing()) return;
    if (!isCottageZoomed) return;

    const target = e.target;

    // Don't unzoom if interacting with the orb or the chat overlay
    if (target === orb || target.closest?.('#solena-orb')) return;
    if (target.closest?.('#solena-chat')) return;

    // Don't unzoom if clicking a hotspot (we'll add these later)
    if (isHotspotClick(target)) return;

    unzoomCottage();
  });

  // Orb opens chat (unless editing)
  orb?.addEventListener('click', function (e) {
    if (isLayoutEditing()) return;
    e.stopPropagation();
    chatOverlay?.classList.remove('hidden');
    setTimeout(() => chatOverlay?.classList.add('active'), 10);
  });

  checkTimeAndSetMode();
  setInterval(checkTimeAndSetMode, 60 * 1000);
}

// ===== Firebase Storage test =====
function initStorageTest() {
  const testBtn = document.getElementById('testStorageBtn');

  testBtn?.addEventListener('click', async function () {
    try {
      alert('Testing Firebase Storage...');

      const testText = 'Hello from Two Moon Studio!';
      const testFile = new Blob([testText], { type: 'text/plain' });

      const sRef = storageRef(storage, 'test/hello.txt');
      await uploadBytes(sRef, testFile);

      const url = await getDownloadURL(sRef);

      alert('SUCCESS! ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Firebase Storage is working!\n\nFile URL: ' + url);
      console.log('File URL:', url);

    } catch (error) {
      alert('ERROR ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ: ' + error.message);
      console.error('Firebase Storage error:', error);
    }
  });
}
// ---- Boot Two Moons Tools (Layout + Tailor) ----
document.addEventListener('DOMContentLoaded', () => {
  const twoMoonsCtx = {};

  if (typeof window.initTwoMoonsTools === 'function') {
    window.initTwoMoonsTools(twoMoonsCtx);
  }
});