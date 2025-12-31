/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./lib/config.js":
/*!***********************!*\
  !*** ./lib/config.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   API_CONFIG: () => (/* binding */ API_CONFIG),
/* harmony export */   CURRENT_CONFIG_VERSION: () => (/* binding */ CURRENT_CONFIG_VERSION),
/* harmony export */   Config: () => (/* binding */ Config),
/* harmony export */   DEFAULT_FONT_SIZE: () => (/* binding */ DEFAULT_FONT_SIZE),
/* harmony export */   DEFAULT_SRT_PROVIDER: () => (/* binding */ DEFAULT_SRT_PROVIDER),
/* harmony export */   FONT_SIZES: () => (/* binding */ FONT_SIZES),
/* harmony export */   SUBTITLES_CONFIG: () => (/* binding */ SUBTITLES_CONFIG),
/* harmony export */   SUPPORTED_LANGUAGES: () => (/* binding */ SUPPORTED_LANGUAGES),
/* harmony export */   forceLiveCaptionsDisabled: () => (/* binding */ forceLiveCaptionsDisabled),
/* harmony export */   toggleLiveCaptions: () => (/* binding */ toggleLiveCaptions)
/* harmony export */ });
/**
 * Configuration for the Chrome extension
 */

const isDev = chrome.runtime.getManifest().version.includes('-dev') || location.hostname === 'localhost' || chrome.runtime.id === 'efmnkbmjoghelgmbhigioddcidenphle';
if (isDev) {
  console.log('[Config] isDev:', isDev);
}

// Constants for configuration
const CURRENT_CONFIG_VERSION = '1.0';
const SUPPORTED_LANGUAGES = ['en', 'zh-cn', 'zh-tw', 'zh-hk', 'ko', 'ja', 'fr', 'es', 'th'];
const FONT_SIZES = [12, 14, 16, 18, 20];
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_SRT_PROVIDER = undefined;

// API configuration
const API_CONFIG = {
  // Use development URL when in dev mode
  BASE_URL: isDev ? 'http://127.0.0.1:3003' : 'https://worker.deepsrt.com',
  // BASE_URL: isDev ? 'https://preview.srt-client-proxy.pages.dev' : 'https://worker.deepsrt.com',
  // BASE_URL: isDev ? 'https://worker.deepsrt.com' : 'https://worker.deepsrt.com',

  ENDPOINTS: {
    TRANSCRIBE: '/transcribe',
    TRANSLATE: '/transcript',
    TRANSCRIPT: '/transcript',
    SUMMARIZE: '/transcript'
  }
};

// Subtitles configuration
const SUBTITLES_CONFIG = {
  BATCH_SIZE: 10,
  MAX_CONCURRENT_BATCHES: 3,
  UPDATE_INTERVAL: 100,
  ENABLE_LIVE_SUBTITLES: false,
  STYLES: {
    CONTAINER: {
      position: 'absolute',
      bottom: '60px',
      left: '0',
      right: '0',
      textAlign: 'center',
      zIndex: '1000',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '10px'
    },
    SUBTITLE_BLOCK: {
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      padding: '4px 10px',
      borderRadius: '4px',
      width: 'fit-content',
      margin: '0 auto'
    },
    ZH_TW: {
      fontSize: '25px',
      fontFamily: '"YouTube Noto", Roboto, Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
      color: 'white',
      textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
      marginBottom: '2px',
      display: 'block'
    },
    EN: {
      fontSize: '25px',
      fontFamily: '"YouTube Noto", Roboto, Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif',
      color: 'white',
      textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
      display: 'block'
    }
  }
};

// Helper functions
async function toggleLiveCaptions() {
  const currentState = await Config.getLiveCaptionsEnabled();
  const newState = !currentState;
  console.log('[Config] Toggling live captions from:', currentState, 'to:', newState);
  SUBTITLES_CONFIG.ENABLE_LIVE_SUBTITLES = newState;
  await Config.setLiveCaptionsEnabled(newState);

  // Notify content script
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'TOGGLE_CAPTIONS',
        enabled: newState
      });
    }
  });
  return newState;
}
function forceLiveCaptionsDisabled() {
  Config.setLiveCaptionsEnabled(false);
  return false;
}
class Config {
  static defaultPreferences = {
    version: CURRENT_CONFIG_VERSION,
    preferences: {
      language: {
        value: 'en',
        lastUpdated: Date.now()
      },
      liveCaptions: {
        value: false,
        lastUpdated: Date.now()
      },
      fontSize: {
        value: DEFAULT_FONT_SIZE,
        lastUpdated: Date.now(),
        allowedValues: FONT_SIZES
      },
      bulletList: {
        value: false,
        lastUpdated: Date.now()
      },
      srtProvider: {
        value: DEFAULT_SRT_PROVIDER,
        lastUpdated: Date.now()
      }
    }
  };
  static async get() {
    try {
      console.log('[Config] Getting configuration from storage');
      const {
        config
      } = await chrome.storage.local.get('config');
      console.log('[Config] Retrieved config from storage:', config);
      if (!config) {
        console.log('[Config] No configuration found, using default preferences');
        return this.defaultPreferences;
      }

      // Version check and migration
      if (config.version !== CURRENT_CONFIG_VERSION) {
        console.log('[Config] Config version mismatch, migrating');
        return this.migrateConfig(config);
      }

      // Check if srtProvider exists in the config
      if (!config.preferences.srtProvider) {
        console.log('[Config] SRT provider not found in config, adding default');
        config.preferences.srtProvider = {
          value: DEFAULT_SRT_PROVIDER,
          lastUpdated: Date.now()
        };
        await this.save(config);
      }
      return config;
    } catch (error) {
      console.error('[Config] Error getting configuration:', error);
      return this.defaultPreferences;
    }
  }
  static async save(config) {
    try {
      console.log('[Config] Saving configuration:', JSON.stringify(config));
      await chrome.storage.local.set({
        config
      });
      console.log('[Config] Configuration saved successfully');
      return config;
    } catch (error) {
      console.error('[Config] Error saving configuration:', error);
      throw error;
    }
  }
  static async initialize() {
    console.log('[Config] Initializing configuration');

    // Check if config already exists
    const {
      config
    } = await chrome.storage.local.get('config');
    if (!config) {
      console.log('[Config] No configuration found, creating default');
      // Create default configuration
      await this.save(this.defaultPreferences);
      return this.defaultPreferences;
    }

    // Check if any new preferences have been added since the last initialization
    let updated = false;

    // Check for missing preferences and add them with default values
    for (const key in this.defaultPreferences.preferences) {
      if (!config.preferences[key]) {
        console.log(`[Config] Adding missing preference: ${key}`);
        config.preferences[key] = this.defaultPreferences.preferences[key];
        updated = true;
      }
    }

    // If configuration was updated, save it
    if (updated) {
      console.log('[Config] Configuration updated with missing preferences, saving');
      await this.save(config);
    }
    return config;
  }
  static async migrateConfig(oldConfig) {
    console.log('[Config] Migrating from version:', oldConfig.version);

    // Create new config with current version
    const newConfig = {
      version: CURRENT_CONFIG_VERSION,
      preferences: {
        language: {
          value: oldConfig.preferredCaptionLanguage || 'en',
          lastUpdated: Date.now()
        },
        liveCaptions: {
          value: oldConfig.liveCaptionsEnabled || false,
          lastUpdated: Date.now()
        },
        fontSize: {
          value: parseInt(localStorage.getItem('summaryFontSize')) || DEFAULT_FONT_SIZE,
          lastUpdated: Date.now(),
          allowedValues: FONT_SIZES
        },
        bulletList: {
          value: oldConfig.bulletListEnabled || false,
          lastUpdated: Date.now()
        },
        srtProvider: {
          value: DEFAULT_SRT_PROVIDER,
          lastUpdated: Date.now()
        }
      }
    };
    await this.save(newConfig);
    return newConfig;
  }
  static async getPreferredLanguage() {
    const config = await this.get();
    return config.preferences.language.value;
  }
  static async setPreferredLanguage(lang) {
    const validLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
    const config = await this.get();
    config.preferences.language = {
      value: validLang,
      lastUpdated: Date.now()
    };
    await this.save(config);
    return validLang;
  }
  static async getLiveCaptionsEnabled() {
    const config = await this.get();
    return config.preferences.liveCaptions.value;
  }
  static async setLiveCaptionsEnabled(enabled) {
    const config = await this.get();
    config.preferences.liveCaptions = {
      value: !!enabled,
      lastUpdated: Date.now()
    };
    await this.save(config);
    return !!enabled;
  }
  static async getFontSize() {
    const config = await this.get();
    return config.preferences.fontSize.value;
  }
  static async setFontSize(size) {
    const validSize = FONT_SIZES.includes(size) ? size : DEFAULT_FONT_SIZE;
    const config = await this.get();
    config.preferences.fontSize = {
      value: validSize,
      lastUpdated: Date.now(),
      allowedValues: FONT_SIZES
    };
    await this.save(config);
    return validSize;
  }
  static async getBulletListEnabled() {
    const config = await this.get();
    return config.preferences.bulletList?.value ?? false;
  }
  static async setBulletListEnabled(enabled) {
    const config = await this.get();
    config.preferences.bulletList = {
      value: enabled,
      lastUpdated: Date.now()
    };
    await this.save(config);
    return enabled;
  }
  static async getSrtProvider() {
    try {
      const config = await this.get();
      console.log('[Config] Getting SRT provider from config:', config);

      // Check if srtProvider exists in the config
      if (!config.preferences.srtProvider) {
        console.log('[Config] SRT provider not found in config, returning default');
        return DEFAULT_SRT_PROVIDER;
      }
      console.log('[Config] Retrieved SRT provider value:', config.preferences.srtProvider.value);
      return config.preferences.srtProvider.value;
    } catch (error) {
      console.error('[Config] Error getting SRT provider:', error);
      return DEFAULT_SRT_PROVIDER;
    }
  }
  static async setSrtProvider(provider) {
    console.log('[Config] Setting SRT provider:', provider);
    const config = await this.get();
    console.log('[Config] Current config before update:', JSON.stringify(config));
    config.preferences.srtProvider = {
      value: provider,
      lastUpdated: Date.now()
    };
    console.log('[Config] Updated config before save:', JSON.stringify(config));
    await this.save(config);

    // Verify the save worked by reading it back
    const verifyConfig = await this.get();
    console.log('[Config] Verified config after save:', JSON.stringify(verifyConfig));
    return provider;
  }
}

/***/ }),

/***/ "./lib/errors.js":
/*!***********************!*\
  !*** ./lib/errors.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   YouTubeTranscriptError: () => (/* binding */ YouTubeTranscriptError),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/**
 * Custom error for YouTube transcript issues
 */
class YouTubeTranscriptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'YouTubeTranscriptError';
  }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (YouTubeTranscriptError);

/***/ }),

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ TranscriptFetcher)
/* harmony export */ });
/* harmony import */ var _errors_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./errors.js */ "./lib/errors.js");


/**
 * Fetches and formats YouTube video transcripts
 */
class TranscriptFetcher {
  constructor(playerData, videoId, options = {}) {
    // Initialize transcript fetcher
    this.session = null;
    this.pageHtml = options.pageHtml;
    this.playerData = playerData;
    this.videoId = videoId;
    this.preferredLanguage = options.language || 'en';
    this.cache = new Map();
    this.transcriptUrl = null; // Store the transcript URL
    this.transcriptArg = null;
    this.transcriptXML = null;
    console.log('[TranscriptFetcher] Initialized with:', {
      videoId,
      language: this.preferredLanguage
    });
  }

