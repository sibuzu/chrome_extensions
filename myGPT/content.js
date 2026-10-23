// ChatGPT updates composer button ids/testids often. Prefer stable composer
// structure and accessible labels, with data-testid as a fast path when present.
(() => {
// Reinjection after an extension update must not leave duplicate observers.
try { window.__myGPTContentController?.dispose(); } catch (_) {
  // A controller from before an extension reload may have an invalid runtime.
}

const SELECTORS = {
  composer: 'form[data-chatgpt-composer], form[data-thread-find-composer], [data-composer-surface="true"]',
  prompt: [
    '#prompt-textarea',
    'textarea[name="prompt-textarea"]',
    '[data-chatgpt-composer] [contenteditable="true"][role="textbox"]',
    '[data-thread-find-composer] [contenteditable="true"][role="textbox"]',
    '[contenteditable="true"][data-composer-markdown]'
  ].join(', '),
  trailing: '[data-composer-surface="true"] [data-composer-transition-slot="trailing"]',
  sendButton: [
    'button#composer-submit-button',
    'button[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button[aria-label*="傳送"]',
    'button[aria-label*="送出"]',
    'button[aria-label*="發送"]',
    'button[aria-label*="发送"]'
  ].join(', '),
  voiceButton: [
    'button[data-testid="composer-speech-button"]',
    'button[aria-label*="voice" i]',
    'button[aria-label*="語音"]',
    'button[aria-label*="语音"]',
    'button[aria-label*="聽寫"]',
    'button[aria-label*="听写"]'
  ].join(', '),
  stopButton: [
    'button[data-testid="stop-button"]',
    'button[aria-label*="Stop"]',
    'button[aria-label*="停止"]'
  ].join(', ')
};

function isVisible(element) {
  if (!element) return false;
  return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

function queryVisible(selector, root = document) {
  return Array.from(root.querySelectorAll(selector)).find(isVisible);
}

function getComposerRoot() {
  return getPromptInput()?.closest(SELECTORS.composer) || queryVisible(SELECTORS.composer) || document;
}

function getPromptInput() {
  return queryVisible(SELECTORS.prompt);
}

function getTrailingActionRoot() {
  const composer = getComposerRoot();
  return queryVisible(SELECTORS.trailing, composer) || composer;
}

function isEnabledButton(button) {
  return isVisible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
}

function isVoiceActionButton(button) {
  const ariaLabel = button.getAttribute('aria-label') || '';
  const iconHref = button.querySelector('use')?.getAttribute('href') || '';
  return /voice|語音|语音|聽寫|听写/i.test(ariaLabel) || /#(?:voice|microphone)-/i.test(iconHref);
}

function getReadySendButton() {
  const trailing = getTrailingActionRoot();
  const labelledSendButton = Array.from(trailing.querySelectorAll(SELECTORS.sendButton))
    .find(isEnabledButton);
  if (labelledSendButton) return labelledSendButton;

  // The current ChatGPT composer reuses its last circular action button and
  // does not always add send-button/testid when it changes from voice to send.
  return Array.from(trailing.querySelectorAll([
    'button.composer-submit-button-color',
    'button[type="submit"]',
    'button[data-testid*="send"]',
    'button:has(use[href*="#arrow-up-"])'
  ].join(', ')))
    .reverse()
    .find(button => isEnabledButton(button) && !isVoiceActionButton(button));
}

function hasRunningStopButton() {
  return Boolean(queryVisible(SELECTORS.stopButton));
}

function getCurrentState() {
  if (hasRunningStopButton()) return 'running';
  const prompt = getPromptInput();
  if (!prompt || prompt.disabled || prompt.getAttribute('aria-disabled') === 'true' ||
      prompt.getAttribute('contenteditable') === 'false') return 'not-found';
  if ((prompt.value ?? prompt.innerText ?? '').trim() || getReadySendButton()) {
    return 'ready-to-send';
  }
  // Empty, usable editor + no stop button is idle. Voice/dictation buttons
  // are optional and can change or disappear without changing this state.
  return 'input-mode';
}

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

function logComposerButtons() {
  const composer = getComposerRoot();
  const buttons = composer.querySelectorAll('button');
  console.log('[Contents] Composer buttons found:');
  buttons.forEach(button => {
    console.log('[Contents] - button', {
      testId: button.getAttribute('data-testid'),
      ariaLabel: button.getAttribute('aria-label'),
      disabled: button.disabled,
      className: button.className
    });
  });
}

// 檢查當前狀態
function checkState() {
  const state = getCurrentState();
  // The panel also queries directly; do not flood it during streaming.
  if (state === lastReportedState) return;
  lastReportedState = state;
  chrome.runtime.sendMessage({ type: 'stateChange', state,
    version: chrome.runtime.getManifest().version }).catch(() => {});
}

let lastReportedState = null;

// 設置 MutationObserver
const observer = new MutationObserver((mutations) => {
  // console.log('[Contents] DOM mutation detected');
  checkState();
});

// 開始觀察
function startObserving() {
  console.log('[Contents] Starting observation...');
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ['class', 'disabled', 'aria-disabled', 'aria-label', 'data-testid', 'href', 'contenteditable', 'hidden', 'style']
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

async function insertTextIntoPrompt(promptElement, text) {
  const normalizedText = text.replace(/\r\n?/g, '\n').trim();
  if (!normalizedText) return;

  window.focus();
  promptElement.focus();
  await new Promise(resolve => setTimeout(resolve, 100));

  const lines = normalizedText.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) {
      const insertedBreak = document.execCommand('insertLineBreak') || document.execCommand('insertParagraph');
      if (!insertedBreak) {
        throw new Error(`Could not insert line break before line ${index + 1}`);
      }
    }
    if (line) {
      const insertedText = document.execCommand('insertText', false, line);
      if (!insertedText) {
        throw new Error(`Could not insert text on line ${index + 1}`);
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 150));

  const promptText = ('value' in promptElement ? promptElement.value : promptElement.innerText || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ');
  const expectedLines = lines.map(line => line.trim()).filter(Boolean);
  let searchFrom = 0;
  const hasEveryLine = expectedLines.every(line => {
    const lineIndex = promptText.indexOf(line, searchFrom);
    if (lineIndex === -1) return false;
    searchFrom = lineIndex + line.length;
    return true;
  });

  if (!hasEveryLine) {
    throw new Error('Prompt insertion was incomplete; message was not sent');
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read image data'));
    reader.readAsDataURL(blob);
  });
}

async function loadImageData(item) {
  try {
    const response = await fetch(item.src, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return {
      ...item,
      data: await blobToDataURL(await response.blob())
    };
  } catch (error) {
    console.error(`[Contents] Could not load image for turn ${item.turnId}:`, error);
    return {
      ...item,
      error: error.message
    };
  }
}

// 監聽來自 sidepanel 的消息
function onContentMessage(request, sender, sendResponse) {
  if (request.type === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return;
  }
  if (request.type === 'queryState') {
    sendResponse({ ok: true, state: getCurrentState(), version: chrome.runtime.getManifest().version });
    return;
  }
  if (request.type !== 'queryImageList' && request.action !== 'sendMsg') return;

  handleContentMessage(request).then(sendResponse).catch(error => {
    console.error('[Contents] Error processing message:', error);
    sendResponse({ ok: false, error: error.message });
  });
  // Keep the message channel open until sending succeeds or fails.
  return true;
}

chrome.runtime.onMessage.addListener(onContentMessage);
window.__myGPTContentController = {
  dispose() {
    observer.disconnect();
    document.removeEventListener('DOMContentLoaded', startObserving);
    chrome.runtime.onMessage.removeListener(onContentMessage);
  }
};

async function handleContentMessage(request) {
  if (request.type === 'queryImageList') {
    console.log('[Contents] Querying image list...');
    const imageList = [];
    let latestUserPrompt = '';
    
    // 查找所有對話回合
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    
    turns.forEach(turn => {
      const userMessage = turn.querySelector('[data-message-author-role="user"]');
      if (userMessage) {
        const promptElement = userMessage.querySelector('.whitespace-pre-wrap') || userMessage;
        latestUserPrompt = promptElement.innerText.trim();
      }

      // 獲取 turnId
      console.log('[Contents] Turn:', turn);
      const turnId = turn.getAttribute('data-testid').replace('conversation-turn-', '');
      
      // 查找所有圖片容器
      const imageContainers = turn.querySelectorAll('.group\\/imagegen-image');
      imageContainers.forEach((imageContainer, index) => {
        // 決定後綴
        const postfix = index === 0 ? '' : String.fromCharCode(97 + index); // '' for first, 'b', 'c', ... for others
        
        // 查找第一個圖片元素
        const img = imageContainer.querySelector('img');
        if (img) {
          imageList.push({
            turnId: turnId + postfix,
            src: img.src,
            prompt: latestUserPrompt
          });
        }
      });
    });
    
    const imagesWithData = await Promise.all(imageList.map(loadImageData));

    // 發送結果回 sidepanel
    chrome.runtime.sendMessage({
      type: 'imageList',
      list: imagesWithData
    });
  } else if (request.action === 'sendMsg') {
    console.log('[Contents] Sending GPT message:', request.text);
    
    // 找到 ChatGPT 的輸入框
    const promptTextarea = getPromptInput();
    if (!promptTextarea) throw new Error('ChatGPT prompt input was not found');
    if (hasRunningStopButton()) throw new Error('ChatGPT is still responding');
    if ((promptTextarea.value ?? promptTextarea.innerText ?? '').trim()) {
      throw new Error('Clear the existing ChatGPT draft before resuming the queue');
    }
    
    // 解析 markdown 格式的圖片
    const imageMatches = request.text.match(/!\[.*?\]\((.*?)\)\n/g);
    const textContent = request.text.replace(/!\[.*?\]\((.*?)\)\n/g, '');
    
    // 如果有圖片，先處理圖片
    if (imageMatches) {
      // 一次只處理一組圖片
      for (const imgMarkdown of imageMatches) {
        const imgUrl = imgMarkdown.match(/\((.*?)\)/)[1];
        
        console.log('[Contents] Processing image:', imgUrl.substring(0, 50) + '...');
        
        // 將 base64 圖片轉換為 blob
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        
        // 確保頁面和輸入框有焦點
        window.focus();
        promptTextarea.focus();
        
        // 等待焦點設置完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 嘗試插入圖片
        await insertImage(promptTextarea, blob);
        
        // 等待圖片插入完成
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // 處理文本內容
    if (textContent.trim()) {
      await insertTextIntoPrompt(promptTextarea, textContent);
    }
    
    // 觸發 input 事件以激活發送按鈕
    promptTextarea.dispatchEvent(new Event('input', { 
      bubbles: true,
      cancelable: true 
    }));
    
    // 等待發送按鈕變為可用並點擊
    await waitForAndClickSendButton(imageMatches ? 40 : 10);
    
    return { ok: true, state: getCurrentState() };
  }
}
// 添加必要的輔助函數
function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
}

async function insertImage(textarea, blob) {
  try {
    // 使用 input event 直接插入檔案
    const file = new File([blob], 'image.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste',
      data: null,
      dataTransfer: dt
    });
    
    textarea.dispatchEvent(inputEvent);
    
    // 如果上面的方法失敗，嘗試使用 drop 事件
    if (!textarea.querySelector('img')) {
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });
      textarea.dispatchEvent(dropEvent);
    }
  } catch (error) {
    console.error('[Contents] Image insertion failed:', error);
    // 備用方案：使用 FormData
    const formData = new FormData();
    formData.append('image', blob, 'image.png');
    textarea.dispatchEvent(new CustomEvent('imageUpload', {
      detail: { formData: formData }
    }));
  }
}

async function waitForAndClickSendButton(maxAttempts) {
  for (let attempts = 0; attempts <= maxAttempts; attempts++) {
    const sendButton = getReadySendButton();
    if (sendButton) {
      console.log('[Contents] Send button is ready:', {
        testId: sendButton.getAttribute('data-testid'),
        ariaLabel: sendButton.getAttribute('aria-label'),
        className: sendButton.className
      });
      const prompt = getPromptInput();
      const hadText = Boolean((prompt?.value ?? prompt?.innerText ?? '').trim());
      sendButton.focus();
      sendButton.click();
      // A click alone is not an acknowledgement. Keep the queue item if
      // ChatGPT leaves the draft in place without starting a response.
      for (let attempt = 0; attempt < 100; attempt++) {
        const currentPrompt = getPromptInput();
        if (hasRunningStopButton() || (hadText && currentPrompt &&
            !(currentPrompt.value ?? currentPrompt.innerText ?? '').trim())) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('ChatGPT did not confirm message submission; queue item was kept');
    } else if (attempts >= maxAttempts) {
      logComposerButtons();
      throw new Error(`Timeout waiting for send button after ${maxAttempts * 2000}ms`);
    } else {
      console.log('[Contents] Waiting for send button... attempt:', attempts + 1, 
                 `(${attempts * 2000}ms / ${maxAttempts * 2000}ms)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
})();
