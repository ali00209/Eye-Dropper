let isEyedropperActive = false;

const ICON_PATHS = {
  normal: {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "96": "icons/icon96.png",
    "128": "icons/icon128.png",
    "256": "icons/icon256.png",
    "512": "icons/icon512.png"
  },
  active: {
    "16": "icons/icon-active-16.png",
    "32": "icons/icon-active-32.png",
    "48": "icons/icon-active-48.png",
    "96": "icons/icon-active-96.png",
    "128": "icons/icon-active-128.png",
    "256": "icons/icon-active-256.png",
    "512": "icons/icon-active-512.png"
  }
};

// Update browser action state
async function updateBrowserAction(tab) {
  try {
    // Only enable on http/https pages
    const shouldEnable = tab && tab.url && (
      tab.url.startsWith('http://') || 
      tab.url.startsWith('https://')
    );

    // Update icon and state
    if (shouldEnable) {
      await browser.browserAction.enable(tab.id);
      await browser.browserAction.setIcon({
        path: isEyedropperActive ? ICON_PATHS.active : ICON_PATHS.normal,
        tabId: tab.id
      });
    } else {
      await browser.browserAction.disable(tab.id);
      await browser.browserAction.setIcon({
        path: ICON_PATHS.normal,
        tabId: tab.id
      });
    }
  } catch (error) {
    console.error('Failed to update browser action:', error);
  }
}

// Handle tab updates (refresh, navigation)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateBrowserAction(tab);
  }
  
  if (isEyedropperActive && changeInfo.status === 'loading') {
    isEyedropperActive = false;
    updateBrowserAction(tab);
    
    // Notify popup that picking was canceled
    browser.runtime.sendMessage({
      action: 'pickingCanceled',
      error: 'Page was refreshed'
    });
  }
});

// Handle tab activation
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  updateBrowserAction(tab);
});

// Handle messages from content scripts and popup
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === 'captureVisibleTab') {
    try {
      return await browser.tabs.captureVisibleTab(null, { format: 'png' });
    } catch (error) {
      console.error('Failed to capture tab:', error);
      return null;
    }
  }

  if (message.action === 'getPickerState') {
    return Promise.resolve({ isActive: isEyedropperActive });
  }

  // Handle picking state changes
  switch (message.action) {
    case 'startPicking':
    case 'pickingStarted':
      isEyedropperActive = true;
      if (sender.tab) {
        updateBrowserAction(sender.tab);
      }
      break;

    case 'colorPicked':
      isEyedropperActive = false;
      if (sender.tab) {
        updateBrowserAction(sender.tab);
      }
      
      // Store the color
      browser.storage.local.get(['colorHistory', 'lastPickedColor']).then(result => {
        let colorHistory = result.colorHistory || [];
        if (!colorHistory.includes(message.color)) {
          colorHistory.unshift(message.color);
          if (colorHistory.length > 10) {
            colorHistory.pop();
          }
        }
        browser.storage.local.set({
          lastPickedColor: message.color,
          colorHistory: colorHistory
        });
      });
      break;

    case 'stopPicking':
    case 'pickingStopped':
    case 'pickingCanceled':
      isEyedropperActive = false;
      if (sender.tab) {
        updateBrowserAction(sender.tab);
      }
      break;
  }
});
