"use strict";
(self["webpackChunkyoutube_subtitles_extension"] = self["webpackChunkyoutube_subtitles_extension"] || []).push([["lib_proxyTranscriptFetcher_js"],{

/***/ "./lib/proxyTranscriptFetcher.js":
/*!***************************************!*\
  !*** ./lib/proxyTranscriptFetcher.js ***!
  \***************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fetchProxySRT: () => (/* binding */ fetchProxySRT),
/* harmony export */   parseSRTContent: () => (/* binding */ parseSRTContent)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config.js */ "./lib/config.js");
/**
 * Proxy SRT Transcript Fetcher
 * Handles fetching SRT content from the proxy server when native captions are not available
 */



/**
 * Fetches SRT content from the proxy server
 * @param {string} videoId - YouTube video ID
 * @param {string} language - Preferred language code (e.g., 'zh-tw')
 * @returns {Promise<Object>} - Object containing SRT content and metadata
 */
async function fetchProxySRT(videoId, language = 'zh-tw') {
  try {
    console.log('[ProxyFetcher] Fetching SRT for video:', videoId, 'language:', language);

    // Get the SRT provider URL from user configuration
    const srtProvider = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getSrtProvider();
    if (!srtProvider) {
      console.error('[ProxyFetcher] No SRT provider configured');
      throw new Error('No SRT provider configured. Please configure an SRT provider in the extension settings.');
    }

    // Remove trailing slash from srtProvider if present to prevent double slashes
    const baseUrl = srtProvider.endsWith('/') ? srtProvider.slice(0, -1) : srtProvider;

    // Construct the URL with the correct format - always use "default" as the language code
    const proxyUrl = `${baseUrl}/srt/${videoId}/default/${videoId}.srt`;
    console.log('[ProxyFetcher] Fetching SRT from proxy:', {
      videoId,
      language: 'default',
      // Always using default language code
      proxyUrl
    });

    // Check if we have permission to access the proxy domain
    const hasPermission = await new Promise(resolve => {
      chrome.permissions.contains({
        origins: [`${baseUrl}/*`]
      }, result => {
        console.log('[ProxyFetcher] Permission check result:', result);
        resolve(result);
      });
    });
    console.log('[ProxyFetcher] Permission check result:', hasPermission);
    if (!hasPermission) {
      console.warn('[ProxyFetcher] No permission for proxy domain, attempting fetch anyway');
      // We'll try to fetch anyway, but it might fail due to CORS
    }

    // Send a message to the background script to perform the fetch
    console.log('[ProxyFetcher] Starting fetch request via background script:', proxyUrl);
    try {
      const transcriptContent = await new Promise((resolve, reject) => {
        const startTime = Date.now();
        console.log('[ProxyFetcher] Sending message to background script', {
          type: 'FETCH_PROXY_SRT',
          url: proxyUrl,
          videoId,
          language: 'default',
          // Always using default language code
          timestamp: startTime
        });
        chrome.runtime.sendMessage({
          type: 'FETCH_PROXY_SRT',
          url: proxyUrl,
          videoId,
          language: 'default',
          // Always using default language code
          timestamp: startTime
        }, response => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          // Log the entire response for debugging
          console.log('[ProxyFetcher] Raw response from background script:', response);
          console.log('[ProxyFetcher] Received response from background script', {
            success: response?.success,
            hasTranscript: !!response?.transcript,
            hasData: !!response?.data,
            hasError: !!response?.error,
            responseTime: `${responseTime}ms`
          });
          if (chrome.runtime.lastError) {
            console.error('[ProxyFetcher] Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(`Failed to send message to background script: ${chrome.runtime.lastError.message}`));
            return;
          }
          if (!response) {
            console.error('[ProxyFetcher] No response received from background script');
            reject(new Error('No response from background script'));
            return;
          }
          if (response.error) {
            console.error('[ProxyFetcher] Background fetch failed:', response.error);

            // If this is a permission error, we need to request permission
            if (response.error.includes('Permission denied')) {
              reject(new Error('Permission denied for accessing the proxy server. ' + 'Please enable access to the proxy server in the extension settings.'));
              return;
            }
            reject(new Error(response.error));
            return;
          }

          // Extract the transcript content from the response
          // Check for both 'transcript' and 'data' properties for backward compatibility
          let transcriptContent = null;
          if (response.transcript) {
            transcriptContent = response.transcript;
            console.log('[ProxyFetcher] Found transcript property in response, length:', response.transcript.length);
          } else if (response.data) {
            transcriptContent = response.data;
            console.log('[ProxyFetcher] Found data property in response, length:', response.data.length);
          }
          if (!transcriptContent) {
            console.error('[ProxyFetcher] Response missing transcript content:', response);
            reject(new Error('Response from background script is missing transcript data'));
            return;
          }
          console.log('[ProxyFetcher] Successfully received SRT content from background script, length: ' + transcriptContent.length);
          resolve(transcriptContent);
        });
      });
      return transcriptContent;
    } catch (error) {
      console.error('[ProxyFetcher] Background fetch failed:', error);
      throw error;
    }
  } catch (error) {
    console.error('[ProxyFetcher] Background fetch failed:', error);
    throw error;
  }
}

/**
 * Parses SRT content into the requested format
 * @param {string} srtContent - Raw SRT content
 * @param {string} format - Format to return ('text', 'srt', or 'json')
 * @returns {string} - Formatted transcript content
 */
function parseSRTContent(srtContent, format = 'text') {
  if (!srtContent) {
    return '<div class="no-transcript">No transcript available</div>';
  }

  // If the format is 'srt', just return the original content
  if (format === 'srt') {
    return srtContent;
  }
  const segments = [];
  const srtBlocks = srtContent.trim().split(/\r?\n\r?\n/);
  for (const block of srtBlocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) continue;

    // Parse the timestamp line (format: 00:00:00,000 --> 00:00:00,000)
    const timestampLine = lines[1];
    const timestampMatch = timestampLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timestampMatch) continue;

    // Convert timestamp to seconds for JSON format
    const startHours = parseInt(timestampMatch[1], 10);
    const startMinutes = parseInt(timestampMatch[2], 10);
    const startSeconds = parseInt(timestampMatch[3], 10);
    const startMilliseconds = parseInt(timestampMatch[4], 10);
    const endHours = parseInt(timestampMatch[5], 10);
    const endMinutes = parseInt(timestampMatch[6], 10);
    const endSeconds = parseInt(timestampMatch[7], 10);
    const endMilliseconds = parseInt(timestampMatch[8], 10);
    const startTime = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
    const endTime = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;

    // Get the text content (could be multiple lines)
    const text = lines.slice(2).join(' ');
    if (format === 'json') {
      segments.push({
        start: parseFloat(startTime.toFixed(2)),
        duration: parseFloat((endTime - startTime).toFixed(2)),
        text: text
      });
    } else {
      // For text format, just push the text
      segments.push(text);
    }
  }

  // Handle different formats
  if (format === 'json') {
    // Return JSON string for JSON format
    return JSON.stringify(segments, null, 2);
  } else {
    // For text format, join all text segments with a space for compactness
    if (segments.length === 0) {
      return '<div class="no-transcript">No transcript segments found</div>';
    }

    // Join all text segments with a space (not line breaks) to make it compact
    // This matches how native CC handles text formatting
    return segments.join(' ').trim();
  }
}

/***/ })

}]);
//# sourceMappingURL=lib_proxyTranscriptFetcher_js.js.map