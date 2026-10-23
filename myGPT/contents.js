// 定義狀態和對應的選擇器
const STATE_SELECTORS = {
  'waiting': 'button[data-testid="send-button"][disabled], button[data-testid="composer-speech-button"]',
  'ready-to-send': 'button[data-testid="send-button"]:not([disabled])',
  'running': 'button[data-testid="stop-button"]'
};

// 列出所有 data-testid
function logAllDataTestIds() {
  const elements = document.querySelectorAll('[data-testid]');
  console.log('[Contents] All data-testid elements found:');
  elements.forEach(element => {
    let attr = element.getAttribute('data-testid');
    console.log(`[Contents] - ${attr}`);
    if (attr === 'composer-speech-button') {
      console.log('[Contents] Found composer-speech-button element:', element);
      console.log('[Contents] Voice button HTML:', element.outerHTML);
    }
  });
}

// 檢查當前狀態
function checkState() {
  console.log('[Contents] Checking state...');

  for (const [state, selector] of Object.entries(STATE_SELECTORS)) {
    if (document.querySelector(selector)) {
      console.log('[Contents] Current state:', state);
      chrome.runtime.sendMessage({
        type: 'stateChange',
        state: state
      });
      return;
    }
  }

  // 如果都沒找到，則為 not-found
  console.log('[Contents] Current state: not-found');
  logAllDataTestIds(); // 當狀態是 not-found 時列出所有 data-testid
  chrome.runtime.sendMessage({
    type: 'stateChange',
    state: 'not-found'
  });
}

// 設置 MutationObserver
const observer = new MutationObserver((mutations) => {
  console.log('[Contents] DOM mutation detected');
  checkState();
});

// 開始觀察
function startObserving() {
  console.log('[Contents] Starting observation...');
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'disabled']
  });

  // 初始檢查
  checkState();
}

// 當 DOM 載入完成後開始觀察
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}

// 監聽來自 sidepanel 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'queryImageList') {
    console.log('[Contents] Querying image list...');
    const imageList = [];
    
    // 查找所有對話回合
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    
    turns.forEach(turn => {
      // 獲取 turnId
      console.log('[Contents] Turn:', turn);
      const turnId = turn.getAttribute('data-testid').replace('conversation-turn-', '');
      
      // 查找圖片容器
      const imageContainer = turn.querySelector('.group\\/imagegen-image');
      if (imageContainer) {
        // 查找第一個圖片元素
        const img = imageContainer.querySelector('img');
        if (img) {
          imageList.push({
            turnId: turnId,
            src: img.src
          });
        }
      }
    });
    
    // 發送結果回 sidepanel
    chrome.runtime.sendMessage({
      type: 'imageList',
      list: imageList
    });
  }
});