  /**
   * Parse YouTube XML subtitles into array format
   * @param {string} xml - The XML response from YouTube
   * @returns {Array} Array of transcript segments
   * @private
   */
  static parseYouTubeXML(xml) {
    // Extract text elements using regex
    const textElements = [];
    const regex = /<text start="([^"]+)"(?:\s+dur="([^"]+)")?>([^<]+)<\/text>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const start = parseFloat(match[1]);
      const duration = match[2] ? parseFloat(match[2]) : 0;
      const text = match[3].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'');
      textElements.push({
        start,
        duration,
        text
      });
    }
    return textElements;
  }

  // Get the arg part from the transcript URL
  getTranscriptArg() {
    console.log('[TranscriptFetcher] Getting transcript arg:', this.transcriptArg);
    return this.transcriptArg;
  }

  /**
   * Fetch transcript for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Array>} Transcript data
   */
  async fetchTranscript(videoId) {
    console.log('[TranscriptFetcher] Fetching transcript for video:', videoId);
    try {
      // Use player data if available
      if (this.playerData?.captions) {
        const captionsJson = this.playerData.captions.playerCaptionsTracklistRenderer;
        if (captionsJson) {
          console.debug('[TranscriptFetcher] Using player data captions');
          this.transcriptUrl = TranscriptFetcher._getTranscriptUrl(captionsJson, this.preferredLanguage);
          const xml = await this.getTranscript({
            baseUrl: this.transcriptUrl
          });
          return TranscriptFetcher.parseYouTubeXML(xml);
        }
      }

      // Fallback to HTML fetch
      // Fallback to HTML fetch
      const html = await this._fetchVideoHtml(videoId);
      const captionsJson = TranscriptFetcher._extractCaptionsJson(html);
      console.debug('[TranscriptFetcher] Extracted captions');
      if (!captionsJson) {
        throw new Error('No captions found in video');
      }
      this.transcriptUrl = TranscriptFetcher._getTranscriptUrl(captionsJson, this.preferredLanguage);
      const xml = await this.getTranscript({
        baseUrl: this.transcriptUrl
      });
      return TranscriptFetcher.parseYouTubeXML(xml);
    } catch (error) {
      console.error('[TranscriptFetcher] Error:', error);
      if (error instanceof _errors_js__WEBPACK_IMPORTED_MODULE_0__.YouTubeTranscriptError) {
        throw error;
      }
      throw new _errors_js__WEBPACK_IMPORTED_MODULE_0__.YouTubeTranscriptError(error.message);
    }
  }

  /**
   * Get transcript URL from captions JSON
   * @param {object} captionsData - Track data or captions JSON
   * @returns {string} Transcript URL
   * @private
   */
  static _getTranscriptUrl(captionsData, preferredLang = 'en') {
    // If we're passed a track object directly, use its baseUrl
    if (captionsData.baseUrl) {
      console.log('[TranscriptFetcher] Using direct track baseUrl:', {
        baseUrl: captionsData.baseUrl,
        preferredLang
      });
      return captionsData.baseUrl;
    }
    console.log('[TranscriptFetcher] Searching for track in language:', preferredLang);

    // Otherwise expect a captions JSON object
    if (!captionsData?.captionTracks?.length) {
      console.error('[TranscriptFetcher] No caption tracks:', captionsData);
      throw new Error('No caption tracks available');
    }

    // Find track in preferred language
    const normalizedWanted = preferredLang.toLowerCase();
    let selectedTrack = captionsData.captionTracks.find(t => t.languageCode.toLowerCase() === normalizedWanted);
    if (!selectedTrack) {
      // Log available languages and fallback
      const tracks = captionsData.captionTracks;
      const availableLangs = tracks.map(t => t.languageCode).join(', ');
      console.log('[TranscriptFetcher] Language not found:', {
        wanted: preferredLang,
        available: availableLangs
      });

      // Try English or fall back to first available
      // Try English first
      selectedTrack = captionsData.captionTracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US');

      // Fallback to first available
      if (!selectedTrack) {
        selectedTrack = captionsData.captionTracks[0];
      }
    }
    if (!selectedTrack?.baseUrl) {
      console.error('[TranscriptFetcher] No suitable track found:', captionsData.captionTracks);
      throw new Error('No suitable caption track found');
    }

    // Log selected track details
    const selectedLang = selectedTrack.languageCode;
    const targetLang = preferredLang.toLowerCase();
    const isPreferredLang = selectedLang === targetLang;
    const trackInfo = {
      language: selectedLang,
      kind: selectedTrack.kind,
      preferred: isPreferredLang
    };
    console.log('[TranscriptFetcher] Selected track:', trackInfo);
    return selectedTrack.baseUrl;
  }

  /**
   * Get transcript from URL or track data
   * @param {object} track - Track data
   * @returns {Promise<Array>} Transcript data
   */
  async getTranscript(track) {
    try {
      if (!this.session) {
        this.session = await this._createSession();
      }
      const url = track.baseUrl;
      console.debug('[TranscriptFetcher] Fetching transcript');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch transcript: ${response.status}`);
      }

      // Store the raw XML
      this.transcriptXML = await response.text();
      console.debug('[TranscriptFetcher] Received transcript XML');

      // Store the arg part for the /transcribe endpoint
      const urlParts = url.split('?');
      if (urlParts.length < 2) {
        throw new Error('Invalid transcript URL format');
      }
      this.transcriptArg = urlParts[1];
      console.debug('[TranscriptFetcher] Extracted transcript arg');
      return this.transcriptXML;
    } catch (error) {
      console.error('[TranscriptFetcher] Fetch error:', error);
      throw error;
    }
  }

  /**
   * Decode HTML entities in text
   * @param {string} text - Text to decode
   * @returns {string} Decoded text
   * @private
   */
  static _decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Fetch and format transcript
   * @param {string} videoId - YouTube video ID
   * @param {string} format - Output format
   * @returns {Promise<string>} Formatted transcript
   */
  async fetchTranscriptWithFormat(videoId, format = 'text') {
    try {
      const transcript = await this.fetchTranscript(videoId);
      let formatted;
      switch (format) {
        case 'srt':
          formatted = TranscriptFetcher.formatSRT(transcript);
          break;
        case 'json':
          formatted = JSON.stringify(transcript, null, 2);
          break;
        case 'text':
        case 'digest':
          formatted = TranscriptFetcher.formatDigest(transcript);
          break;
        default:
          formatted = transcript;
      }
      return formatted;
    } catch (error) {
      console.error('Error fetching transcript:', error);
      throw error;
    }
  }

  /**
   * Format transcript as SRT
   * @param {Array} transcript - Transcript data
   * @returns {string} SRT formatted transcript
   */
  static formatSRT(transcript) {
    return transcript.map((entry, index) => {
      const startTime = TranscriptFetcher._formatTimestamp(entry.start);
      const endTime = TranscriptFetcher._formatTimestamp(entry.start + entry.duration);
      return `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}\n`;
    }).join('\n');
  }

  /**
   * Format transcript as digest
   * @param {Array} transcript - Transcript data
   * @returns {string} Digest formatted transcript
   */
  static formatDigest(transcript) {
    return transcript.map(item => item.text).join('\n');
  }

  /**
   * Format seconds to SRT timestamp
   * @param {number} seconds Time in seconds
   * @returns {string} SRT formatted timestamp
   * @private
   */
  static _formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor(seconds % 1 * 1000);
    const hh = hours.toString().padStart(2, '0');
    const mm = minutes.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    const msec = ms.toString().padStart(3, '0');
    return `${hh}:${mm}:${ss},${msec}`;
  }

  /**
   * Fetch video HTML
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<string>} Video HTML
   * @private
   */
  async _fetchVideoHtml(videoId) {
    if (this.pageHtml) {
      return this.pageHtml;
    }
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video HTML: ${response.status}`);
    }
    return response.text();
  }

  /**
   * Extract captions JSON from HTML
   * @param {string} html - Video page HTML
   * @returns {object} Captions JSON
   * @private
   */
  static _extractCaptionsJson(html) {
    try {
      // Look for ytInitialPlayerResponse
      const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (!playerResponseMatch) {
        console.log('[TranscriptFetcher] No ytInitialPlayerResponse found');
        return null;
      }

      // Parse the full player response
      const playerResponse = JSON.parse(playerResponseMatch[1]);

      // Extract captions data
      const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer;
      if (!captions) {
        console.log('[TranscriptFetcher] No captions found in player response');
        return null;
      }
      return captions;
    } catch (e) {
      console.error('[TranscriptFetcher] Failed to parse captions JSON:', e);
      return null;
    }
  }

  /**
   * Create a new session
   * @returns {Promise<object>} Session object
   * @private
   */
  async _createSession() {
    this.session = {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      videoId: this.videoId
    };
    return this.session;
  }

  /**
   * Get batch number from timestamp
   * @param {number} timestamp - Time in seconds
   * @param {number} batchSize - Number of entries per batch (default 10)
   * @returns {object} Batch information
   */
  async getBatchFromTimestamp(timestamp, batchSize = 10) {
    const transcript = await this.fetchTranscript(this.videoId);

    // Find the entry containing this timestamp
    const entryIndex = transcript.findIndex(entry => {
      const entryEnd = entry.start + entry.duration;
      return timestamp >= entry.start && timestamp <= entryEnd;
    });
    if (entryIndex === -1) {
      throw new Error('Timestamp not found in transcript');
    }

    // Calculate batch number (1-based)
    const batchNumber = Math.floor(entryIndex / batchSize) + 1;
    const batchStart = (batchNumber - 1) * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, transcript.length);
    return {
      batchNumber,
      entryIndex,
      entry: transcript[entryIndex],
      batchRange: {
        start: batchStart,
        end: batchEnd
      },
      totalBatches: Math.ceil(transcript.length / batchSize)
    };
  }

  /**
   * Get current batch based on player timestamp
   * @param {HTMLElement} player - YouTube player element
   * @param {number} batchSize - Number of entries per batch
   * @returns {Promise<object>} Batch information
   */
  async getCurrentBatch(player, batchSize = 10) {
    if (!player) {
      throw new Error('Player element not provided');
    }

    // Get current time from player
    const currentTime = player.getCurrentTime();
    return this.getBatchFromTimestamp(currentTime, batchSize);
  }
  getTranscriptXML() {
    console.debug('[TranscriptFetcher] Getting transcript XML');
    return this.transcriptXML;
  }
}

/***/ }),

/***/ "./lib/services/mockService.js":
/*!*************************************!*\
  !*** ./lib/services/mockService.js ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getMockState: () => (/* binding */ getMockState),
/* harmony export */   mockFetch: () => (/* binding */ mockFetch),
/* harmony export */   toggleMockMode: () => (/* binding */ toggleMockMode),
/* harmony export */   userMock: () => (/* binding */ userMock)
/* harmony export */ });
/* harmony import */ var _ui_alerts_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../ui/alerts.js */ "./lib/ui/alerts.js");


// Global mock state
const mockState = {
  enabled: false,
  errorType: '429',
  target: 'all',
  targets: {}
};

// Add user-friendly mock function for console use
function userMock(errorType = '429', target = 'all') {
  console.log('[Mock] User triggered mock with:', {
    errorType,
    target
  });

  // If target is 'all', toggle everything. Otherwise only toggle specified target
  if (target === 'all') {
    mockState.enabled = !mockState.enabled;
    mockState.errorType = errorType;
    mockState.target = target;
  } else {
    // Initialize targets if not exists
    mockState.targets = mockState.targets || {};

    // Toggle specific target
    if (mockState.targets[target]) {
      delete mockState.targets[target];
    } else {
      mockState.targets[target] = errorType;
    }

    // Update overall enabled state
    mockState.enabled = Object.keys(mockState.targets).length > 0;
  }
  const message = mockState.enabled ? `Mock mode enabled (${errorType})${target !== 'all' ? ` for ${target}` : ''}` : 'Mock mode disabled';

  // Show alert with error styling
  const alert = (0,_ui_alerts_js__WEBPACK_IMPORTED_MODULE_0__.showAlert)(message, 5000);
  if (alert) {
    alert.classList.add('error-alert');
  }

  // Update UI to show mock mode state
  updateMockModeIndicator();
  console.log('[Mock] Mode:', mockState);
  return message;
}

// Mock response functions
function getMockErrorResponse(status = 429) {
  const errors = {
    429: {
      status: 429,
      error: 'Too many requests. Please wait a moment and try again.',
      json: () => Promise.resolve({
        error: 'Too many requests. Please wait a moment and try again.'
      })
    },
    500: {
      status: 500,
      error: 'Internal server error',
      json: () => Promise.resolve({
        error: 'Internal server error'
      })
    },
    404: {
      status: 404,
      error: 'Resource not found',
      json: () => Promise.resolve({
        error: 'Resource not found'
      })
    }
  };
  return {
    ok: false,
    status: status,
    ...errors[status]
  };
}

// Mock fetch function with target support
async function mockFetch(url, options) {
  if (mockState.enabled) {
    // Determine which API is being called
    const isTranscript = url.includes('/transcript') && options.body;
    const requestBody = isTranscript ? JSON.parse(options.body) : null;
    const isSummary = isTranscript && requestBody?.action === 'summarize';
    const isTranslate = isTranscript && requestBody?.action === 'translate';

    // Check if this type of request should be mocked
    const shouldMock = mockState.target === 'all' || isSummary && mockState.targets?.summary || isTranslate && mockState.targets?.translate;
    if (shouldMock) {
      const errorType = mockState.target === 'all' ? mockState.errorType : mockState.targets[isSummary ? 'summary' : 'translate'];
      console.log('[Mock] Returning mock error response:', {
        errorType,
        requestType: isSummary ? 'summary' : isTranslate ? 'translate' : 'transcript'
      });
      return getMockErrorResponse(parseInt(errorType));
    }
  }
  return fetch(url, options);
}

// Toggle mock mode
function toggleMockMode(errorType = '429') {
  console.log('[Mock] Toggling mock mode with error type:', errorType);
  mockState.enabled = !mockState.enabled;
  mockState.errorType = errorType;

  // Show indicator
  (0,_ui_alerts_js__WEBPACK_IMPORTED_MODULE_0__.showAlert)(`Mock mode ${mockState.enabled ? 'enabled' : 'disabled'}${mockState.enabled ? ` (${errorType})` : ''}`, 2000);

  // Update UI to show mock mode state
  updateMockModeIndicator();
  console.log('[Mock] Mode:', mockState);
}

// Update mock mode indicator
function updateMockModeIndicator() {
  let indicator = document.querySelector('.mock-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'mock-indicator';
    document.querySelector('.controls-right')?.prepend(indicator);
  }
  if (mockState.enabled) {
    const targets = mockState.target === 'all' ? `ALL (${mockState.errorType})` : Object.entries(mockState.targets).map(([target, code]) => `${target}:${code}`).join(', ');
    indicator.textContent = `MOCK [${targets}]`;
    indicator.classList.add('active');
  } else {
    indicator.textContent = 'MOCK';
    indicator.classList.remove('active');
  }
}

// Export mock state for external access
const getMockState = () => ({
  ...mockState
});

/***/ }),

/***/ "./lib/services/storeService.js":
/*!**************************************!*\
  !*** ./lib/services/storeService.js ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   cleanupStore: () => (/* binding */ cleanupStore),
/* harmony export */   getStore: () => (/* binding */ getStore),
/* harmony export */   getStoreState: () => (/* binding */ getStoreState),
/* harmony export */   initStoreSubscription: () => (/* binding */ initStoreSubscription),
/* harmony export */   updateBasicInfo: () => (/* binding */ updateBasicInfo)
/* harmony export */ });
/* harmony import */ var webext_redux__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! webext-redux */ "../node_modules/webext-redux/lib/index.js");
/* harmony import */ var _ui_alerts_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../ui/alerts.js */ "./lib/ui/alerts.js");
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../config.js */ "./lib/config.js");
/* harmony import */ var _transcriptService_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./transcriptService.js */ "./lib/services/transcriptService.js");
/* harmony import */ var _index_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../index.js */ "./lib/index.js");






// Initialize global state if not exists
if (!window.state) {
  window.state = {
    lastVideoId: null,
    lastProcessedTimestamp: null,
    lastSummary: null,
    transcriptFetcher: null,
    isProcessingContent: false,
    store: null,
    lastConnectionAttempt: null
  };
}

// Local reference to global state
const state = window.state;

/**
 * Returns the Redux store instance
 * @returns {Store} The Redux store
 */
function getStore() {
  return state.store;
}

// Update basic info
async function updateBasicInfo(elements, storeState) {
  try {
    // Reset any error states
    elements.videoTitle?.classList.remove('error');
    elements.videoId?.classList.remove('error');

    // Set loading state if no data
    if (!storeState?.title && !storeState?.videoId) {
      if (elements.videoTitle) {
        elements.videoTitle.textContent = 'Loading...';
        elements.videoTitle.classList.add('loading');
      }
      if (elements.videoId) {
        elements.videoId.textContent = 'Loading...';
        elements.videoId.classList.add('loading');
      }
      return;
    }

    // Update with actual data
    if (elements.videoTitle) {
      elements.videoTitle.textContent = storeState.title || 'Loading...';
      elements.videoTitle.classList.remove('loading');
    }
    if (elements.videoId) {
      elements.videoId.textContent = `Video ID: ${storeState.videoId || 'Unknown'}`;
      elements.videoId.classList.remove('loading');
    }
  } catch (error) {
    console.error('[Sidebar] Error updating basic info:', error);
    // Set error states in UI
    if (elements?.videoTitle) {
      elements.videoTitle.textContent = 'Error loading video info';
      elements.videoTitle.classList.add('error');
      elements.videoTitle.classList.remove('loading');
    }
    if (elements?.videoId) {
      elements.videoId.textContent = 'Please refresh the page';
      elements.videoId.classList.add('error');
      elements.videoId.classList.remove('loading');
    }
    throw error;
  }
}

