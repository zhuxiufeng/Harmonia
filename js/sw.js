/**
 * Anesidora MV3 Background Service Worker
 */

let creatingOffscreenPromise = null;

async function hasOffscreenDocument() {
  if ('hasDocument' in chrome.offscreen) {
    return await chrome.offscreen.hasDocument();
  }
  // Fallback for older Chromium versions
  const matchedClients = await self.clients.matchAll();
  for (const client of matchedClients) {
    if (client.url.includes('offscreen.html')) {
      return true;
    }
  }
  return false;
}

export async function ensureOffscreen() {
  if (await hasOffscreenDocument()) {
    return;
  }
  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }
  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Pandora radio music playback'
  }).catch((err) => {
    if (!err.message?.includes('Only a single offscreen document')) {
      console.error('Failed to create offscreen document:', err);
    }
  }).finally(() => {
    creatingOffscreenPromise = null;
  });

  await creatingOffscreenPromise;
}

async function setupRules() {
  try {
    const rules = [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'User-Agent',
              operation: 'set',
              value: 'libcurl'
            }
          ]
        },
        condition: {
          urlFilter: '||tuner.pandora.com',
          resourceTypes: ['xmlhttprequest', 'other', 'sub_frame']
        }
      }
    ];
    if (chrome.declarativeNetRequest?.updateDynamicRules) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: rules
      });
      console.log('[SW] DeclarativeNetRequest dynamic rules set successfully.');
    }
  } catch (e) {
    console.warn('[SW] DeclarativeNetRequest warning:', e);
  }
}

// Lifecycle listeners
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[SW] Anesidora installed/updated');
  await setupRules();
  await ensureOffscreen();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[SW] Browser startup');
  await setupRules();
  await ensureOffscreen();
});

// Commands (Media Shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  console.log('[SW] Command received:', command);
  await ensureOffscreen();
  // Forward to offscreen document
  chrome.runtime.sendMessage({
    type: 'COMMAND',
    command: command
  }).catch(() => {});
});

// Forwarding and handling messages between components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'ENSURE_OFFSCREEN') {
    ensureOffscreen().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'SET_POPUP') {
    if (message.popup) {
      chrome.action.setPopup({ popup: message.popup }).then(() => {
        sendResponse({ ok: true });
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
      return true;
    }
  }

  if (message.type === 'OPEN_POPOUT') {
    openPopoutWindow(message)
      .then((win) => sendResponse({ ok: true, windowId: win.id }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
    return true;
  }

  if (message.type === 'RESIZE_POPOUT') {
    const winId = sender.tab?.windowId || popoutWindowId;
    if (winId) {
      chrome.windows.update(winId, {
        state: 'normal',
        width: Math.min(1200, Math.max(300, parseInt(message.width) || 360)),
        height: Math.min(900, Math.max(140, parseInt(message.height) || 180))
      }).then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err?.message }));
      return true;
    }
  }

  if (message.type === 'TOGGLE_MAXIMIZE_POPOUT') {
    const winId = sender.tab?.windowId || popoutWindowId;
    if (winId) {
      chrome.windows.get(winId, (win) => {
        if (!win) {
          sendResponse({ ok: false, error: 'Window not found' });
          return;
        }
        if (win.state === 'maximized') {
          chrome.windows.update(winId, { state: 'normal', width: 380, height: 640 })
            .then(() => sendResponse({ ok: true, state: 'normal' }))
            .catch(err => sendResponse({ ok: false, error: err?.message }));
        } else {
          chrome.windows.update(winId, { state: 'maximized' })
            .then(() => sendResponse({ ok: true, state: 'maximized' }))
            .catch(err => sendResponse({ ok: false, error: err?.message }));
        }
      });
      return true;
    }
  }

  if (message.type === 'DOCK_POPOUT') {
    if (chrome.action?.openPopup) {
      chrome.action.openPopup().catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }
});

let popoutWindowId = null;

async function openPopoutWindow({ page = 'cozy.htm', width = 380, height = 640 }) {
  await ensureOffscreen();
  // Check if existing popout window is open
  try {
    const allWindows = await chrome.windows.getAll({ populate: true });
    for (const win of allWindows) {
      if (win.tabs) {
        for (const tab of win.tabs) {
          if (tab.url && tab.url.includes('popout=true')) {
            await chrome.windows.update(win.id, { focused: true });
            popoutWindowId = win.id;
            return win;
          }
        }
      }
    }
  } catch (e) {
    console.warn('[SW] Error checking existing popout windows:', e);
  }

  const url = chrome.runtime.getURL(`${page}?popout=true`);
  const targetW = Math.min(1000, Math.max(320, parseInt(width) || 380));
  const targetH = Math.min(800, Math.max(160, parseInt(height) || 640));
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: targetW,
    height: targetH,
    focused: true
  });
  popoutWindowId = win.id;
  return win;
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popoutWindowId) {
    popoutWindowId = null;
  }
});

// Waking up offscreen and setting up rules upon worker evaluation
setupRules().then(ensureOffscreen).catch(console.error);
