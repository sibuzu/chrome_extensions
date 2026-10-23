import { YouTubeTranscriptError } from './errors.js';

/**
 * Fetches and formats YouTube video transcripts
 */
export default class TranscriptFetcher {
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
      language: this.preferredLanguage,
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
      const text = match[3].replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'');

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
          const xml = await this.getTranscript({ baseUrl: this.transcriptUrl });
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
      const xml = await this.getTranscript({ baseUrl: this.transcriptUrl });
      return TranscriptFetcher.parseYouTubeXML(xml);
    } catch (error) {
      console.error('[TranscriptFetcher] Error:', error);
      if (error instanceof YouTubeTranscriptError) {
        throw error;
      }
      throw new YouTubeTranscriptError(error.message);
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
    let selectedTrack = captionsData.captionTracks.find(t => (
      t.languageCode.toLowerCase() === normalizedWanted
    ));

    if (!selectedTrack) {
      // Log available languages and fallback
      const tracks = captionsData.captionTracks;
      const availableLangs = tracks
        .map(t => t.languageCode)
        .join(', ');
      console.log('[TranscriptFetcher] Language not found:', { 
        wanted: preferredLang,
        available: availableLangs 
      });

      // Try English or fall back to first available
      // Try English first
      selectedTrack = captionsData.captionTracks.find(t => (
        t.languageCode === 'en' || 
        t.languageCode === 'en-US'
      ));
      
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
    return transcript
      .map((entry, index) => {
        const startTime = TranscriptFetcher._formatTimestamp(entry.start);
        const endTime = TranscriptFetcher._formatTimestamp(entry.start + entry.duration);
        return `${index + 1}\n${startTime} --> ${endTime}\n${entry.text}\n`;
      })
      .join('\n');
  }

  /**
   * Format transcript as digest
   * @param {Array} transcript - Transcript data
   * @returns {string} Digest formatted transcript
   */
  static formatDigest(transcript) {
    return transcript.map((item) => item.text).join('\n');
  }

  /**
   * Format seconds to SRT timestamp
   * @param {number} seconds Time in seconds
   * @returns {string} SRT formatted timestamp
   * @private
   */
  static _formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
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
      videoId: this.videoId,
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
    const entryIndex = transcript.findIndex((entry) => {
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
        end: batchEnd,
      },
      totalBatches: Math.ceil(transcript.length / batchSize),
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