// Initialize store subscription
async function initStoreSubscription(elements) {
  try {
    // Create store connection
    state.store = new webext_redux__WEBPACK_IMPORTED_MODULE_0__.Store({
      portName: 'YOUTUBE_SUBTITLES_STORE',
      reconnectOnDocumentReady: true
    });

    // Wait for store to be ready
    await state.store.ready();
    console.log('[Sidebar] Store connected successfully', {
      timestamp: new Date().toISOString(),
      readyState: state.store.ready ? 'ready' : 'not ready'
    });

    // Add debounced store handler
    let updateTimeout = null;
    state.store.subscribe(() => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      updateTimeout = setTimeout(async () => {
        const currentState = state.store.getState();
        console.log('[Sidebar] Store state updated:', {
          timestamp: new Date().toISOString(),
          videoId: currentState?.videoId,
          hasPlayerData: !!currentState?.playerData,
          hasCaptions: currentState?.hasCaptions
        });
        if (!currentState) {
          console.error('[Sidebar] Invalid store state');
          return;
        }
        try {
          // Skip if no video ID
          if (!currentState?.videoId) {
            console.log('[Sidebar] Skipping update - no videoId in state');
            return;
          }
          console.log('[Sidebar] Processing store update:', {
            videoId: currentState.videoId,
            title: currentState.title,
            hasCaptions: currentState.hasCaptions,
            hasPlayerData: !!currentState.playerData,
            timestamp: currentState.timestamp,
            hasProxyData: !!currentState.playerData?.isProxySource || !!currentState.isProxySource
          });

          // Extract proxy data from playerData to root level if needed
          if (currentState.playerData) {
            // Check if proxy data exists in playerData but not at root level
            if (currentState.playerData.isProxySource && !currentState.isProxySource) {
              console.log('[Sidebar] Extracting proxy data from playerData to root level');
              currentState.isProxySource = currentState.playerData.isProxySource;
              currentState.proxyUrl = currentState.playerData.proxyUrl;
              currentState.transcript = currentState.playerData.transcript;
            }
          }

          // Update basic info first
          await updateBasicInfo(elements, currentState);

          // Initialize transcript fetcher if needed
          if (currentState.videoId !== state.lastVideoId && currentState.playerData?.captions) {
            console.log('[Sidebar] Initializing transcript fetcher...');
            const fetcher = new _index_js__WEBPACK_IMPORTED_MODULE_4__["default"](currentState.playerData, currentState.videoId, {
              pageHtml: currentState.pageHtml,
              language: currentState.preferredLanguage
            });
            state.transcriptFetcher = fetcher;
            window.state.transcriptFetcher = fetcher;
            state.lastVideoId = currentState.videoId;
          }

          // Get saved language preference from global state or Config
          const preferredLang = window.state?.preferredLanguage || (await _config_js__WEBPACK_IMPORTED_MODULE_2__.Config.getPreferredLanguage());
          console.log('[Sidebar] Using language for update:', preferredLang);

          // Update both states with language preference
          currentState.preferredLanguage = preferredLang;
          if (window.state) {
            window.state.preferredLanguage = preferredLang;
          }
          await (0,_transcriptService_js__WEBPACK_IMPORTED_MODULE_3__.updateTranscriptDisplay)(elements, currentState, state.transcriptFetcher);
        } catch (error) {
          console.error('[Sidebar] Error handling store update:', error);
          // No longer showing error alerts
          // handleError(error);
        }
      }, 300); // Debounce for 300ms
    });

    // Initialize with current state
    const initialState = state.store.getState();
    if (initialState) {
      console.log('[Sidebar] Processing initial state:', initialState);
      try {
        if (initialState.title) {
          await updateBasicInfo(elements, initialState);
        }
        if (initialState.playerData?.captions) {
          console.log('[Sidebar] Initializing transcript fetcher for initial state...');
          const fetcher = new _index_js__WEBPACK_IMPORTED_MODULE_4__["default"](initialState.playerData, initialState.videoId, {
            pageHtml: initialState.pageHtml,
            language: initialState.preferredLanguage
          });
          state.transcriptFetcher = fetcher;
          window.state.transcriptFetcher = fetcher;
          state.lastVideoId = initialState.videoId;
        }

        // Get saved language preference
        const preferredLang = window.state?.preferredLanguage || (await _config_js__WEBPACK_IMPORTED_MODULE_2__.Config.getPreferredLanguage());
        console.log('[Sidebar] Using language for initial state:', preferredLang);

        // Update both states with language preference
        initialState.preferredLanguage = preferredLang;
        if (window.state) {
          window.state.preferredLanguage = preferredLang;
        }
        await (0,_transcriptService_js__WEBPACK_IMPORTED_MODULE_3__.updateTranscriptDisplay)(elements, initialState, state.transcriptFetcher);
      } catch (error) {
        console.error('[Sidebar] Error processing initial state:', error);
        (0,_ui_alerts_js__WEBPACK_IMPORTED_MODULE_1__.handleError)(error);
      }
    }
    return state.store;
  } catch (error) {
    console.error('[Sidebar] Error initializing store subscription:', error);
    (0,_ui_alerts_js__WEBPACK_IMPORTED_MODULE_1__.handleError)(error);
    throw error;
  }
}

// Clean up store subscription
function cleanupStore() {
  if (state.store) {
    state.store = null;
  }
}

// Get current store state
function getStoreState() {
  return state.store ? state.store.getState() : null;
}

/***/ }),

/***/ "./lib/services/transcriptService.js":
/*!*******************************************!*\
  !*** ./lib/services/transcriptService.js ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   autoSummarize: () => (/* binding */ autoSummarize),
/* harmony export */   updateTranscriptDisplay: () => (/* binding */ updateTranscriptDisplay)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config.js */ "./lib/config.js");
/* harmony import */ var _mockService_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./mockService.js */ "./lib/services/mockService.js");




// Function to normalize newlines (replace all newlines with spaces)
function normalizeNewlines(text) {
  return text.replace(/\n+/g, ' ').trim();
}

// Function to normalize language codes for API calls
function normalizeLanguageCode(lang) {
  if (!lang) {
    console.log('[Sidebar] No language provided, defaulting to "en"');
    return 'en';
  }

  // Convert to lowercase for consistent handling
  const lowerLang = lang.toLowerCase();

  // Map UI language codes to API language codes
  let normalizedLang = lowerLang;

  // Special handling for Chinese variants
  if (lowerLang === 'zh-cn') {
    normalizedLang = 'zh-cn'; // Ensure simplified Chinese is correctly mapped
  } else if (lowerLang === 'zh-tw') {
    normalizedLang = 'zh-tw'; // Traditional Chinese (Taiwan)
  } else if (lowerLang === 'zh-hk') {
    normalizedLang = 'zh-hk'; // Traditional Chinese (Hong Kong)
  }
  console.log('[Sidebar] Normalizing language code:', {
    input: lang,
    output: normalizedLang
  });
  return normalizedLang;
}

// Toggle convert buttons visibility
function toggleConvertButtons(show) {
  const convertButtons = document.querySelector('.convert-buttons');
  if (convertButtons) {
    if (show) {
      convertButtons.classList.add('visible');
    } else {
      convertButtons.classList.remove('visible');
    }
  }
}

// Function to auto-summarize content
async function autoSummarize(appState, existingTranscript, targetLang = 'en') {
  // Validate required parameters
  if (!existingTranscript || !appState.title || !appState.transcriptArg && !appState.isProxySource) {
    console.error('[Sidebar] Missing required data:', {
      hasTranscript: !!existingTranscript,
      hasTitle: !!appState.title,
      hasArg: !!appState.transcriptArg,
      isProxySource: !!appState.isProxySource
    });
    throw new Error('Missing required data for summarization');
  }
  if (!targetLang) {
    console.error('[Sidebar] No target language specified');
    throw new Error('No language specified for summarization');
  }

  // Get DOM elements
  const summary = document.querySelector('#summary');
  const summaryContainer = document.querySelector('.summary-container');
  const summaryToolbar = document.querySelector('.summary-toolbar');

  // Get bullet list mode from Config or use provided mode
  let mode;
  if (appState.mode) {
    // Use the mode passed from the caller if available
    mode = appState.mode;
    console.log('[Sidebar] Using provided mode:', mode);
  } else {
    // Otherwise get from config
    const isBulletMode = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getBulletListEnabled();
    mode = isBulletMode ? 'bullet' : 'narrative';
    console.log('[Sidebar] Using config-based mode:', mode);
  }

  // Reset state and show loading
  if (summary) {
    summary.textContent = 'Loading summary...';
    summaryContainer?.classList.remove('error');
    summary.classList.remove('error');
    summary.classList.add('translating');
    summary.style.fontStyle = 'normal';
    summary.style.color = 'var(--text-primary)';
    summaryContainer?.classList.add('visible');
    summaryToolbar?.classList.add('visible', 'translating');
  }
  const endpoint = `${_config_js__WEBPACK_IMPORTED_MODULE_0__.API_CONFIG.BASE_URL}${_config_js__WEBPACK_IMPORTED_MODULE_0__.API_CONFIG.ENDPOINTS.TRANSCRIPT}`;
  const normalizedLang = normalizeLanguageCode(targetLang);
  try {
    console.log('[Sidebar] Fetching summary and title in language:', normalizedLang);

    // Log API request details
    console.log('[Sidebar] Making API requests with:', {
      transcriptArg: appState.transcriptArg,
      targetLang,
      normalizedLang,
      appState
    });

    // Check if this is a proxy SRT request
    const isProxyRequest = appState.isProxySource === true;
    const proxyUrl = isProxyRequest && appState.proxy ? appState.proxy : appState.proxyUrl;
    console.log('[Sidebar] API request type:', isProxyRequest ? 'proxy SRT' : 'native captions');
    if (isProxyRequest) {
      console.log('[Sidebar] Using proxy URL:', proxyUrl);
      console.log('[Sidebar] Using mode:', mode);
    }

    // Make both API calls in parallel using normalized language
    const [summaryResponse, titleResponse] = await Promise.all([(0,_mockService_js__WEBPACK_IMPORTED_MODULE_1__.mockFetch)(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(isProxyRequest && proxyUrl ? {
        proxy: proxyUrl,
        action: 'summarize',
        lang: normalizedLang,
        mode: mode
      } : {
        arg: appState.transcriptArg,
        action: 'summarize',
        lang: normalizedLang,
        mode: mode
      })
    }), (0,_mockService_js__WEBPACK_IMPORTED_MODULE_1__.mockFetch)(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(isProxyRequest && proxyUrl ? {
        proxy: proxyUrl,
        txt: appState.title,
        action: 'translate',
        lang: normalizedLang,
        mode: mode
      } : {
        arg: appState.transcriptArg,
        txt: appState.title,
        action: 'translate',
        lang: normalizedLang,
        mode: mode
      })
    })]);
    if (!summaryResponse.ok || !titleResponse.ok) {
      const errorResponse = !summaryResponse.ok ? summaryResponse : titleResponse;
      let errorMessage;
      try {
        const errorData = await errorResponse.json();
        errorMessage = errorData.error || `Service is temporarily busy (Code: ${errorResponse.status})`;
      } catch (e) {
        errorMessage = `Service is temporarily busy (Code: ${errorResponse.status})`;
      }

      // Show error in summary container only
      if (summaryContainer) {
        summaryContainer.classList.add('visible');
        summary.textContent = errorMessage;
        summary.classList.add('error');
        summaryToolbar?.classList.remove('visible', 'translating');
      }
      throw new Error(errorMessage);
    }
    const [summaryData, titleData] = await Promise.all([summaryResponse.json(), titleResponse.json()]);
    const summaryText = summaryData.summary;
    const translatedTitle = titleData.translation;

    // Update summary with results and remove loading state
    if (summary && summaryText) {
      summary.textContent = summaryText;
      summary.classList.remove('translating');
      summaryContainer?.classList.add('visible');
      summaryToolbar?.classList.remove('translating');
    }

    // Update title
    if (translatedTitle) {
      const titleElement = document.querySelector('.video-title');
      if (titleElement) {
        const translatedTitleDiv = document.createElement('div');
        translatedTitleDiv.className = 'translated';
        translatedTitleDiv.textContent = normalizeNewlines(translatedTitle);
        const originalTitle = document.createElement('div');
        originalTitle.className = 'original';
        originalTitle.textContent = appState.title;
        titleElement.innerHTML = '';
        titleElement.appendChild(translatedTitleDiv);
        titleElement.appendChild(originalTitle);
      }
    }
  } catch (error) {
    console.error('[Sidebar] Error generating summary:', error);

    // Show error in summary container only
    if (summaryContainer) {
      summaryContainer.classList.add('visible');
      summary.textContent = error.message;
      summary.classList.add('error');
      summaryToolbar?.classList.remove('visible', 'translating');
    }
    throw error;
  }
}

