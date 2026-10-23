const API_URL = 'http://solarsuna.com:32345';

document.addEventListener('DOMContentLoaded', function () {
  // Initialize SVG icons
  const template = document.getElementById('toggle-icon-template');
  document.querySelectorAll('.toggle-icon-container').forEach(container => {
    const clone = template.content.cloneNode(true);
    const svg = clone.querySelector('svg');
    const vLine = clone.querySelector('#v-line');

    if (container.dataset.state === 'open') {
      vLine.style.display = 'none';
    }

    container.appendChild(clone);
  });

  // 初始化可折疊面板
  const headers = document.querySelectorAll('.panel-header');
  headers.forEach(header => {
    header.addEventListener('click', function () {
      const content = this.nextElementSibling;
      const icon = this.querySelector('.toggle-icon');
      const verticalLine = icon.querySelector('#v-line');
      const isOpen = content.style.display === 'block';

      content.style.display = isOpen ? 'none' : 'block';

      if (isOpen) {
        verticalLine.style.display = 'block';
        icon.setAttribute('data-state', 'closed');
      } else {
        verticalLine.style.display = 'none';
        icon.setAttribute('data-state', 'open');
      }
    });
  });

  // 更新頁面信息的函數
  function updatePageInfo(info) {
    document.getElementById('title').textContent = `Title: ${info.title}`;
    document.getElementById('url').textContent = `URL: ${info.url}`;
    document.getElementById('image').textContent = `Image: ${info.image}`;
    document.getElementById('description').textContent = `Description: ${info.description}`;
  }

  // 請求當前頁面信息
  async function requestPageInfo() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, { type: 'getPageInfo' });
      }
    } catch (error) {
      console.error('[Sidepanel] Error requesting page info:', error);
    }
  }

  // 監聽來自 content script 的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Sidepanel] Received message:', request);

    if (request.type === 'pageInfo') {
      updatePageInfo(request.data);
    }
  });

  // 初始化時請求頁面信息
  requestPageInfo();

  // 獲取必要的 DOM 元素
  const downloadVideoButton = document.getElementById('downloadVideo');
  const taskStatusElement = document.getElementById('taskMessage');
  const sourceElement = document.getElementById('source');
  const queryVideoButton = document.getElementById('queryVideo');
  const listVideoElement = document.getElementById('listVideo');
  const queueStatsElement = document.getElementById('queueStats');

  // 所有狀態的圖示模板
  const downloadIconTemplate = document.getElementById('download-icon-template');
  const queueIconTemplate = document.getElementById('queue-icon-template');
  const completedIconTemplate = document.getElementById('completed-icon-template');
  const defaultIconTemplate = document.getElementById('default-icon-template');

  function getStatusIcon(status) {
    switch (status) {
      case 'downloading':
        return downloadIconTemplate.content.cloneNode(true);
      case 'queued':
        return queueIconTemplate.content.cloneNode(true);
      case 'completed':
        return completedIconTemplate.content.cloneNode(true);
      default:
        return defaultIconTemplate.content.cloneNode(true);
    }
  }

  // Download Video button click handler
  downloadVideoButton.addEventListener('click', async function () {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        sourceElement.textContent = 'Source: searching...';

        // 發送請求到 content script
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'getVideoSource'
        });
      }
    } catch (error) {
      console.error('[Sidepanel] Error in download handler:', error);
      taskStatusElement.textContent = 'Status: Error occurred';
      sourceElement.textContent = 'Source: error';
    }
  });

  // Query Video button click handler
  queryVideoButton.addEventListener('click', async function () {
    try {
      const response = await fetch(`${API_URL}/missav/queue`);
      const data = await response.json();
      updateQueueList(data);
    } catch (error) {
      console.error('[Sidepanel] Error querying video list:', error);
      listVideoElement.innerHTML = 'Error loading queue data';
    }
  });

  function updateQueueList(data) {
    // 更新統計資訊
    queueStatsElement.innerHTML = `
      Downloading: ${data.stats.downloading} | 
      Queued: ${data.stats.queued} | 
      Completed (24h): ${data.stats.completed_24h} | 
      Total: ${data.stats.total}
    `;

    // 建立表格
    const table = document.createElement('table');

    // 表頭
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Status</th>
        <th>Progress</th>
      </tr>
    `;
    table.appendChild(thead);

    // 表格內容
    const tbody = document.createElement('tbody');
    data.queue.forEach(item => {
      const tr = document.createElement('tr');

      // ID 欄位
      const tdId = document.createElement('td');
      tdId.textContent = item.task_id;

      // Status 欄位
      const tdStatus = document.createElement('td');
      const statusIcon = getStatusIcon(item.status);
      tdStatus.appendChild(statusIcon);
      tdStatus.classList.add(item.status);

      // Progress 欄位 - 改為文字顯示
      const tdProgress = document.createElement('td');
      tdProgress.className = 'progress-text';
      const progress = item.status === 'completed' ? 100 : item.progress;
      tdProgress.textContent = progress.toFixed(1) + '%';

      tr.appendChild(tdId);
      tr.appendChild(tdStatus);
      tr.appendChild(tdProgress);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // 清空並更新列表內容
    listVideoElement.innerHTML = '';
    listVideoElement.appendChild(table);
  }

  // 監聽來自 content script 的消息
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log('[Sidepanel] Received message:', request);

    switch (request.type) {
      case 'pageInfo':
        updatePageInfo(request.data);
        break;
      
      case 'videoSource':
        let info = request.data;
        if (info && info.source) {
          taskStatusElement.textContent = 'Status: source found';
          sourceElement.textContent = `Source: ${info.source}`;
          await handleVideoDownload(info);
        } else {
          taskStatusElement.textContent = 'Status: no source found';
          sourceElement.textContent = 'Source: not available';
        }
        break;
      
      case 'closePanel':
        window.close();
        break;
    }
  });

  async function handleVideoDownload(info) {
    try {
      console.log('[Sidepanel] handleVideoDownload', info);
      taskStatusElement.textContent = 'Status: call API ...';

      const response = await fetch(`${API_URL}/missav/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info)
      });

      const result = await response.json();

      // 更新下載狀態資訊
      document.getElementById('taskId').textContent = `Task ID: ${result.task_id}`;
      document.getElementById('taskStatus').textContent = `Status: ${result.status}`;
      document.getElementById('taskMessage').textContent = `Message: ${result.message}`;

    } catch (error) {
      taskStatusElement.textContent = `Status: [API error] ${error.message}`;
      document.getElementById('taskId').textContent = 'Task ID: -';
      document.getElementById('taskStatus').textContent = 'Status: error';
      document.getElementById('taskMessage').textContent = `Message: ${error.message}`;
    }
  }
});
