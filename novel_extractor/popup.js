document.getElementById("extract").addEventListener("click", () => doDownload())

function doDownload() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = new URL(tabs[0].url);
      if (!url.hostname.includes("novel18.syosetu.com")) {
          alert("請在 Syosetu 小說網站使用此擴充功能！");
          return;
      }

      chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: extractAndDownload
      });
  });
}

doDownload()

function extractAndDownload() {
  const novelDiv = document.querySelector(".p-novel__body");
  if (!novelDiv) {
      alert("Cannot find .p-novel__body");
      return;
  }

  // 獲取網頁標題作為檔名
  const title = document.title.trim().replace(/[\/:*?"<>|]/g, ""); // 移除非法字元
  const pageUrl = document.location.href;
  const lastDir = pageUrl.split('/').filter(Boolean).pop(); 
  const strIndex = lastDir.padStart(3, '0'); 
  const filename = strIndex + '_' + title + ".xml";
  console.log(filename)

  // 保留 HTML 結構
  const xmlContent = novelDiv.outerHTML;

  // 轉為 Blob 並下載
  const blob = new Blob([xmlContent], { type: "text/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