// Update transcript display
async function updateTranscriptDisplay(elements, storeState, transcriptFetcher, options = {}) {
  // Default options
  const {
    skipSummaryGeneration = false
  } = options;
  if (!storeState?.videoId) {
    console.error('[Sidebar] No video ID available');
    throw new Error('No video ID available. Please try refreshing the page.');
  }
  try {
    // Reset error states
    elements.transcript?.classList.remove('error');
    if (elements.transcript) {
      elements.transcript.textContent = 'Loading transcript...';
    }
    const format = elements.format?.value || 'text';
    const lang = normalizeLanguageCode(storeState.preferredLanguage);
    console.log('[Sidebar] Preparing transcript request:', {
      videoId: storeState.videoId,
      language: lang,
      format,
      hasCaptions: storeState.hasCaptions,
      isProxySource: storeState.isProxySource,
      hasProxyData: !!storeState.transcript || !!storeState.playerData?.transcript
    });
    let content = '';

    // Try to fetch native captions first if they're available
    if (storeState.hasCaptions !== false) {
      // Try the normal transcript fetching flow
      if (!transcriptFetcher) {
        console.error('[Sidebar] TranscriptFetcher is not initialized');
        throw new Error('Failed to load transcript. Please try refreshing the page.');
      }

      // Log detailed information about the transcript fetcher state
      console.log('[Sidebar] Using transcript fetcher:', {
        hasVideoId: !!transcriptFetcher.videoId,
        hasPlayerData: !!transcriptFetcher.playerData,
        preferredLanguage: transcriptFetcher.preferredLanguage,
        hasCache: transcriptFetcher.cache?.size > 0,
        hasTranscriptUrl: !!transcriptFetcher.transcriptUrl,
        hasTranscriptArg: !!transcriptFetcher.transcriptArg,
        hasTranscriptXML: !!transcriptFetcher.transcriptXML
      });
      try {
        // First get the transcript URL and extract the arg
        console.log('[Sidebar] Attempting to fetch transcript for video:', storeState.videoId);
        await transcriptFetcher.fetchTranscript(storeState.videoId);
        const transcriptArg = transcriptFetcher.getTranscriptArg();
        if (!transcriptArg) {
          console.error('[Sidebar] Failed to get transcript arg');
          throw new Error('Failed to get transcript information. Please try refreshing the page.');
        }

        // Store the arg in the state for later use
        storeState.transcriptArg = transcriptArg;
        console.log('[Sidebar] Making transcript request with arg:', {
          arg: transcriptArg ? transcriptArg.substring(0, 20) + '...' : 'undefined',
          format,
          lang
        });

        // Make the transcript request
        const response = await (0,_mockService_js__WEBPACK_IMPORTED_MODULE_1__.mockFetch)(`${_config_js__WEBPACK_IMPORTED_MODULE_0__.API_CONFIG.BASE_URL}${_config_js__WEBPACK_IMPORTED_MODULE_0__.API_CONFIG.ENDPOINTS.TRANSCRIPT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            arg: transcriptArg,
            format,
            lang // Include language in request
          })
        });
        if (!response.ok) {
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error;
          } catch (e) {
            // If we can't parse the error JSON, create a user-friendly message based on status
            if (response.status === 429) {
              errorMessage = 'Too many requests. Please wait a moment and try again.';
            } else {
              errorMessage = `Failed to fetch transcript (Status ${response.status})`;
            }
          }
          console.error('[Sidebar] Fetch error:', {
            status: response.status,
            message: errorMessage
          });
          throw new Error(errorMessage);
        }
        content = await response.text();
        if (!elements.transcript) {
          console.error('[Sidebar] Transcript element not found');
          throw new Error('Transcript element not found');
        }

        // Format-specific processing
        if (format === 'text') {
          // Only normalize newlines for TXT format
          content = normalizeNewlines(content);
        } else if (format === 'srt' || format === 'json') {
          // Preserve original formatting for SRT and JSON
          content = content.trim();
        }

        // Store the transcript and show convert buttons
        elements.transcript.textContent = content;
        toggleConvertButtons(true);

        // Then try to generate summary - if it fails, transcript will remain visible
        if (!skipSummaryGeneration) {
          try {
            console.log('[Sidebar] Summary request details:', {
              videoId: storeState.videoId,
              title: storeState.title,
              preferredLanguage: storeState.preferredLanguage,
              state: storeState
            });
            const targetLang = storeState.preferredLanguage;
            console.log('[Sidebar] Calling autoSummarize with language:', targetLang);
            await autoSummarize({
              videoId: storeState.videoId,
              title: storeState.title,
              transcriptArg,
              preferredLanguage: targetLang // Add language to appState
            }, content, targetLang);
            console.log('[Sidebar] Summary request details:', {
              videoId: storeState.videoId,
              title: storeState.title,
              preferredLanguage: storeState.preferredLanguage,
              state: storeState
            });
          } catch (error) {
            console.error('[Sidebar] Error generating summary:', error);
            return;
          }
        }

        // Successfully fetched and displayed native captions, so return
        return;
      } catch (error) {
        console.error('[Sidebar] Error fetching native captions:', error);
        // If native captions fail, we'll try proxy SRT as fallback
      }
    }

    // Check if we already have proxy data in the store
    // This is a fallback if native captions are not available or fetch failed
    if (storeState.isProxySource && (storeState.transcript || storeState.playerData?.transcript)) {
      console.log('[Sidebar] Using proxy data from store:', {
        hasRootTranscript: !!storeState.transcript,
        hasPlayerDataTranscript: !!storeState.playerData?.transcript
      });

      // Use transcript data from root level or from playerData
      const proxyData = storeState.transcript || storeState.playerData?.transcript;

      // Ensure we have the proxyUrl set
      if (!storeState.proxyUrl && storeState.playerData?.proxyUrl) {
        storeState.proxyUrl = storeState.playerData.proxyUrl;
      }
      try {
        // Dynamically import the proxy transcript fetcher for parsing
        const {
          parseSRTContent
        } = await __webpack_require__.e(/*! import() */ "lib_proxyTranscriptFetcher_js").then(__webpack_require__.bind(__webpack_require__, /*! ../proxyTranscriptFetcher.js */ "./lib/proxyTranscriptFetcher.js"));

        // Parse and display the content
        if (proxyData && elements.transcript) {
          const parsedContent = parseSRTContent(proxyData, format);
          if (elements.transcript) {
            elements.transcript.innerHTML = format === 'text' ? `<div class="transcript-text-content">${parsedContent.trim()}</div>` : parsedContent;
          }

          // Set content for summary generation
          content = proxyData;

          // Generate summary for proxy content only if not skipping summary generation
          if (!skipSummaryGeneration) {
            try {
              console.log('[Sidebar] Generating summary for proxy SRT content from store:', {
                videoId: storeState.videoId,
                title: storeState.title,
                preferredLanguage: storeState.preferredLanguage
              });
              const targetLang = storeState.preferredLanguage;
              console.log('[Sidebar] Calling autoSummarize with language:', targetLang);
              await autoSummarize({
                videoId: storeState.videoId,
                title: storeState.title,
                isProxySource: true,
                preferredLanguage: targetLang,
                proxyUrl: storeState.proxyUrl
              }, content, targetLang);
              console.log('[Sidebar] Summary generation completed for proxy content');
            } catch (summaryError) {
              console.error('[Sidebar] Error generating summary for proxy content:', summaryError);
              // Don't throw here, we still want to display the transcript
            }
          } else {
            console.log('[Sidebar] Skipping summary generation for proxy content (format change)');
          }

          // Return early since we've successfully displayed the transcript
          return;
        }
      } catch (error) {
        console.error('[Sidebar] Error processing proxy data from store:', error);
        // Continue with normal flow to try native captions as fallback
      }
    }

    // Check if captions are not available, try proxy SRT
    if (storeState.hasCaptions === false) {
      console.log('[Sidebar] No native captions available, trying proxy SRT', {
        videoId: storeState.videoId,
        title: storeState.title,
        hasCaptions: storeState.hasCaptions,
        hasPlayerData: !!storeState.playerData
      });

      // Ensure we have a valid videoId before attempting to fetch
      if (!storeState.videoId) {
        console.error('[Sidebar] Cannot fetch proxy SRT: Missing videoId in store state');
        return;
      }

      // Normalize videoId if it's not in the expected format
      let videoId = storeState.videoId;
      if (typeof videoId !== 'string') {
        console.warn('[Sidebar] videoId is not a string, attempting to convert:', videoId);
        videoId = String(videoId);
      }

      // Check if videoId looks valid (not empty, null, undefined as strings)
      if (videoId === 'null' || videoId === 'undefined' || videoId.trim() === '') {
        console.error('[Sidebar] Invalid videoId format:', videoId);
        return;
      }
      try {
        // Dynamically import the proxy transcript fetcher
        const {
          fetchProxySRT,
          parseSRTContent
        } = await __webpack_require__.e(/*! import() */ "lib_proxyTranscriptFetcher_js").then(__webpack_require__.bind(__webpack_require__, /*! ../proxyTranscriptFetcher.js */ "./lib/proxyTranscriptFetcher.js"));
        try {
          // Fetch the proxy SRT content
          const proxyData = await fetchProxySRT(videoId, lang);
          console.log('[Sidebar] Proxy fetch completed successfully');

          // If we got here, we successfully fetched the proxy data
          // Process it and display it
          if (proxyData && elements.transcript) {
            const parsedContent = parseSRTContent(proxyData, format);
            if (elements.transcript) {
              elements.transcript.innerHTML = format === 'text' ? `<div class="transcript-text-content">${parsedContent.trim()}</div>` : parsedContent;
            }

            // Mark this as a proxy source for the summary generation
            // Note: This only updates the local storeState object for this function
            // It does not update the Redux store
            storeState.isProxySource = true;

            // Get the SRT provider URL and construct the full proxy URL
            const getSrtProviderUrl = async () => {
              const srtProvider = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getSrtProvider();
              // Remove trailing slash from srtProvider if present to prevent double slashes
              const baseUrl = srtProvider.endsWith('/') ? srtProvider.slice(0, -1) : srtProvider;
              // Construct the full proxy URL with "default" as the language code
              return `${baseUrl}/srt/${storeState.videoId}/default/${storeState.videoId}.srt`;
            };

            // Set the full proxy URL
            storeState.proxy = await getSrtProviderUrl();
            console.log('[Sidebar] Set proxy URL for summary generation:', storeState.proxy);

            // Set content for summary generation
            content = proxyData;

            // Generate summary for proxy content only if not skipping summary generation
            if (!skipSummaryGeneration) {
              try {
                console.log('[Sidebar] Generating summary for proxy SRT content:', {
                  videoId: storeState.videoId,
                  title: storeState.title,
                  preferredLanguage: storeState.preferredLanguage
                });
                const targetLang = storeState.preferredLanguage;
                console.log('[Sidebar] Calling autoSummarize with language:', targetLang);
                await autoSummarize({
                  videoId: storeState.videoId,
                  title: storeState.title,
                  isProxySource: true,
                  preferredLanguage: targetLang,
                  proxy: storeState.proxy
                }, content, targetLang);
                console.log('[Sidebar] Summary generation completed for proxy content');
              } catch (summaryError) {
                console.error('[Sidebar] Error generating summary for proxy content:', summaryError);
                // Don't throw here, we still want to display the transcript
              }
            } else {
              console.log('[Sidebar] Skipping summary generation for proxy content (format change)');
            }

            // Return early to prevent trying to fetch native captions
            return;
          } else {
            throw new Error('Failed to fetch or display proxy SRT content');
          }
        } catch (fetchError) {
          console.error('[Sidebar] Error in fetchProxySRT:', fetchError.message);

          // Get the current SRT provider URL
          const srtProvider = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getSrtProvider();

          // Check if we have permission for the SRT provider
          const hasPermission = await new Promise(resolve => {
            chrome.permissions.contains({
              origins: [`${srtProvider}/*`]
            }, resolve);
          });
          if (!hasPermission) {
            console.log('No permission for SRT provider. Permission should have been requested during configuration.');
            if (elements.transcript) {
              elements.transcript.innerHTML = `
                <div style="
                  text-align: center; 
                  padding: 20px; 
                  color: #aaa; 
                  display: flex; 
                  flex-direction: column; 
                  align-items: center;
                ">
                  <p style="margin-bottom: 20px;">No permission for subtitle access</p>
                  <p>Please reconfigure the SRT provider in the extension settings.</p>
                </div>
              `;
            }
            return;
          } else {
            // Permission exists but fetch still failed (e.g., 404 error)
            if (elements.transcript) {
              elements.transcript.innerHTML = `
                <div style="
                  text-align: center; 
                  padding: 20px; 
                  color: #aaa; 
                  display: flex; 
                  flex-direction: column; 
                  align-items: center;
                ">
                  <p style="margin-bottom: 20px;">No subtitles available</p>
                  <p>No native CC transcript from the video and the SRT provider returned a ${fetchError.message}.</p>
                </div>
              `;
              elements.transcript.classList.add('error');
              toggleConvertButtons(false);

              // Hide the summary container to avoid showing previous video's summary
              const summaryContainer = document.querySelector('.summary-container');
              if (summaryContainer) {
                summaryContainer.classList.remove('visible');
              }
            }
            return;
          }
        }
      } catch (error) {
        console.error('[Sidebar] Error in proxy SRT handling:', error);
        // If we have no native captions, display an error message
        if (storeState.hasCaptions === false) {
          if (elements.transcript) {
            elements.transcript.innerHTML = `
              <div style="
                text-align: center; 
                padding: 20px; 
                color: #aaa; 
                display: flex; 
                flex-direction: column; 
                align-items: center;
              ">
                <p style="margin-bottom: 20px;">No subtitles available</p>
                <p>No native CC transcript from the video and no proxy SRT available.</p>
              </div>
            `;
            elements.transcript.classList.add('error');
            toggleConvertButtons(false);

            // Hide the summary container to avoid showing previous video's summary
            const summaryContainer = document.querySelector('.summary-container');
            if (summaryContainer) {
              summaryContainer.classList.remove('visible');
            }
            return;
          }
        }
        // Otherwise, continue with normal flow to try native captions as fallback
      }
    }

    // If we get here, try the normal transcript fetching flow
    if (!transcriptFetcher) {
      console.error('[Sidebar] TranscriptFetcher is not initialized');
      throw new Error('Failed to load transcript. Please try refreshing the page.');
    }

    // Log detailed information about the transcript fetcher state
    console.log('[Sidebar] Using transcript fetcher:', {
      hasVideoId: !!transcriptFetcher.videoId,
      hasPlayerData: !!transcriptFetcher.playerData,
      preferredLanguage: transcriptFetcher.preferredLanguage,
      hasCache: transcriptFetcher.cache?.size > 0,
      hasTranscriptUrl: !!transcriptFetcher.transcriptUrl,
      hasTranscriptArg: !!transcriptFetcher.transcriptArg,
      hasTranscriptXML: !!transcriptFetcher.transcriptXML
    });
    const endpoint = `${_config_js__WEBPACK_IMPORTED_MODULE_0__.API_CONFIG.BASE_URL}${_config_js__WEBPACK_IMPORTED_MODULE_0__.API_CONFIG.ENDPOINTS.TRANSCRIPT}`;
    try {
      // First get the transcript URL and extract the arg
      console.log('[Sidebar] Attempting to fetch transcript for video:', storeState.videoId);
      await transcriptFetcher.fetchTranscript(storeState.videoId);
      const transcriptArg = transcriptFetcher.getTranscriptArg();
      if (!transcriptArg) {
        console.error('[Sidebar] Failed to get transcript arg');
        throw new Error('Failed to get transcript information. Please try refreshing the page.');
      }

      // Store the arg in the state for later use
      storeState.transcriptArg = transcriptArg;
      console.log('[Sidebar] Making transcript request with arg:', {
        arg: transcriptArg ? transcriptArg.substring(0, 20) + '...' : 'undefined',
        format,
        lang
      });

      // Make the transcript request
      const response = await (0,_mockService_js__WEBPACK_IMPORTED_MODULE_1__.mockFetch)(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          arg: transcriptArg,
          format,
          lang // Include language in request
        })
      });
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error;
        } catch (e) {
          // If we can't parse the error JSON, create a user-friendly message based on status
          if (response.status === 429) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          } else {
            errorMessage = `Failed to fetch transcript (Status ${response.status})`;
          }
        }
        console.error('[Sidebar] Fetch error:', {
          status: response.status,
          message: errorMessage
        });
        throw new Error(errorMessage);
      }
      content = await response.text();
      if (!elements.transcript) {
        console.error('[Sidebar] Transcript element not found');
        throw new Error('Transcript element not found');
      }

      // Format-specific processing
      if (format === 'text') {
        // Only normalize newlines for TXT format
        content = normalizeNewlines(content);
      } else if (format === 'srt' || format === 'json') {
        // Preserve original formatting for SRT and JSON
        content = content.trim();
      }

      // Store the transcript and show convert buttons
      elements.transcript.textContent = content;
      toggleConvertButtons(true);

      // Then try to generate summary - if it fails, transcript will remain visible
      if (!skipSummaryGeneration) {
        try {
          console.log('[Sidebar] Summary request details:', {
            videoId: storeState.videoId,
            title: storeState.title,
            preferredLanguage: storeState.preferredLanguage,
            state: storeState
          });
          const targetLang = storeState.preferredLanguage;
          console.log('[Sidebar] Calling autoSummarize with language:', targetLang);
          await autoSummarize({
            videoId: storeState.videoId,
            title: storeState.title,
            transcriptArg,
            preferredLanguage: targetLang // Add language to appState
          }, content, targetLang);
          console.log('[Sidebar] Summary request details:', {
            videoId: storeState.videoId,
            title: storeState.title,
            preferredLanguage: storeState.preferredLanguage,
            state: storeState
          });
        } catch (error) {
          console.error('[Sidebar] Error generating summary:', error);
          return;
        }
      }
    } catch (error) {
      console.error('[Sidebar] Error updating transcript display:', error);

      // Only show error message if we failed to get the initial transcript
      if (!elements.transcript?.textContent || elements.transcript.textContent === 'Loading transcript...') {
        // Determine the appropriate error message based on the situation
        let errorMessage = 'Failed to load transcript. Please try refreshing the page.';

        // Check if we have no native captions
        if (storeState.hasCaptions === false) {
          // Check if an SRT provider is defined
          _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getSrtProvider().then(srtProvider => {
            if (!srtProvider || srtProvider === 'undefined') {
              // No native CC and no SRT provider defined
              elements.transcript.textContent = 'No native CC transcript.';
            } else {
              // No native CC and SRT provider defined but doesn't return anything
              elements.transcript.textContent = 'No native CC transcript from the video and the SRT provider.';
            }
            elements.transcript.classList.add('error');
            toggleConvertButtons(false);

            // Hide the summary container to avoid showing previous video's summary
            const summaryContainer = document.querySelector('.summary-container');
            if (summaryContainer) {
              summaryContainer.classList.remove('visible');
            }
          });
        } else {
          // Default error message for other cases
          elements.transcript.textContent = errorMessage;
          elements.transcript.classList.add('error');
          toggleConvertButtons(false);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('[Sidebar] Error updating transcript display:', error);

    // Only show error message if we failed to get the initial transcript
    if (!elements.transcript?.textContent || elements.transcript.textContent === 'Loading transcript...') {
      // Determine the appropriate error message based on the situation
      let errorMessage = 'Failed to load transcript. Please try refreshing the page.';

      // Check if we have no native captions
      if (storeState.hasCaptions === false) {
        // Check if an SRT provider is defined
        _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getSrtProvider().then(srtProvider => {
          if (!srtProvider || srtProvider === 'undefined') {
            // No native CC and no SRT provider defined
            elements.transcript.textContent = 'No native CC transcript.';
          } else {
            // No native CC and SRT provider defined but doesn't return anything
            elements.transcript.textContent = 'No native CC transcript from the video and the SRT provider.';
          }
          elements.transcript.classList.add('error');
          toggleConvertButtons(false);

          // Hide the summary container to avoid showing previous video's summary
          const summaryContainer = document.querySelector('.summary-container');
          if (summaryContainer) {
            summaryContainer.classList.remove('visible');
          }
        });
      } else {
        // Default error message for other cases
        elements.transcript.textContent = errorMessage;
        elements.transcript.classList.add('error');
        toggleConvertButtons(false);
      }
    }
    throw error;
  }
}

/***/ }),

/***/ "./lib/ui/alerts.js":
/*!**************************!*\
  !*** ./lib/ui/alerts.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleError: () => (/* binding */ handleError),
/* harmony export */   removeAlert: () => (/* binding */ removeAlert),
/* harmony export */   showAlert: () => (/* binding */ showAlert)
/* harmony export */ });
// Show alert
function showAlert(message, duration = 5000) {
  const alertContainer = document.querySelector('.alert-container');
  if (!alertContainer) {
    console.error('[Sidebar] Alert container not found');
    return;
  }

  // Remove existing alerts with the same message to prevent duplicates
  const existingAlerts = alertContainer.querySelectorAll('.alert');
  existingAlerts.forEach(existing => {
    if (existing.querySelector('.alert-content')?.textContent === message) {
      removeAlert(existing);
    }
  });

  // Create alert element
  const alert = document.createElement('div');
  alert.className = 'alert';
  const content = document.createElement('div');
  content.className = 'alert-content';
  content.textContent = message;
  const closeButton = document.createElement('button');
  closeButton.className = 'alert-close';
  closeButton.innerHTML = '×';
  closeButton.onclick = () => removeAlert(alert);
  alert.appendChild(content);
  alert.appendChild(closeButton);

  // Add to container
  alertContainer.appendChild(alert);
  alertContainer.classList.add('visible');

  // Ensure the alert is visible by scrolling it into view if needed
  setTimeout(() => {
    alert.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }, 100);

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => removeAlert(alert), duration);
  }
  return alert;
}

