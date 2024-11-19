let isEyedropperActive = false;

// Handle tab updates (refresh, navigation)
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (isEyedropperActive) {
    if (changeInfo.status === 'loading') {
      isEyedropperActive = false;
      
      // Notify popup that picking was canceled
      browser.runtime.sendMessage({
        action: 'pickingCanceled',
        error: 'Page was refreshed'
      });
      browser.browserAction.enable();
    }
  }
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

  if (message.action === 'startPicking') {
    isEyedropperActive = true;
    browser.browserAction.disable();
  }

  if (message.action === 'colorPicked') {
    isEyedropperActive = false;
    browser.browserAction.enable();
    
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
  }

  if (message.action === 'stopPicking' || message.action === 'pickingCanceled') {
    isEyedropperActive = false;
    browser.browserAction.enable();
  }
});
