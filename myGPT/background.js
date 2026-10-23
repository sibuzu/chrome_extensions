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

// Create context menu
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.contextMenus.create({
      id: "askGPT",
      title: "Ask GPT: %s",
      contexts: ["selection"]
    });
    console.log('[Background] Context menu created successfully');
  } catch (error) {
    console.error('[Background] Error creating context menu:', error);
  }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "askGPT") {
    console.log('[Background] Context menu clicked with text:', info.selectionText);
    const selectedText = info.selectionText;
    
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      panelStates.set(tab.windowId, true);
      console.log('[Background] Side panel opened from context menu');

      // Send selected text to side panel
      // 使用 Promise 和 setTimeout
      await new Promise(resolve => setTimeout(resolve, 500));
      await chrome.runtime.sendMessage({
        type: 'selectedText',
        text: selectedText
      });
      console.log('[Background] Selected text sent to side panel');
    } catch (error) {
      console.error('[Background] Error handling context menu click:', error);
    }
  }
});

// 確保內容腳本已加載
async function ensureContentScriptInjected(tabId) {
  try {
    // 檢查當前頁面的 URL
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url;

    // 只在 ChatGPT 相關頁面注入腳本
    if (/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url || '')) {
      // 先檢查腳本是否已經注入
      try {
        const result = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
        if (!result?.ok || result.version !== chrome.runtime.getManifest().version) {
          throw new Error('Content script version is outdated');
        }
        console.log('[Background] Content script already exists');
      } catch (error) {
        // 如果收到錯誤回應，表示腳本尚未注入，這時才注入
        console.log('[Background] Injecting content script...');
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        console.log('[Background] Content script injected successfully');
      }
    } else {
      throw new Error('Open a ChatGPT conversation first');
    }
    return { ok: true };
  } catch (error) {
    console.error('[Background] Error in ensureContentScriptInjected:', error);
    return { ok: false, error: error.message };
  }
}

// 監聽標籤頁更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    ensureContentScriptInjected(tabId);
  }
});

// 處理來自 sidepanel 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'ensureContentScript') return;
  (async () => {
    const tabId = request.tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (tabId == null) throw new Error('No active ChatGPT tab');
    return ensureContentScriptInjected(tabId);
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