// Remove alert
function removeAlert(alert) {
  if (!alert || !alert.parentElement) return;

  // Start fade out
  alert.style.opacity = '0';

  // Remove after animation
  setTimeout(() => {
    alert.remove();

    // Hide container if no more alerts
    const alertContainer = document.querySelector('.alert-container');
    if (alertContainer && !alertContainer.children.length) {
      alertContainer.classList.remove('visible');
    }
  }, 300);
}

// Handle error display
function handleError(error) {
  console.error('[Sidebar] Error:', error);
  const message = error.message || 'An unexpected error occurred. Please try refreshing the page.';
  console.log('[Sidebar] Showing error alert:', message);
  showAlert(message);
}

/***/ }),

/***/ "./lib/ui/configManager.js":
/*!*********************************!*\
  !*** ./lib/ui/configManager.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSrtProvider: () => (/* binding */ getSrtProvider),
/* harmony export */   initializeConfigUI: () => (/* binding */ initializeConfigUI),
/* harmony export */   saveSrtProvider: () => (/* binding */ saveSrtProvider),
/* harmony export */   toggleConfigMenu: () => (/* binding */ toggleConfigMenu)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config.js */ "./lib/config.js");
/**
 * Configuration UI manager for the extension
 * @module configManager
 */



/**
 * Initialize the configuration UI
 * @param {Object} elements - DOM elements
 */
async function initializeConfigUI(elements) {
  // Check if SRT provider is already in config
  const srtProvider = await getSrtProvider();
  console.log('[ConfigManager] Initialized with SRT provider:', srtProvider);

  // Set the SRT provider input field value if it exists
  if (elements.srtProviderInput && srtProvider) {
    console.log('[ConfigManager] Setting SRT provider input value to:', srtProvider);
    elements.srtProviderInput.value = srtProvider;
  }
}

/**
 * Toggle the configuration menu visibility
 * @param {Object} elements - DOM elements
 * @param {boolean} [show] - Whether to show or hide the menu. If not provided, toggles current state.
 */
function toggleConfigMenu(elements, show) {
  const configMenu = elements.configMenu;
  if (!configMenu) {
    console.error('[ConfigManager] Config menu element not found');
    return;
  }

  // Determine whether to show or hide based on current state if show parameter is not provided
  const shouldShow = show !== undefined ? show : !configMenu.classList.contains('visible');

  // Close other menus if opening this one
  if (shouldShow && elements.fontSizeMenu?.classList.contains('visible')) {
    elements.fontSizeMenu.classList.remove('visible');
  }
  if (shouldShow) {
    configMenu.classList.add('visible');
    console.log('[ConfigManager] Config menu opened');

    // Pre-fill the input with current value
    getSrtProvider().then(url => {
      console.log('[ConfigManager] Retrieved current SRT provider for menu:', url);
      if (elements.srtProviderInput) {
        elements.srtProviderInput.value = url || '';
        console.log('[ConfigManager] Input field pre-filled with:', url || 'empty string');
      } else {
        console.error('[ConfigManager] SRT provider input element not found in elements object');
        // Try to find it directly in the DOM
        const input = configMenu.querySelector('#srtProviderInput');
        if (input) {
          input.value = url || '';
          console.log('[ConfigManager] Input field found in DOM and pre-filled with:', url || 'empty string');
        } else {
          console.error('[ConfigManager] SRT provider input element not found in DOM either');
        }
      }
    }).catch(error => {
      console.error('[ConfigManager] Error getting SRT provider:', error);
    });

    // Add click event listener to document to close menu when clicking outside
    document.addEventListener('click', closeConfigMenuOnClickOutside);
  } else {
    configMenu.classList.remove('visible');
    document.removeEventListener('click', closeConfigMenuOnClickOutside);
    console.log('[ConfigManager] Config menu closed');
  }
}

/**
 * Close the config menu when clicking outside
 * @param {Event} event - Click event
 */
function closeConfigMenuOnClickOutside(event) {
  const configMenu = document.querySelector('#configMenu');
  const configButton = document.querySelector('#configButton');
  if (configMenu && !configMenu.contains(event.target) && configButton && !configButton.contains(event.target)) {
    configMenu.classList.remove('visible');
    document.removeEventListener('click', closeConfigMenuOnClickOutside);
    console.log('[ConfigManager] Config menu closed by clicking outside');
  }
}

/**
 * Performs a dummy request to the SRT provider URL to trigger Chrome's permission dialog
 * @param {string} url - The SRT provider URL
 * @returns {Promise<boolean>} - Whether the request was successful
 */
async function performDummyRequest(url) {
  try {
    console.log('[ConfigManager] Requesting permission for SRT provider:', url);

    // Ensure URL is properly formatted
    let validUrl = url;
    if (validUrl && !validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
      console.log('[ConfigManager] Formatted URL with https://', validUrl);
    }

    // Remove trailing path components and query parameters to get the root URL
    const rootUrl = new URL(validUrl).origin;
    console.log('[ConfigManager] Using root URL for permission request:', rootUrl);

    // Request permission directly using chrome.permissions API
    return new Promise(resolve => {
      chrome.permissions.request({
        origins: [`${rootUrl}/*`]
      }, granted => {
        if (chrome.runtime.lastError) {
          console.error('[ConfigManager] Chrome runtime error during permission request:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        if (granted) {
          console.log('[ConfigManager] Permission granted for SRT provider');
          resolve(true);
        } else {
          console.warn('[ConfigManager] Permission denied for SRT provider');
          resolve(false);
        }
      });
    });
  } catch (error) {
    console.error('[ConfigManager] Error requesting permission:', error);
    return false;
  }
}

/**
 * Save the SRT provider URL
 * @param {string} url - The SRT provider URL
 * @returns {Promise<string>} - The saved URL
 */
async function saveSrtProvider(url) {
  try {
    console.log('[ConfigManager] Attempting to save SRT provider URL:', url);

    // Ensure URL is properly formatted
    let validUrl = url;
    if (validUrl && !validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
      console.log('[ConfigManager] Formatted URL with https://', validUrl);
    }

    // Perform a dummy request to trigger Chrome's permission dialog
    // This should be the first and only time the user needs to grant permission
    await performDummyRequest(validUrl);

    // Save the URL using the Config class
    await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.setSrtProvider(validUrl);

    // Verify the save was successful by reading it back
    const verifiedUrl = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getSrtProvider();
    console.log('[ConfigManager] Verified saved URL:', verifiedUrl);
    if (verifiedUrl !== validUrl) {
      console.error('[ConfigManager] URL verification failed! Saved:', validUrl, 'Retrieved:', verifiedUrl);
    }
    return validUrl;
  } catch (error) {
    console.error('[ConfigManager] Error saving SRT provider:', error);
    return null;
  }
}

/**
 * Get the current SRT provider URL
 * @returns {Promise<string>} - The current SRT provider URL
 */
async function getSrtProvider() {
  try {
    // Use the Config class method to get the SRT provider
    const provider = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getSrtProvider();
    console.log('[ConfigManager] Retrieved SRT provider:', provider);

    // If provider is undefined or null, return an empty string for better UI handling
    if (provider === undefined || provider === null) {
      console.log('[ConfigManager] No SRT provider found, returning empty string');
      return '';
    }
    return provider;
  } catch (error) {
    console.error('[ConfigManager] Error getting SRT provider:', error);
    return '';
  }
}

/***/ }),

/***/ "./lib/ui/fontManager.js":
/*!*******************************!*\
  !*** ./lib/ui/fontManager.js ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleFontSizeChange: () => (/* binding */ handleFontSizeChange),
/* harmony export */   initializeFontSize: () => (/* binding */ initializeFontSize),
/* harmony export */   initializeFontSizeMenu: () => (/* binding */ initializeFontSizeMenu),
/* harmony export */   toggleFontSizeMenu: () => (/* binding */ toggleFontSizeMenu)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config.js */ "./lib/config.js");


// Initialize font size menu
function initializeFontSizeMenu(elements, currentSize) {
  if (!elements?.fontSizeMenu) return;

  // Clear existing options
  elements.fontSizeMenu.innerHTML = '';

  // Create options for specific sizes
  const sizes = [12, 14, 16, 18, 20];
  sizes.forEach(size => {
    const option = document.createElement('div');
    option.className = `font-size-option${size === currentSize ? ' selected' : ''}`;
    option.textContent = `${size}px`;
    option.addEventListener('click', e => {
      e.stopPropagation();
      handleFontSizeChange(elements, size);
      toggleFontSizeMenu(elements, false);
    });
    elements.fontSizeMenu.appendChild(option);
  });
}

// Handle font size change
async function handleFontSizeChange(elements, newSize) {
  if (!elements?.summary) return;

  // Update font size through Config
  const validSize = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.setFontSize(newSize);
  elements.summary.style.fontSize = `${validSize}px`;

  // Update selected state in menu
  const options = elements.fontSizeMenu?.querySelectorAll('.font-size-option');
  options?.forEach(option => {
    option.classList.toggle('selected', option.textContent === `${validSize}px`);
  });
}

// Toggle font size menu
function toggleFontSizeMenu(elements, show) {
  if (!elements?.fontSizeMenu) return;
  elements.fontSizeMenu.classList.toggle('visible', show);
  // If showing menu, add click outside listener
  if (show) {
    setTimeout(() => {
      document.addEventListener('click', e => handleClickOutside(e, elements));
    }, 0);
  } else {
    document.removeEventListener('click', e => handleClickOutside(e, elements));
  }
}

// Handle click outside font size menu
function handleClickOutside(e, elements) {
  if (!elements?.fontSizeBtn?.contains(e.target)) {
    toggleFontSizeMenu(elements, false);
  }
}

// Initialize font size from config
async function initializeFontSize(elements) {
  if (!elements.summary || !elements.fontSizeMenu) return;
  try {
    const savedFontSize = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getFontSize();
    elements.summary.style.fontSize = `${savedFontSize}px`;
    initializeFontSizeMenu(elements, savedFontSize);
  } catch (error) {
    console.error('[Sidebar] Error loading font size preference:', error);
    const defaultSize = 14;
    elements.summary.style.fontSize = `${defaultSize}px`;
    initializeFontSizeMenu(elements, defaultSize);
  }
}

/***/ }),

/***/ "./lib/ui/theme.js":
/*!*************************!*\
  !*** ./lib/ui/theme.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   handleThemeToggle: () => (/* binding */ handleThemeToggle),
/* harmony export */   initializeTheme: () => (/* binding */ initializeTheme),
/* harmony export */   updateThemeIcons: () => (/* binding */ updateThemeIcons)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../config.js */ "./lib/config.js");


// Initialize theme
async function initializeTheme(elements) {
  const {
    themeToggle
  } = elements;
  if (!themeToggle) {
    console.error('[Sidebar] Theme toggle not found');
    return;
  }

  // Load saved theme and apply immediately
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const config = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.get();
  const savedTheme = config.preferences?.theme?.value || (prefersDark ? 'dark' : 'light');

  // Save initial theme if not set
  if (!config.preferences?.theme?.value) {
    config.preferences.theme = {
      value: savedTheme,
      lastUpdated: Date.now()
    };
    await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.save(config);
  }

  // Apply theme immediately
  document.documentElement.setAttribute('data-theme', savedTheme);
  await updateThemeIcons(elements, savedTheme === 'dark');

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async e => {
    const config = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.get();
    // Only update if no user preference is saved
    if (!config.preferences?.theme?.value) {
      const newTheme = e.matches ? 'dark' : 'light';
      config.preferences.theme = {
        value: newTheme,
        lastUpdated: Date.now()
      };
      await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.save(config);
      document.documentElement.setAttribute('data-theme', newTheme);
      await updateThemeIcons(elements, newTheme === 'dark');
    }
  });
}

// Update theme icons
async function updateThemeIcons(elements, isDark) {
  const {
    themeToggle
  } = elements;
  if (!themeToggle) {
    console.error('[Sidebar] Theme toggle not found');
    return;
  }
  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');
  if (!sunIcon || !moonIcon) {
    console.error('[Sidebar] Theme icons not found:', {
      sunIcon: !!sunIcon,
      moonIcon: !!moonIcon
    });
    return;
  }
  sunIcon.style.display = isDark ? 'none' : 'block';
  moonIcon.style.display = isDark ? 'block' : 'none';
}

// Handle theme toggle click
async function handleThemeToggle(elements) {
  const config = await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.get();
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Update config with new theme
  config.preferences.theme = {
    value: newTheme,
    lastUpdated: Date.now()
  };
  await _config_js__WEBPACK_IMPORTED_MODULE_0__.Config.save(config);
  document.documentElement.setAttribute('data-theme', newTheme);
  await updateThemeIcons(elements, newTheme === 'dark');
}

/***/ }),

/***/ "../node_modules/lodash.assignin/index.js":
/*!************************************************!*\
  !*** ../node_modules/lodash.assignin/index.js ***!
  \************************************************/
/***/ ((module) => {

/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  if (!isObject(object)) {
    return nativeKeysIn(object);
  }
  var isProto = isPrototype(object),
      result = [];

  for (var key in object) {
    if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    assignValue(object, key, newValue === undefined ? source[key] : newValue);
  }
  return object;
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return baseRest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = (assigner.length > 3 && typeof customizer == 'function')
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * This function is like
 * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * except that it includes inherited enumerable properties.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function nativeKeysIn(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * This method is like `_.assign` except that it iterates over own and
 * inherited source properties.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @alias extend
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.assign
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * function Bar() {
 *   this.c = 3;
 * }
 *
 * Foo.prototype.b = 2;
 * Bar.prototype.d = 4;
 *
 * _.assignIn({ 'a': 0 }, new Foo, new Bar);
 * // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4 }
 */
var assignIn = createAssigner(function(object, source) {
  copyObject(source, keysIn(source), object);
});

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}

module.exports = assignIn;


/***/ }),

/***/ "../node_modules/webext-redux/lib/alias/alias.js":
/*!*******************************************************!*\
  !*** ../node_modules/webext-redux/lib/alias/alias.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

/**
 * Simple middleware intercepts actions and replaces with
 * another by calling an alias function with the original action
 * @type {object} aliases an object that maps action types (keys) to alias functions (values) (e.g. { SOME_ACTION: newActionAliasFunc })
 */
var _default = function _default(aliases) {
  return function () {
    return function (next) {
      return function (action) {
        var alias = aliases[action.type];

        if (alias) {
          return next(alias(action));
        }

        return next(action);
      };
    };
  };
};

exports["default"] = _default;

/***/ }),

