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
  
  // Get position FIRST (while still visible!)
  const smallRect = cottageSmall.getBoundingClientRect();
  
  // THEN hide small cottage
  cottageSmall.style.display = 'none';

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
    addMessageToChat("I understand, dear one. I'm here to help guide you through your creative journey. What would you like to explore today? ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¨", 'solena');
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

      alert('SUCCESS! ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ Firebase Storage is working!\n\nFile URL: ' + url);
      console.log('File URL:', url);

    } catch (error) {
      alert('ERROR ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¢ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ: ' + error.message);
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

// ==========================================
// UPLOAD SYSTEM
// ==========================================

function initUploadSystem() {
  const uploadAssetsBtn = document.getElementById('uploadAssetsOption');
  const uploadUI = document.getElementById('uploadUI');
  const closeUploadBtn = document.getElementById('closeUploadBtn');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const uploadStatus = document.getElementById('uploadStatus');
  const uploadResults = document.getElementById('uploadResults');

  let selectedFiles = [];
  let fileRenames = {}; // Store custom names
  let currentCategory = 'signposts';
  let isCreatingCategory = false;

  // Sanitize filename
  function sanitizeFileName(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')          // Spaces to dashes
      .replace(/-+/g, '-')           // Multiple dashes to single
      .replace(/^-|-$/g, '');        // Remove leading/trailing dashes
  }

  // Get file extension
  function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
  }

  // Create category selector UI
  function createCategorySelector() {
    const existingSelector = document.getElementById('categorySelector');
    if (existingSelector) return;

    const container = document.createElement('div');
    container.id = 'categorySelector';
    container.style.padding = '10px 20px';
    container.style.borderBottom = '1px solid rgba(0,0,0,0.1)';

    const label = document.createElement('div');
    label.textContent = 'Upload to category:';
    label.style.fontSize = '13px';
    label.style.fontWeight = 'bold';
    label.style.marginBottom = '8px';
    container.appendChild(label);

    const select = document.createElement('select');
    select.id = 'categorySelect';
    select.style.width = '100%';
    select.style.padding = '10px';
    select.style.borderRadius = '8px';
    select.style.border = '2px solid rgba(0,0,0,0.1)';
    select.style.marginBottom = '8px';

    const categories = ['signposts', 'cottages', 'backgrounds', 'lights', 'other'];
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      select.appendChild(option);
    });

    const createOption = document.createElement('option');
    createOption.value = 'CREATE_NEW';
    createOption.textContent = '➕ Create new category...';
    select.appendChild(createOption);

    select.addEventListener('change', (e) => {
      if (e.target.value === 'CREATE_NEW') {
        showCustomCategoryInput();
      } else {
        currentCategory = e.target.value;
        isCreatingCategory = false;
        hideCustomCategoryInput();
        updateAllPreviews();
      }
    });

    container.appendChild(select);

    // Custom category input
    const customContainer = document.createElement('div');
    customContainer.id = 'customCategoryContainer';
    customContainer.style.display = 'none';

    const customLabel = document.createElement('div');
    customLabel.textContent = 'New category name:';
    customLabel.style.fontSize = '12px';
    customLabel.style.marginBottom = '6px';
    customContainer.appendChild(customLabel);

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.id = 'customCategoryInput';
    customInput.placeholder = 'e.g., My Signposts';
    customInput.style.width = '100%';
    customInput.style.padding = '10px';
    customInput.style.borderRadius = '8px';
    customInput.style.border = '2px solid rgba(180,140,255,0.4)';
    customInput.style.marginBottom = '6px';

    customInput.addEventListener('input', (e) => {
      currentCategory = sanitizeFileName(e.target.value);
      updateCategoryPreview();
      updateAllPreviews();
    });

    customContainer.appendChild(customInput);

    // Category preview
    const preview = document.createElement('div');
    preview.id = 'categoryPreview';
    preview.style.fontSize = '11px';
    preview.style.color = '#666';
    preview.style.fontFamily = 'monospace';
    preview.style.padding = '6px';
    preview.style.background = 'rgba(0,0,0,0.05)';
    preview.style.borderRadius = '4px';
    customContainer.appendChild(preview);

    container.appendChild(customContainer);

    const uploadPanel = document.querySelector('.upload-panel');
    const selectFilesBtnParent = selectFilesBtn.parentNode;
    selectFilesBtnParent.insertBefore(container, selectFilesBtn);
  }

  function showCustomCategoryInput() {
    isCreatingCategory = true;
    const container = document.getElementById('customCategoryContainer');
    const input = document.getElementById('customCategoryInput');
    container.style.display = 'block';
    input.value = '';
    input.focus();
    currentCategory = '';
    updateCategoryPreview();
  }

  function hideCustomCategoryInput() {
    const container = document.getElementById('customCategoryContainer');
    container.style.display = 'none';
  }

  function updateCategoryPreview() {
    const preview = document.getElementById('categoryPreview');
    if (!preview) return;

    if (currentCategory) {
      preview.textContent = `📁 Category: ${currentCategory}/`;
      preview.style.color = '#4CAF50';
    } else {
      preview.textContent = '⚠️ Enter a category name';
      preview.style.color = '#f44336';
    }
  }

  function updateAllPreviews() {
    selectedFiles.forEach((file, index) => {
      updateFilePreview(index);
    });
  }

  function updateFilePreview(index) {
    const preview = document.getElementById(`preview-${index}`);
    if (!preview) return;

    const file = selectedFiles[index];
    const customName = fileRenames[index] || '';
    const sanitized = sanitizeFileName(customName);
    const extension = getFileExtension(file.name);

    if (sanitized && currentCategory) {
      preview.textContent = `📁 ${currentCategory}/${sanitized}${extension}`;
      preview.style.color = '#4CAF50';
    } else if (!currentCategory) {
      preview.textContent = '⚠️ Select a category first';
      preview.style.color = '#f44336';
    } else {
      preview.textContent = '⚠️ Enter a filename';
      preview.style.color = '#f44336';
    }
  }

  // Open upload panel
  uploadAssetsBtn?.addEventListener('click', () => {
    uploadUI?.classList.remove('hidden');
    uploadUI?.classList.add('active');
    document.getElementById('editMenu')?.classList.add('hidden');
    createCategorySelector();
  });

  // Close upload panel
  closeUploadBtn?.addEventListener('click', () => {
    uploadUI?.classList.remove('active');
    setTimeout(() => {
      uploadUI?.classList.add('hidden');
      resetUploadUI();
    }, 300);
  });

  // Click outside to close
  uploadUI?.addEventListener('click', (e) => {
    if (e.target === uploadUI) {
      closeUploadBtn?.click();
    }
  });

  // Select files button
  selectFilesBtn?.addEventListener('click', () => {
    if (!currentCategory) {
      alert('Please select or create a category first!');
      return;
    }
    fileInput?.click();
  });

  // File selection handler
  fileInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    selectedFiles = files;
    fileRenames = {};

    if (files.length > 0) {
      displayFileList(files);
      uploadBtn?.classList.remove('hidden');
    } else {
      fileList.innerHTML = '';
      uploadBtn?.classList.add('hidden');
    }
  });

  // Display selected files with rename inputs
  function displayFileList(files) {
    fileList.innerHTML = '';
    
    const header = document.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '12px';
    header.style.fontSize = '14px';
    header.textContent = `Name your ${files.length} file(s):`;
    fileList.appendChild(header);

    files.forEach((file, index) => {
      const container = document.createElement('div');
      container.className = 'file-item';
      container.style.marginBottom = '12px';

      // Original filename
      const originalName = document.createElement('div');
      originalName.textContent = `📷 ${file.name}`;
      originalName.style.fontWeight = 'bold';
      originalName.style.marginBottom = '6px';
      originalName.style.fontSize = '12px';
      container.appendChild(originalName);

      // Rename label
      const renameLabel = document.createElement('div');
      renameLabel.textContent = 'Rename to:';
      renameLabel.style.fontSize = '11px';
      renameLabel.style.marginBottom = '4px';
      renameLabel.style.color = '#666';
      container.appendChild(renameLabel);

      // Rename input
      const renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.placeholder = 'e.g., left rustic';
      renameInput.style.width = '100%';
      renameInput.style.padding = '8px';
      renameInput.style.borderRadius = '6px';
      renameInput.style.border = '2px solid rgba(180,140,255,0.3)';
      renameInput.style.fontSize = '13px';
      renameInput.style.marginBottom = '6px';

      renameInput.addEventListener('input', (e) => {
        fileRenames[index] = e.target.value;
        updateFilePreview(index);
      });

      container.appendChild(renameInput);

      // Path preview
      const preview = document.createElement('div');
      preview.id = `preview-${index}`;
      preview.style.fontSize = '11px';
      preview.style.fontFamily = 'monospace';
      preview.style.padding = '6px';
      preview.style.background = 'rgba(0,0,0,0.05)';
      preview.style.borderRadius = '4px';
      preview.style.color = '#f44336';
      preview.textContent = '⚠️ Enter a filename';
      container.appendChild(preview);

      fileList.appendChild(container);
    });
  }

  // Format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Upload to Firebase
  uploadBtn?.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    if (!currentCategory) {
      alert('Please select or create a category first!');
      return;
    }

    // Check all files have names
    for (let i = 0; i < selectedFiles.length; i++) {
      const customName = fileRenames[i] || '';
      const sanitized = sanitizeFileName(customName);
      if (!sanitized) {
        alert(`Please name file ${i + 1}: ${selectedFiles[i].name}`);
        return;
      }
    }

    uploadBtn.disabled = true;
    uploadProgress.classList.remove('hidden');
    uploadResults.classList.add('hidden');
    uploadResults.innerHTML = '';

    const results = [];
    let completed = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const customName = fileRenames[i] || '';
      const sanitized = sanitizeFileName(customName);
      const extension = getFileExtension(file.name);
      const finalFilename = sanitized + extension;

      try {
        uploadStatus.textContent = `Uploading ${finalFilename}...`;

        const filePath = `${currentCategory}/${finalFilename}`;
        const storageRef = window.firebaseStorage.ref(filePath);
        const uploadTask = storageRef.put(file);

        // Track progress
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const overallProgress = ((completed + (progress / 100)) / selectedFiles.length) * 100;
            progressFill.style.width = `${overallProgress}%`;
          }
        );

        await uploadTask;
        const downloadURL = await storageRef.getDownloadURL();

        results.push({
          success: true,
          originalName: file.name,
          finalName: finalFilename,
          path: filePath,
          url: downloadURL
        });

        completed++;

      } catch (error) {
        console.error('Upload error:', error);
        results.push({
          success: false,
          originalName: file.name,
          finalName: finalFilename,
          error: error.message
        });
        completed++;
      }
    }

    displayResults(results);
    uploadBtn.disabled = false;
    uploadStatus.textContent = 'Upload complete!';
  });

  // Display upload results
  function displayResults(results) {
    uploadResults.classList.remove('hidden');
    uploadResults.innerHTML = '<div style="font-weight:bold; margin-bottom:12px; font-size:14px;">✅ Upload Complete!</div>';

    results.forEach(result => {
      const div = document.createElement('div');
      div.style.marginBottom = '10px';
      div.style.padding = '10px';
      div.style.background = result.success ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)';
      div.style.borderRadius = '8px';
      div.style.fontSize = '12px';

      if (result.success) {
        div.innerHTML = `
          <div style="font-weight:bold; color:#4CAF50; margin-bottom:4px;">${result.finalName}</div>
          <div style="font-size:11px; color:#666; margin-bottom:4px;">Original: ${result.originalName}</div>
          <div style="margin-top:6px; font-family:monospace; font-size:11px; color:#666; background:rgba(0,0,0,0.05); padding:4px; border-radius:4px;">
            📁 ${result.path}
          </div>
          <div style="margin-top:6px;">
            <a href="${result.url}" target="_blank" style="color:#1976D2; font-size:11px; text-decoration:underline;">View file</a>
          </div>
        `;
      } else {
        div.innerHTML = `
          <div style="font-weight:bold; color:#f44336;">${result.finalName}</div>
          <div style="margin-top:4px; color:#666;">Error: ${result.error}</div>
        `;
      }

      uploadResults.appendChild(div);
    });
  }

  // Reset UI
  function resetUploadUI() {
    selectedFiles = [];
    fileRenames = {};
    fileInput.value = '';
    fileList.innerHTML = '';
    uploadBtn?.classList.add('hidden');
    uploadProgress?.classList.add('hidden');
    uploadResults?.classList.add('hidden');
    uploadResults.innerHTML = '';
    progressFill.style.width = '0%';
    uploadStatus.textContent = '';
    currentCategory = 'signposts';
    isCreatingCategory = false;
    
    const select = document.getElementById('categorySelect');
    if (select) select.value = 'signposts';
    
    hideCustomCategoryInput();
  }
}

// Initialize upload system when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUploadSystem);
} else {
  initUploadSystem();
}

// Initialize upload system when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUploadSystem);
} else {
  initUploadSystem();
}

// Initialize upload system when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUploadSystem);
} else {
  initUploadSystem();
}