
console.log('[Content] Script loaded');

function checkVideoSources() {
  console.log('[Content] Checking video sources');
  try {
    // 收集頁面信息
    const pageInfo = {
      title: document.querySelector('title')?.textContent || '',
      url: document.querySelector('meta[property="og:url"]')?.content || window.location.href,
      image: document.querySelector('meta[property="og:image"]')?.content || '',
      description: document.querySelector('meta[property="og:description"]')?.content || ''
    };

    console.log('[Content] Page info:', pageInfo);

    // 發送到 sidepanel
    chrome.runtime.sendMessage({
      type: 'pageInfo',
      data: pageInfo
    });

  } catch (error) {
    console.error('[Content] Error in checkVideoSources:', error);
  }
}

// 解密函數的直接實現
const decrypt = (p, a, c, k, e, d) => {
  e = function (c) { return c.toString(36) };
  if (!''.replace(/^/, String)) {
    while (c--) {
      d[c.toString(a)] = k[c] || c.toString(a)
    }
    k = [function (e) { return d[e] }];
    e = function () { return '\\w+' };
    c = 1
  };
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + e(c) + '\\b', 'g'), k[c])
    }
  }
  return p
};

// 監聽來自 sidepanel 的請求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Message received:', request);

  let videoSource = '';
  if (request.type === 'getPageInfo') {
    checkVideoSources();
    sendResponse({ status: 'checking' });
  } else if (request.type === 'getVideoSource') {
    try {
      // 從頁面源碼中找到加密的字串
      const scripts = document.getElementsByTagName('script');
      
      for (const script of scripts) {
        const content = script.textContent || '';
        // 找出包含 eval 的那一行
        const evalLine = content.split('\n').find(line => line.includes('eval'));
        if (evalLine) {
          console.log('[Content] Found eval line:', evalLine);
          
          // 第一步：匹配整個函數調用的參數部分
          const paramsMatch = evalLine.match(/\(([^)]+)\)/g);
          if (paramsMatch && paramsMatch.length >= 2) {
            // 取得最後一組參數（通常是第二組）
            const params = paramsMatch[paramsMatch.length - 1];
            console.log('[Content] Found params:', params);
            
            // 第二步：解析參數
            const paramValues = params.match(/\('((?:[^'\\]|\\.)+)',(\d+),(\d+),'([^']+)'/);
            if (paramValues) {
              const [_, p, a, c, k] = paramValues;
              console.log('[Content] Parsed values:', { p, a, c, k });
              
              // 直接使用解密函數
              const result = decrypt(p, parseInt(a), parseInt(c), k.split('|'), 0, {});
              console.log('[Content] Decrypted result:', result);

              // 先嘗試匹配 source1280 的值
              const source1280Match = result.match(/source1280=\\'(https:\/\/[^']+)\\/);
              if (source1280Match) {
                videoSource = source1280Match[1];
                console.log('[Content] Found video source from source1280:', videoSource);
              } else {
                // 如果找不到 source1280，嘗試直接匹配 URL
                const urlMatch = result.match(/https:\/\/[^']+\/video\.m3u8/);
                if (urlMatch) {
                  videoSource = urlMatch[0];
                  console.log('[Content] Found video source from URL:', videoSource);
                } else {
                  console.log('[Content] No video source found');
                }
              }
            } else {
              console.log('[Content] Failed to parse parameters:', params);
            }
          } else {
            console.log('[Content] No parameters found in eval line');
          }
        }
      }
    } catch (error) {
      console.error('[Content] Error in decrypt:', error);
    }

    const pageInfo = {
      title: document.querySelector('title')?.textContent || '',
      url: document.querySelector('meta[property="og:url"]')?.content || window.location.href,
      image: document.querySelector('meta[property="og:image"]')?.content || '',
      description: document.querySelector('meta[property="og:description"]')?.content || '',
      source: videoSource
    };

    chrome.runtime.sendMessage({
      type: 'videoSource',
      data: pageInfo
    });

    sendResponse({ status: 'checking' });
  }
});

// 初始化時執行檢查
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  checkVideoSources();
} else {
  document.addEventListener('DOMContentLoaded', checkVideoSources);
}