/***/ "../node_modules/webext-redux/lib/constants/index.js":
/*!***********************************************************!*\
  !*** ../node_modules/webext-redux/lib/constants/index.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.DEFAULT_PORT_NAME = exports.PATCH_STATE_TYPE = exports.STATE_TYPE = exports.DISPATCH_TYPE = void 0;
// Message type used for dispatch events
// from the Proxy Stores to background
var DISPATCH_TYPE = 'chromex.dispatch'; // Message type for state update events from
// background to Proxy Stores

exports.DISPATCH_TYPE = DISPATCH_TYPE;
var STATE_TYPE = 'chromex.state'; // Message type for state patch events from
// background to Proxy Stores

exports.STATE_TYPE = STATE_TYPE;
var PATCH_STATE_TYPE = 'chromex.patch_state'; // The default name for the port communication via
// react-chrome-redux

exports.PATCH_STATE_TYPE = PATCH_STATE_TYPE;
var DEFAULT_PORT_NAME = "chromex.port_name";
exports.DEFAULT_PORT_NAME = DEFAULT_PORT_NAME;

/***/ }),

/***/ "../node_modules/webext-redux/lib/index.js":
/*!*************************************************!*\
  !*** ../node_modules/webext-redux/lib/index.js ***!
  \*************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
Object.defineProperty(exports, "Store", ({
  enumerable: true,
  get: function get() {
    return _Store.default;
  }
}));
Object.defineProperty(exports, "applyMiddleware", ({
  enumerable: true,
  get: function get() {
    return _applyMiddleware.default;
  }
}));
Object.defineProperty(exports, "wrapStore", ({
  enumerable: true,
  get: function get() {
    return _wrapStore.default;
  }
}));
Object.defineProperty(exports, "alias", ({
  enumerable: true,
  get: function get() {
    return _alias.default;
  }
}));

var _Store = _interopRequireDefault(__webpack_require__(/*! ./store/Store */ "../node_modules/webext-redux/lib/store/Store.js"));

var _applyMiddleware = _interopRequireDefault(__webpack_require__(/*! ./store/applyMiddleware */ "../node_modules/webext-redux/lib/store/applyMiddleware.js"));

var _wrapStore = _interopRequireDefault(__webpack_require__(/*! ./wrap-store/wrapStore */ "../node_modules/webext-redux/lib/wrap-store/wrapStore.js"));

var _alias = _interopRequireDefault(__webpack_require__(/*! ./alias/alias */ "../node_modules/webext-redux/lib/alias/alias.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/***/ }),

/***/ "../node_modules/webext-redux/lib/serialization.js":
/*!*********************************************************!*\
  !*** ../node_modules/webext-redux/lib/serialization.js ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.withSerializer = exports.withDeserializer = exports.noop = void 0;

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var noop = function noop(payload) {
  return payload;
};

exports.noop = noop;

var transformPayload = function transformPayload(message) {
  var transformer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : noop;
  return _objectSpread({}, message, message.payload ? {
    payload: transformer(message.payload)
  } : {});
};

var deserializeListener = function deserializeListener(listener) {
  var deserializer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : noop;
  var shouldDeserialize = arguments.length > 2 ? arguments[2] : undefined;

  // If a shouldDeserialize function is passed, return a function that uses it
  // to check if any given message payload should be deserialized
  if (shouldDeserialize) {
    return function (message) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      if (shouldDeserialize.apply(void 0, [message].concat(args))) {
        return listener.apply(void 0, [transformPayload(message, deserializer)].concat(args));
      }

      return listener.apply(void 0, [message].concat(args));
    };
  } // Otherwise, return a function that tries to deserialize on every message


  return function (message) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    return listener.apply(void 0, [transformPayload(message, deserializer)].concat(args));
  };
};
/**
 * A function returned from withDeserializer that, when called, wraps addListenerFn with the
 * deserializer passed to withDeserializer.
 * @name AddListenerDeserializer
 * @function
 * @param {Function} addListenerFn The add listener function to wrap.
 * @returns {DeserializedAddListener}
 */

/**
 * A wrapped add listener function that registers the given listener.
 * @name DeserializedAddListener
 * @function
 * @param {Function} listener The listener function to register. It should expect the (optionally)
 * deserialized message as its first argument.
 * @param {Function} [shouldDeserialize] A function that takes the arguments passed to the listener
 * and returns whether the message payload should be deserialized. Not all messages (notably, messages
 * this listener doesn't care about) should be attempted to be deserialized.
 */

/**
 * Given a deserializer, returns an AddListenerDeserializer function that that takes an add listener
 * function and returns a DeserializedAddListener that automatically deserializes message payloads.
 * Each message listener is expected to take the message as its first argument.
 * @param {Function} deserializer A function that deserializes a message payload.
 * @returns {AddListenerDeserializer}
 * Example Usage:
 *   const withJsonDeserializer = withDeserializer(payload => JSON.parse(payload));
 *   const deserializedChromeListener = withJsonDeserializer(chrome.runtime.onMessage.addListener);
 *   const shouldDeserialize = (message) => message.type === 'DESERIALIZE_ME';
 *   deserializedChromeListener(message => console.log("Payload:", message.payload), shouldDeserialize);
 *   chrome.runtime.sendMessage("{'type:'DESERIALIZE_ME','payload':{'prop':4}}");
 *   //Payload: { prop: 4 };
 *   chrome.runtime.sendMessage("{'payload':{'prop':4}}");
 *   //Payload: "{'prop':4}";
 */


var withDeserializer = function withDeserializer() {
  var deserializer = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : noop;
  return function (addListenerFn) {
    return function (listener, shouldDeserialize) {
      return addListenerFn(deserializeListener(listener, deserializer, shouldDeserialize));
    };
  };
};
/**
 * Given a serializer, returns a function that takes a message sending
 * function as its sole argument and returns a wrapped message sender that
 * automaticaly serializes message payloads. The message sender
 * is expected to take the message as its first argument, unless messageArgIndex
 * is nonzero, in which case it is expected in the position specified by messageArgIndex.
 * @param {Function} serializer A function that serializes a message payload
 * Example Usage:
 *   const withJsonSerializer = withSerializer(payload => JSON.stringify(payload))
 *   const serializedChromeSender = withJsonSerializer(chrome.runtime.sendMessage)
 *   chrome.runtime.addListener(message => console.log("Payload:", message.payload))
 *   serializedChromeSender({ payload: { prop: 4 }})
 *   //Payload: "{'prop':4}"
 */


exports.withDeserializer = withDeserializer;

var withSerializer = function withSerializer() {
  var serializer = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : noop;
  return function (sendMessageFn) {
    var messageArgIndex = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    return function () {
      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      if (args.length <= messageArgIndex) {
        throw new Error("Message in request could not be serialized. " + "Expected message in position ".concat(messageArgIndex, " but only received ").concat(args.length, " args."));
      }

      args[messageArgIndex] = transformPayload(args[messageArgIndex], serializer);
      return sendMessageFn.apply(void 0, args);
    };
  };
};

exports.withSerializer = withSerializer;

/***/ }),

/***/ "../node_modules/webext-redux/lib/store/Store.js":
/*!*******************************************************!*\
  !*** ../node_modules/webext-redux/lib/store/Store.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _lodash = _interopRequireDefault(__webpack_require__(/*! lodash.assignin */ "../node_modules/lodash.assignin/index.js"));

var _constants = __webpack_require__(/*! ../constants */ "../node_modules/webext-redux/lib/constants/index.js");

var _serialization = __webpack_require__(/*! ../serialization */ "../node_modules/webext-redux/lib/serialization.js");

var _patch = _interopRequireDefault(__webpack_require__(/*! ../strategies/shallowDiff/patch */ "../node_modules/webext-redux/lib/strategies/shallowDiff/patch.js"));

var _util = __webpack_require__(/*! ../util */ "../node_modules/webext-redux/lib/util.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var backgroundErrPrefix = '\nLooks like there is an error in the background page. ' + 'You might want to inspect your background page for more details.\n';
var defaultOpts = {
  portName: _constants.DEFAULT_PORT_NAME,
  state: {},
  extensionId: null,
  serializer: _serialization.noop,
  deserializer: _serialization.noop,
  patchStrategy: _patch.default
};

var Store =
/*#__PURE__*/
function () {
  /**
   * Creates a new Proxy store
   * @param  {object} options An object of form {portName, state, extensionId, serializer, deserializer, diffStrategy}, where `portName` is a required string and defines the name of the port for state transition changes, `state` is the initial state of this store (default `{}`) `extensionId` is the extension id as defined by browserAPI when extension is loaded (default `''`), `serializer` is a function to serialize outgoing message payloads (default is passthrough), `deserializer` is a function to deserialize incoming message payloads (default is passthrough), and patchStrategy is one of the included patching strategies (default is shallow diff) or a custom patching function.
   */
  function Store() {
    var _this = this;

    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultOpts,
        _ref$portName = _ref.portName,
        portName = _ref$portName === void 0 ? defaultOpts.portName : _ref$portName,
        _ref$state = _ref.state,
        state = _ref$state === void 0 ? defaultOpts.state : _ref$state,
        _ref$extensionId = _ref.extensionId,
        extensionId = _ref$extensionId === void 0 ? defaultOpts.extensionId : _ref$extensionId,
        _ref$serializer = _ref.serializer,
        serializer = _ref$serializer === void 0 ? defaultOpts.serializer : _ref$serializer,
        _ref$deserializer = _ref.deserializer,
        deserializer = _ref$deserializer === void 0 ? defaultOpts.deserializer : _ref$deserializer,
        _ref$patchStrategy = _ref.patchStrategy,
        patchStrategy = _ref$patchStrategy === void 0 ? defaultOpts.patchStrategy : _ref$patchStrategy;

    _classCallCheck(this, Store);

    if (!portName) {
      throw new Error('portName is required in options');
    }

    if (typeof serializer !== 'function') {
      throw new Error('serializer must be a function');
    }

    if (typeof deserializer !== 'function') {
      throw new Error('deserializer must be a function');
    }

    if (typeof patchStrategy !== 'function') {
      throw new Error('patchStrategy must be one of the included patching strategies or a custom patching function');
    }

    this.portName = portName;
    this.readyResolved = false;
    this.readyPromise = new Promise(function (resolve) {
      return _this.readyResolve = resolve;
    });
    this.browserAPI = (0, _util.getBrowserAPI)();
    this.extensionId = extensionId; // keep the extensionId as an instance variable

    this.port = this.browserAPI.runtime.connect(this.extensionId, {
      name: portName
    });
    this.safetyHandler = this.safetyHandler.bind(this);

    if (this.browserAPI.runtime.onMessage) {
      this.safetyMessage = this.browserAPI.runtime.onMessage.addListener(this.safetyHandler);
    }

    this.serializedPortListener = (0, _serialization.withDeserializer)(deserializer)(function () {
      var _this$port$onMessage;

      return (_this$port$onMessage = _this.port.onMessage).addListener.apply(_this$port$onMessage, arguments);
    });
    this.serializedMessageSender = (0, _serialization.withSerializer)(serializer)(function () {
      var _this$browserAPI$runt;

      return (_this$browserAPI$runt = _this.browserAPI.runtime).sendMessage.apply(_this$browserAPI$runt, arguments);
    }, 1);
    this.listeners = [];
    this.state = state;
    this.patchStrategy = patchStrategy; // Don't use shouldDeserialize here, since no one else should be using this port

    this.serializedPortListener(function (message) {
      switch (message.type) {
        case _constants.STATE_TYPE:
          _this.replaceState(message.payload);

          if (!_this.readyResolved) {
            _this.readyResolved = true;

            _this.readyResolve();
          }

          break;

        case _constants.PATCH_STATE_TYPE:
          _this.patchState(message.payload);

          break;

        default: // do nothing

      }
    });
    this.dispatch = this.dispatch.bind(this); // add this context to dispatch
  }
  /**
  * Returns a promise that resolves when the store is ready. Optionally a callback may be passed in instead.
  * @param [function] callback An optional callback that may be passed in and will fire when the store is ready.
  * @return {object} promise A promise that resolves when the store has established a connection with the background page.
  */


  _createClass(Store, [{
    key: "ready",
    value: function ready() {
      var cb = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

      if (cb !== null) {
        return this.readyPromise.then(cb);
      }

      return this.readyPromise;
    }
    /**
     * Subscribes a listener function for all state changes
     * @param  {function} listener A listener function to be called when store state changes
     * @return {function}          An unsubscribe function which can be called to remove the listener from state updates
     */

  }, {
    key: "subscribe",
    value: function subscribe(listener) {
      var _this2 = this;

      this.listeners.push(listener);
      return function () {
        _this2.listeners = _this2.listeners.filter(function (l) {
          return l !== listener;
        });
      };
    }
    /**
     * Replaces the state for only the keys in the updated state. Notifies all listeners of state change.
     * @param {object} state the new (partial) redux state
     */

  }, {
    key: "patchState",
    value: function patchState(difference) {
      this.state = this.patchStrategy(this.state, difference);
      this.listeners.forEach(function (l) {
        return l();
      });
    }
    /**
     * Replace the current state with a new state. Notifies all listeners of state change.
     * @param  {object} state The new state for the store
     */

  }, {
    key: "replaceState",
    value: function replaceState(state) {
      this.state = state;
      this.listeners.forEach(function (l) {
        return l();
      });
    }
    /**
     * Get the current state of the store
     * @return {object} the current store state
     */

  }, {
    key: "getState",
    value: function getState() {
      return this.state;
    }
    /**
     * Stub function to stay consistent with Redux Store API. No-op.
     */

  }, {
    key: "replaceReducer",
    value: function replaceReducer() {
      return;
    }
    /**
     * Dispatch an action to the background using messaging passing
     * @param  {object} data The action data to dispatch
     * @return {Promise}     Promise that will resolve/reject based on the action response from the background
     */

  }, {
    key: "dispatch",
    value: function dispatch(data) {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        _this3.serializedMessageSender(_this3.extensionId, {
          type: _constants.DISPATCH_TYPE,
          portName: _this3.portName,
          payload: data
        }, null, function (resp) {
          if (!resp) {
            var _error = _this3.browserAPI.runtime.lastError;
            var bgErr = new Error("".concat(backgroundErrPrefix).concat(_error));
            reject((0, _lodash.default)(bgErr, _error));
            return;
          }

          var error = resp.error,
              value = resp.value;

          if (error) {
            var _bgErr = new Error("".concat(backgroundErrPrefix).concat(error));

            reject((0, _lodash.default)(_bgErr, error));
          } else {
            resolve(value && value.payload);
          }
        });
      });
    }
  }, {
    key: "safetyHandler",
    value: function safetyHandler(message) {
      if (message.action === 'storeReady' && message.portName === this.portName) {
        // Remove Saftey Listener
        this.browserAPI.runtime.onMessage.removeListener(this.safetyHandler); // Resolve if readyPromise has not been resolved.

        if (!this.readyResolved) {
          this.readyResolved = true;
          this.readyResolve();
        }
      }
    }
  }]);

  return Store;
}();

var _default = Store;
exports["default"] = _default;

/***/ }),

/***/ "../node_modules/webext-redux/lib/store/applyMiddleware.js":
/*!*****************************************************************!*\
  !*** ../node_modules/webext-redux/lib/store/applyMiddleware.js ***!
  \*****************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = applyMiddleware;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// Function taken from redux source
// https://github.com/reactjs/redux/blob/master/src/compose.js
function compose() {
  for (var _len = arguments.length, funcs = new Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(function (a, b) {
    return function () {
      return a(b.apply(void 0, arguments));
    };
  });
} // Based on redux implementation of applyMiddleware to support all standard
// redux middlewares


function applyMiddleware(store) {
  for (var _len2 = arguments.length, middlewares = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    middlewares[_key2 - 1] = arguments[_key2];
  }

  var _dispatch = function dispatch() {
    throw new Error('Dispatching while constructing your middleware is not allowed. ' + 'Other middleware would not be applied to this dispatch.');
  };

  var middlewareAPI = {
    getState: store.getState.bind(store),
    dispatch: function dispatch() {
      return _dispatch.apply(void 0, arguments);
    }
  };
  middlewares = (middlewares || []).map(function (middleware) {
    return middleware(middlewareAPI);
  });
  _dispatch = compose.apply(void 0, _toConsumableArray(middlewares))(store.dispatch);
  store.dispatch = _dispatch;
  return store;
}

/***/ }),

