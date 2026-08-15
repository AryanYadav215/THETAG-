chrome.action.onClicked.addListener(async (tab) => {
  // 1. Skip restricted internal Chrome pages (like chrome://extensions)
  if (!tab.url || tab.url.startsWith('chrome://')) {
    console.warn('Cannot track internal chrome:// pages.');
    return;
  }

  try {
    // 2. Save the source tab data securely
    await chrome.storage.local.set({ 
      sourceTabId: tab.id, 
      sourceTabUrl: tab.url 
    });

    // 3. Prevent duplicates: Check if dashboard is already open
    const targetUrl = chrome.runtime.getURL('dashboard.html');
    const existingTabs = await chrome.tabs.query({ url: targetUrl });

    if (existingTabs.length > 0) {
      // If it exists, just bring it to the front instead of opening a new one
      await chrome.tabs.update(existingTabs[0].id, { active: true });
    } else {
      // If it does not exist, create it
      await chrome.tabs.create({ url: targetUrl });
    }
  } catch (error) {
    console.error('Extension error:', error);
  }
});