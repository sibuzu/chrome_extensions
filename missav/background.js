const panelStates = new Map();

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  const isOpen = panelStates.get(tab.windowId) || false;
  console.log('[Background] Icon clicked. Current panel state:', isOpen);
  
  try {
    if (isOpen) {
      chrome.runtime.sendMessage({ type: 'closePanel'});
      panelStates.set(tab.windowId, false);
      console.log('[Background] Side panel closed');
    } else {
      await chrome.sidePanel.open({ windowId: tab.windowId});
      panelStates.set(tab.windowId, true);
      console.log('[Background] Side panel opened');
    }
  } catch (error) {
    console.error('[Background] Error toggling side panel:', error);
  }
});