/***/ "../node_modules/webext-redux/lib/strategies/constants.js":
/*!****************************************************************!*\
  !*** ../node_modules/webext-redux/lib/strategies/constants.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.DIFF_STATUS_ARRAY_UPDATED = exports.DIFF_STATUS_KEYS_UPDATED = exports.DIFF_STATUS_REMOVED = exports.DIFF_STATUS_UPDATED = void 0;
// The `change` value for updated or inserted fields resulting from shallow diff
var DIFF_STATUS_UPDATED = 'updated'; // The `change` value for removed fields resulting from shallow diff

exports.DIFF_STATUS_UPDATED = DIFF_STATUS_UPDATED;
var DIFF_STATUS_REMOVED = 'removed';
exports.DIFF_STATUS_REMOVED = DIFF_STATUS_REMOVED;
var DIFF_STATUS_KEYS_UPDATED = 'updated_keys';
exports.DIFF_STATUS_KEYS_UPDATED = DIFF_STATUS_KEYS_UPDATED;
var DIFF_STATUS_ARRAY_UPDATED = 'updated_array';
exports.DIFF_STATUS_ARRAY_UPDATED = DIFF_STATUS_ARRAY_UPDATED;

/***/ }),

/***/ "../node_modules/webext-redux/lib/strategies/shallowDiff/diff.js":
/*!***********************************************************************!*\
  !*** ../node_modules/webext-redux/lib/strategies/shallowDiff/diff.js ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = shallowDiff;

var _constants = __webpack_require__(/*! ../constants */ "../node_modules/webext-redux/lib/strategies/constants.js");

/**
 * Returns a new Object containing only the fields in `new` that differ from `old`
 *
 * @param {Object} old
 * @param {Object} new
 * @return {Array} An array of changes. The changes have a `key`, `value`, and `change`.
 *   The change is either `updated`, which is if the value has changed or been added,
 *   or `removed`.
 */
function shallowDiff(oldObj, newObj) {
  var difference = [];
  Object.keys(newObj).forEach(function (key) {
    if (oldObj[key] !== newObj[key]) {
      difference.push({
        key: key,
        value: newObj[key],
        change: _constants.DIFF_STATUS_UPDATED
      });
    }
  });
  Object.keys(oldObj).forEach(function (key) {
    if (!newObj.hasOwnProperty(key)) {
      difference.push({
        key: key,
        change: _constants.DIFF_STATUS_REMOVED
      });
    }
  });
  return difference;
}

/***/ }),

/***/ "../node_modules/webext-redux/lib/strategies/shallowDiff/patch.js":
/*!************************************************************************!*\
  !*** ../node_modules/webext-redux/lib/strategies/shallowDiff/patch.js ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = _default;

var _constants = __webpack_require__(/*! ../constants */ "../node_modules/webext-redux/lib/strategies/constants.js");

function _default(obj, difference) {
  var newObj = Object.assign({}, obj);
  difference.forEach(function (_ref) {
    var change = _ref.change,
        key = _ref.key,
        value = _ref.value;

    switch (change) {
      case _constants.DIFF_STATUS_UPDATED:
        newObj[key] = value;
        break;

      case _constants.DIFF_STATUS_REMOVED:
        Reflect.deleteProperty(newObj, key);
        break;

      default: // do nothing

    }
  });
  return newObj;
}

/***/ }),

/***/ "../node_modules/webext-redux/lib/util.js":
/*!************************************************!*\
  !*** ../node_modules/webext-redux/lib/util.js ***!
  \************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports.getBrowserAPI = getBrowserAPI;

/**
 * Looks for a global browser api, first checking the chrome namespace and then
 * checking the browser namespace. If no appropriate namespace is present, this
 * function will throw an error.
 */
function getBrowserAPI() {
  var api;

  try {
    // eslint-disable-next-line no-undef
    api = self.chrome || self.browser || browser;
  } catch (error) {
    // eslint-disable-next-line no-undef
    api = browser;
  }

  if (!api) {
    throw new Error("Browser API is not present");
  }

  return api;
}

/***/ }),

/***/ "../node_modules/webext-redux/lib/wrap-store/wrapStore.js":
/*!****************************************************************!*\
  !*** ../node_modules/webext-redux/lib/wrap-store/wrapStore.js ***!
  \****************************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _constants = __webpack_require__(/*! ../constants */ "../node_modules/webext-redux/lib/constants/index.js");

var _serialization = __webpack_require__(/*! ../serialization */ "../node_modules/webext-redux/lib/serialization.js");

var _util = __webpack_require__(/*! ../util */ "../node_modules/webext-redux/lib/util.js");

var _diff = _interopRequireDefault(__webpack_require__(/*! ../strategies/shallowDiff/diff */ "../node_modules/webext-redux/lib/strategies/shallowDiff/diff.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Responder for promisified results
 * @param  {object} dispatchResult The result from `store.dispatch()`
 * @param  {function} send         The function used to respond to original message
 * @return {undefined}
 */
var promiseResponder = function promiseResponder(dispatchResult, send) {
  Promise.resolve(dispatchResult).then(function (res) {
    send({
      error: null,
      value: res
    });
  }).catch(function (err) {
    console.error('error dispatching result:', err);
    send({
      error: err.message,
      value: null
    });
  });
};

var defaultOpts = {
  portName: _constants.DEFAULT_PORT_NAME,
  dispatchResponder: promiseResponder,
  serializer: _serialization.noop,
  deserializer: _serialization.noop,
  diffStrategy: _diff.default
};
/**
 * Wraps a Redux store so that proxy stores can connect to it.
 * @param {Object} store A Redux store
 * @param {Object} options An object of form {portName, dispatchResponder, serializer, deserializer}, where `portName` is a required string and defines the name of the port for state transition changes, `dispatchResponder` is a function that takes the result of a store dispatch and optionally implements custom logic for responding to the original dispatch message,`serializer` is a function to serialize outgoing message payloads (default is passthrough), `deserializer` is a function to deserialize incoming message payloads (default is passthrough), and diffStrategy is one of the included diffing strategies (default is shallow diff) or a custom diffing function.
 */

var _default = function _default(store) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultOpts,
      _ref$portName = _ref.portName,
      portName = _ref$portName === void 0 ? defaultOpts.portName : _ref$portName,
      _ref$dispatchResponde = _ref.dispatchResponder,
      dispatchResponder = _ref$dispatchResponde === void 0 ? defaultOpts.dispatchResponder : _ref$dispatchResponde,
      _ref$serializer = _ref.serializer,
      serializer = _ref$serializer === void 0 ? defaultOpts.serializer : _ref$serializer,
      _ref$deserializer = _ref.deserializer,
      deserializer = _ref$deserializer === void 0 ? defaultOpts.deserializer : _ref$deserializer,
      _ref$diffStrategy = _ref.diffStrategy,
      diffStrategy = _ref$diffStrategy === void 0 ? defaultOpts.diffStrategy : _ref$diffStrategy;

  if (!portName) {
    throw new Error('portName is required in options');
  }

  if (typeof serializer !== 'function') {
    throw new Error('serializer must be a function');
  }

  if (typeof deserializer !== 'function') {
    throw new Error('deserializer must be a function');
  }

  if (typeof diffStrategy !== 'function') {
    throw new Error('diffStrategy must be one of the included diffing strategies or a custom diff function');
  }

  var browserAPI = (0, _util.getBrowserAPI)();
  /**
   * Respond to dispatches from UI components
   */

  var dispatchResponse = function dispatchResponse(request, sender, sendResponse) {
    if (request.type === _constants.DISPATCH_TYPE && request.portName === portName) {
      var action = Object.assign({}, request.payload, {
        _sender: sender
      });
      var dispatchResult = null;

      try {
        dispatchResult = store.dispatch(action);
      } catch (e) {
        dispatchResult = Promise.reject(e.message);
        console.error(e);
      }

      dispatchResponder(dispatchResult, sendResponse);
      return true;
    }
  };
  /**
  * Setup for state updates
  */


  var connectState = function connectState(port) {
    if (port.name !== portName) {
      return;
    }

    var serializedMessagePoster = (0, _serialization.withSerializer)(serializer)(function () {
      return port.postMessage.apply(port, arguments);
    });
    var prevState = store.getState();

    var patchState = function patchState() {
      var state = store.getState();
      var diff = diffStrategy(prevState, state);

      if (diff.length) {
        prevState = state;
        serializedMessagePoster({
          type: _constants.PATCH_STATE_TYPE,
          payload: diff
        });
      }
    }; // Send patched state down connected port on every redux store state change


    var unsubscribe = store.subscribe(patchState); // when the port disconnects, unsubscribe the sendState listener

    port.onDisconnect.addListener(unsubscribe); // Send store's initial state through port

    serializedMessagePoster({
      type: _constants.STATE_TYPE,
      payload: prevState
    });
  };

  var withPayloadDeserializer = (0, _serialization.withDeserializer)(deserializer);

  var shouldDeserialize = function shouldDeserialize(request) {
    return request.type === _constants.DISPATCH_TYPE && request.portName === portName;
  };
  /**
   * Setup action handler
   */


  withPayloadDeserializer(function () {
    var _browserAPI$runtime$o;

    return (_browserAPI$runtime$o = browserAPI.runtime.onMessage).addListener.apply(_browserAPI$runtime$o, arguments);
  })(dispatchResponse, shouldDeserialize);
  /**
   * Setup external action handler
   */

  if (browserAPI.runtime.onMessageExternal) {
    withPayloadDeserializer(function () {
      var _browserAPI$runtime$o2;

      return (_browserAPI$runtime$o2 = browserAPI.runtime.onMessageExternal).addListener.apply(_browserAPI$runtime$o2, arguments);
    })(dispatchResponse, shouldDeserialize);
  } else {
    console.warn('runtime.onMessageExternal is not supported');
  }
  /**
   * Setup extended connection
   */


  browserAPI.runtime.onConnect.addListener(connectState);
  /**
   * Setup extended external connection
   */

  if (browserAPI.runtime.onConnectExternal) {
    browserAPI.runtime.onConnectExternal.addListener(connectState);
  } else {
    console.warn('runtime.onConnectExternal is not supported');
  }
  /**
   * Safety message to tabs for content scripts
   */


  browserAPI.tabs.query({}, function (tabs) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = tabs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var tab = _step.value;
        browserAPI.tabs.sendMessage(tab.id, {
          action: 'storeReady',
          portName: portName
        }, function () {
          if (chrome.runtime.lastError) {// do nothing - errors can be present
            // if no content script exists on reciever
          }
        });
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return != null) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  }); // For non-tab based
  // TODO: Find use case for this. Ommiting until then.
  // browserAPI.runtime.sendMessage(null, {action: 'storeReady'});
};

exports["default"] = _default;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		var inProgress = {};
/******/ 		var dataWebpackPrefix = "youtube-subtitles-extension:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			var script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					var s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				script.timeout = 120;
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 		
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			var onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				var doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode && script.parentNode.removeChild(script);
/******/ 				doneFns && doneFns.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			}
/******/ 			var timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		var scriptUrl;
/******/ 		if (__webpack_require__.g.importScripts) scriptUrl = __webpack_require__.g.location + "";
/******/ 		var document = __webpack_require__.g.document;
/******/ 		if (!scriptUrl && document) {
/******/ 			if (document.currentScript && document.currentScript.tagName.toUpperCase() === 'SCRIPT')
/******/ 				scriptUrl = document.currentScript.src;
/******/ 			if (!scriptUrl) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				if(scripts.length) {
/******/ 					var i = scripts.length - 1;
/******/ 					while (i > -1 && (!scriptUrl || !/^http(s?):/.test(scriptUrl))) scriptUrl = scripts[i--].src;
/******/ 				}
/******/ 			}
/******/ 		}
/******/ 		// When supporting browsers where an automatic publicPath is not supported you must specify an output.publicPath manually via configuration
/******/ 		// or pass an empty string ("") and set the __webpack_public_path__ variable from your code to use your own logic.
/******/ 		if (!scriptUrl) throw new Error("Automatic publicPath is not supported in this browser");
/******/ 		scriptUrl = scriptUrl.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/\/[^\/]+$/, "/");
/******/ 		__webpack_require__.p = scriptUrl;
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"sidebar": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if(true) { // all chunks have JS
/******/ 							// setup Promise in chunk cache
/******/ 							var promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// start chunk loading
/******/ 							var url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							var error = new Error();
/******/ 							var loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										var realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 		
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkyoutube_subtitles_extension"] = self["webpackChunkyoutube_subtitles_extension"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
/*!********************!*\
  !*** ./sidebar.js ***!
  \********************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _lib_config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./lib/config.js */ "./lib/config.js");
/* harmony import */ var _lib_ui_theme_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./lib/ui/theme.js */ "./lib/ui/theme.js");
/* harmony import */ var _lib_ui_fontManager_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./lib/ui/fontManager.js */ "./lib/ui/fontManager.js");
/* harmony import */ var _lib_services_storeService_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./lib/services/storeService.js */ "./lib/services/storeService.js");
/* harmony import */ var _lib_services_mockService_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./lib/services/mockService.js */ "./lib/services/mockService.js");
/* harmony import */ var _lib_services_transcriptService_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./lib/services/transcriptService.js */ "./lib/services/transcriptService.js");
/* harmony import */ var _lib_ui_configManager_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./lib/ui/configManager.js */ "./lib/ui/configManager.js");
/**
 * Sidebar module for YouTube subtitles extension
 * @module sidebar
 */

// Import dependencies








// Initialize global state
const initPreferredLanguage = async () => {
  const savedLang = await _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getPreferredLanguage();
  return savedLang || 'en';
};

// Initialize state using async function
(async () => {
  if (!window.state) {
    const initialLang = await initPreferredLanguage();
    console.log('[Sidebar] Initializing with language:', initialLang);
    window.state = {
      store: null,
      transcriptFetcher: null,
      preferredLanguage: initialLang
    };
  }
})().catch(error => {
  console.error('[Sidebar] Error initializing state:', error);
  // Fallback to basic initialization if async init fails
  if (!window.state) {
    window.state = {
      store: null,
      transcriptFetcher: null,
      preferredLanguage: 'en'
    };
  }
});

// Local reference to global state
const state = window.state;

// DOM element references
let elements = null;

// Initialize DOM elements
async function initElements() {
  elements = {
    transcript: document.querySelector('#transcript'),
    format: document.querySelector('#format'),
    themeToggle: document.querySelector('#themeToggle'),
    refreshButton: document.querySelector('#refreshButton'),
    configButton: document.querySelector('#configButton'),
    configMenu: document.querySelector('#configMenu'),
    saveConfigBtn: document.querySelector('#saveConfigBtn'),
    cancelConfigBtn: document.querySelector('#cancelConfigBtn'),
    srtProviderInput: document.querySelector('#srtProviderInput'),
    copyButton: document.querySelector('.copy-button'),
    transcriptCopyBtn: document.querySelector('#transcriptCopyBtn'),
    transcriptContainer: document.querySelector('.transcript'),
    transcriptToolbar: document.querySelector('.transcript-toolbar'),
    basicInfo: document.querySelector('.video-info'),
    summaryContainer: document.querySelector('.summary-container'),
    summaryToolbar: document.querySelector('.summary-toolbar'),
    videoTitle: document.querySelector('#title'),
    videoId: document.querySelector('#videoId'),
    summary: document.querySelector('#summary'),
    uiLang: document.querySelector('#uiLang'),
    fontSizeBtn: document.querySelector('#fontSizeBtn'),
    fontSizeMenu: document.querySelector('#fontSizeMenu')
  };

  // Set initial language value from Config
  if (elements.uiLang) {
    try {
      const savedLang = await _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getPreferredLanguage();
      // Only set the value if it's one of our supported languages
      if (savedLang && _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.SUPPORTED_LANGUAGES.includes(savedLang)) {
        elements.uiLang.value = savedLang;
      } else {
        console.warn('[Sidebar] Invalid or missing language preference:', savedLang);
      }
    } catch (error) {
      console.error('[Sidebar] Error loading language preference:', error);
    }
  }

  // Initialize font size
  await (0,_lib_ui_fontManager_js__WEBPACK_IMPORTED_MODULE_2__.initializeFontSize)(elements);

  // Initialize configuration UI
  await (0,_lib_ui_configManager_js__WEBPACK_IMPORTED_MODULE_6__.initializeConfigUI)(elements);

  // Verify all elements are found
  Object.entries(elements).forEach(([name, element]) => {
    if (!element) {
      console.error(`[Sidebar] Element not found: ${name}`);
    }
  });
  return elements;
}

// Update refresh button state
function updateRefreshButton(needsRefresh) {
  const refreshButton = document.querySelector('#refreshButton');
  console.log('[Sidebar] Updating refresh button:', {
    buttonFound: !!refreshButton,
    needsRefresh,
    currentClasses: refreshButton?.classList.toString(),
    timestamp: Date.now()
  });
  if (refreshButton) {
    if (needsRefresh) {
      console.log('[Sidebar] Setting refresh button to inactive state');
      refreshButton.classList.add('needs-refresh');
      refreshButton.classList.add('theme-toggle');
      refreshButton.title = 'Connection lost - click to refresh';
    } else {
      console.log('[Sidebar] Setting refresh button to active state');
      refreshButton.classList.remove('needs-refresh');
      refreshButton.classList.add('theme-toggle');
      refreshButton.title = 'Refresh captions';
    }

    // Log final state
    console.log('[Sidebar] Refresh button updated:', {
      hasNeedsRefreshClass: refreshButton.classList.contains('needs-refresh'),
      title: refreshButton.title,
      allClasses: refreshButton.classList.toString()
    });
  } else {
    console.error('[Sidebar] Refresh button element not found');
  }
}

// Set up event listeners
async function setupEventListeners() {
  if (!elements) {
    console.log('[Sidebar] Initializing elements...');
    elements = await initElements();
  }

  // Theme toggle
  elements.themeToggle?.addEventListener('click', () => (0,_lib_ui_theme_js__WEBPACK_IMPORTED_MODULE_1__.handleThemeToggle)(elements));

  // Font size button
  elements.fontSizeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const isVisible = elements.fontSizeMenu?.classList.contains('visible');
    (0,_lib_ui_fontManager_js__WEBPACK_IMPORTED_MODULE_2__.toggleFontSizeMenu)(elements, !isVisible);
  });

  // Refresh button
  elements.refreshButton?.addEventListener('click', () => {
    console.log('[Sidebar] Refresh button clicked');
    // Reset button state immediately when clicked
    updateRefreshButton(false);

    // Find current YouTube tab and refresh subtitles
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, tabs => {
      if (tabs[0]) {
        const tabId = tabs[0].id;
        console.log('[Sidebar] Found active tab, refreshing subtitles');

        // Send message to content script to refresh subtitles while preserving position
        chrome.tabs.sendMessage(tabId, {
          type: 'REFRESH_SUBTITLES',
          preservePosition: true
        }, async response => {
          if (chrome.runtime.lastError) {
            console.error('[Sidebar] Error refreshing:', chrome.runtime.lastError);
            return;
          }
          if (response?.success) {
            // Refresh sidebar content without full reload
            const currentState = state.store?.getState();
            if (currentState?.videoId && state.transcriptFetcher) {
              try {
                await (0,_lib_services_transcriptService_js__WEBPACK_IMPORTED_MODULE_5__.updateTranscriptDisplay)(elements, currentState, state.transcriptFetcher);
                console.log('[Sidebar] Transcript refreshed successfully');
              } catch (error) {
                console.error('[Sidebar] Error refreshing transcript:', error);
              }
            }
          }
        });
      } else {
        console.log('[Sidebar] No active tab found');
      }
    });
  });

  // Copy button for summary
  elements.copyButton?.addEventListener('click', async () => {
    try {
      const summaryText = elements.summary?.textContent || '';
      await navigator.clipboard.writeText(summaryText);

      // Show check icon
      elements.copyButton.classList.add('copied');

      // Reset back to copy icon after 3 seconds
      setTimeout(() => {
        elements.copyButton.classList.remove('copied');
      }, 3000);
    } catch (error) {
      console.error('[Sidebar] Failed to copy text:', error);
    }
  });

  // Copy button for transcript
  elements.transcriptCopyBtn?.addEventListener('click', async () => {
    try {
      const transcriptText = elements.transcript?.textContent || '';
      await navigator.clipboard.writeText(transcriptText);

      // Show visual feedback
      const transcriptCopyBtn = elements.transcriptCopyBtn;
      if (transcriptCopyBtn) {
        transcriptCopyBtn.classList.add('copied');
        setTimeout(() => {
          transcriptCopyBtn.classList.remove('copied');
        }, 3000);
      }
      console.log('[Sidebar] Copied transcript to clipboard');
    } catch (error) {
      console.error('[Sidebar] Failed to copy transcript:', error);
    }
  });

  // Video ID click to copy URL
  elements.videoId?.addEventListener('click', async () => {
    try {
      const videoId = elements.videoId.textContent.replace('Video ID: ', '').trim();
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      await navigator.clipboard.writeText(youtubeUrl);
    } catch (error) {
      console.error('[Sidebar] Failed to copy video URL:', error);
    }
  });

  // Format change handler
  elements.format?.addEventListener('change', async () => {
    const currentState = state.store?.getState();
    const transcriptFetcher = state.transcriptFetcher;
    if (!currentState?.videoId) {
      console.error('[Sidebar] No video ID available for format change');
      return;
    }
    if (!transcriptFetcher) {
      console.error('[Sidebar] TranscriptFetcher not initialized');
      return;
    }
    try {
      // Update the format and use updateTranscriptDisplay to ensure consistent formatting
      currentState.format = elements.format?.value || 'text';
      // Pass skipSummaryGeneration=true to avoid regenerating the summary when only changing format
      await (0,_lib_services_transcriptService_js__WEBPACK_IMPORTED_MODULE_5__.updateTranscriptDisplay)(elements, currentState, transcriptFetcher, {
        skipSummaryGeneration: true
      });
    } catch (error) {
      console.error('[Sidebar] Error updating transcript format:', error);
    }
  });

  // Add language change handler
  // Add language change handler
  elements.uiLang?.addEventListener('change', async () => {
    const newLang = elements.uiLang.value;
    console.log('[Sidebar] Language change:', {
      newLang,
      element: elements.uiLang,
      currentState: window.state
    });
    try {
      // First update the language preference in storage
      await _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.Config.setPreferredLanguage(newLang);
      console.log('[Sidebar] Updated language preference:', newLang);

      // Update global state with new language
      if (window.state) {
        window.state.preferredLanguage = newLang;

        // Refresh transcript with new language if we have necessary data
        const currentState = window.state.store?.getState();
        if (currentState?.videoId && window.state.transcriptFetcher) {
          // Create a new state object with the updated language
          const updatedState = {
            ...currentState,
            preferredLanguage: newLang
          };
          console.log('[Sidebar] Refreshing transcript with new language:', {
            language: newLang,
            videoId: currentState.videoId
          });

          // Get fresh elements for transcript update
          const elements = {
            transcript: document.querySelector('#transcript'),
            format: document.querySelector('#format')
          };

          // Show loading state
          if (elements.transcript) {
            elements.transcript.textContent = 'Updating transcript...';
          }
          await (0,_lib_services_transcriptService_js__WEBPACK_IMPORTED_MODULE_5__.updateTranscriptDisplay)(elements, updatedState, window.state.transcriptFetcher);
        }
      }
    } catch (error) {
      console.error('[Sidebar] Error refreshing transcript:', error);
    }

    // Disable live captions if English is selected
    if (newLang === 'en') {
      const ccBtn = document.getElementById('ccBtn');
      if (ccBtn) {
        ccBtn.classList.remove('active');
        ccBtn.classList.add('inactive');
      }
      // Force disable live captions
      (0,_lib_config_js__WEBPACK_IMPORTED_MODULE_0__.forceLiveCaptionsDisabled)();
      // Dispatch event to disable live captions
      window.dispatchEvent(new CustomEvent('liveCaptionsToggled', {
        detail: {
          enabled: false
        }
      }));
      // Send message to content script
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_CAPTIONS_LANGUAGE',
            language: newLang,
            disableLiveCaptions: true,
            forceDisable: true
          });
        }
      });
    } else {
      // Send message to content script to update language
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_CAPTIONS_LANGUAGE',
            language: newLang,
            disableLiveCaptions: false
          });
        }
      });
    }
  });

  // Configuration button click handler
  elements.configButton?.addEventListener('click', () => {
    (0,_lib_ui_configManager_js__WEBPACK_IMPORTED_MODULE_6__.toggleConfigMenu)(elements);
  });

  // Save configuration button click handler
  elements.saveConfigBtn?.addEventListener('click', async () => {
    try {
      const urlToSave = elements.srtProviderInput.value;
      console.log('[Sidebar] Attempting to save SRT provider:', urlToSave);
      const savedUrl = await (0,_lib_ui_configManager_js__WEBPACK_IMPORTED_MODULE_6__.saveSrtProvider)(urlToSave);
      console.log('[Sidebar] SRT provider save result:', savedUrl);

      // Verify the save was successful by reading it back
      const verifiedUrl = await (0,_lib_ui_configManager_js__WEBPACK_IMPORTED_MODULE_6__.getSrtProvider)();
      console.log('[Sidebar] Verified saved SRT provider:', verifiedUrl);
      if (verifiedUrl) {
        console.log('[Sidebar] SRT provider saved successfully');
        // Close the menu after saving
        (0,_lib_ui_configManager_js__WEBPACK_IMPORTED_MODULE_6__.toggleConfigMenu)(elements, false);
      } else {
        console.error('[Sidebar] SRT provider verification failed, saved URL not found');
        alert('Failed to save SRT provider URL. Please try again.');
      }
    } catch (error) {
      console.error('[Sidebar] Error saving SRT provider:', error);
      alert('Error saving SRT provider: ' + error.message);
    }
  });

  // Cancel configuration button click handler
  elements.cancelConfigBtn?.addEventListener('click', () => {
    (0,_lib_ui_configManager_js__WEBPACK_IMPORTED_MODULE_6__.toggleConfigMenu)(elements);
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Sidebar] Received message:', {
    type: request.type,
    source: request.source,
    timestamp: Date.now()
  });
  if (request.type === 'UPDATE_REFRESH_BUTTON') {
    console.log('[Sidebar] Updating refresh button from content script:', {
      needsRefresh: request.needsRefresh,
      source: request.source,
      timestamp: Date.now()
    });
    updateRefreshButton(request.needsRefresh);
    sendResponse({
      success: true
    });
  }
  return true;
});

// Initialize everything when the document is ready
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize elements and event listeners
  await setupEventListeners();

  // Initialize theme
  await (0,_lib_ui_theme_js__WEBPACK_IMPORTED_MODULE_1__.initializeTheme)(elements);

  // Initialize store subscription
  await (0,_lib_services_storeService_js__WEBPACK_IMPORTED_MODULE_3__.initStoreSubscription)(elements);

  // Initialize CC button state
  const ccBtn = document.getElementById('ccBtn');
  if (ccBtn) {
    // Get initial state from storage
    const isEnabled = await _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getLiveCaptionsEnabled();
    ccBtn.classList.toggle('active', isEnabled);
    ccBtn.classList.toggle('inactive', !isEnabled);
    ccBtn.addEventListener('click', async () => {
      const preferredLang = await _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getPreferredLanguage();
      if (preferredLang === 'en') {
        console.log('[Sidebar] CC button click ignored - English selected');
        return;
      }

      // Toggle live captions and update UI state
      const isEnabled = await (0,_lib_config_js__WEBPACK_IMPORTED_MODULE_0__.toggleLiveCaptions)();
      ccBtn.classList.toggle('active', isEnabled);
      ccBtn.classList.toggle('inactive', !isEnabled);

      // Only notify content script about live captions state
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'UPDATE_CAPTIONS_LANGUAGE',
            language: preferredLang,
            disableLiveCaptions: !isEnabled
          });
        }
      });
    });
  }

  // Initialize bullet list button state
  const bulletListBtn = document.getElementById('bulletListBtn');
  if (bulletListBtn) {
    // Get initial state from Config
    const isEnabled = await _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.Config.getBulletListEnabled();
    bulletListBtn.classList.toggle('active', isEnabled);
    bulletListBtn.classList.toggle('inactive', !isEnabled);
    bulletListBtn.addEventListener('click', async () => {
      const isEnabled = bulletListBtn.classList.contains('inactive');

      // Store state in Config
      await _lib_config_js__WEBPACK_IMPORTED_MODULE_0__.Config.setBulletListEnabled(isEnabled);
      bulletListBtn.classList.toggle('active', isEnabled);
      bulletListBtn.classList.toggle('inactive', !isEnabled);

      // Get current transcript content
      const transcript = document.getElementById('transcript');
      const summary = document.getElementById('summary');
      if (transcript && summary) {
        try {
          // Show loading state
          summary.textContent = 'Loading summary...';
          summary.classList.add('translating');

          // Get current state
          const currentState = state.store.getState();
          const targetLang = currentState.preferredLanguage;

          // Check if we're using proxy SRT
          const isProxySource = currentState.isProxySource === true;
          const proxy = isProxySource ? currentState.proxy : null;

          // Request new summary with updated mode
          await (0,_lib_services_transcriptService_js__WEBPACK_IMPORTED_MODULE_5__.autoSummarize)({
            videoId: currentState.videoId,
            title: currentState.title,
            transcriptArg: currentState.transcriptArg,
            preferredLanguage: targetLang,
            isProxySource: isProxySource,
            proxy: proxy,
            mode: isEnabled ? 'bullet' : 'narrative'
          }, transcript.textContent, targetLang);
          summary.classList.remove('translating');
        } catch (error) {
          console.error('[Sidebar] Error updating summary:', error);
          summary.textContent = 'Failed to update summary. Please try again.';
          summary.classList.add('error');
        }
      }
    });
  }
});

// Clean up on unload
window.addEventListener('unload', () => {
  (0,_lib_services_storeService_js__WEBPACK_IMPORTED_MODULE_3__.cleanupStore)();
});

// Add CSS for refresh button states
const style = document.createElement('style');
style.textContent = `
  #refreshButton.needs-refresh {
    background-color: #ff9800 !important;
    animation: pulse 2s infinite;
  }

  .error {
    color: var(--text-secondary) !important;
    font-style: italic;
  }

  .loading {
    opacity: 0.7;
  }

  .translating {
    opacity: 0.7;
  }

  /* Error state transitions */
  .error {
    transition: all 0.3s ease-in-out;
  }
`;
document.head.appendChild(style);

// Expose mock functions to window for console access
window.userMock = _lib_services_mockService_js__WEBPACK_IMPORTED_MODULE_4__.userMock;
window.toggleMockMode = _lib_services_mockService_js__WEBPACK_IMPORTED_MODULE_4__.toggleMockMode;
// Make updateRefreshButton accessible from content script
window.updateRefreshButton = updateRefreshButton;
})();

/******/ })()
;
//# sourceMappingURL=sidebar.js.map