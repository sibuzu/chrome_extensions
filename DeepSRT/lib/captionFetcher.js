/**
 * Fetches and processes YouTube video captions
 */
export default class CaptionFetcher {
  constructor() {
    this.playerResponse = null;
    this.captionTracks = null;
    this.currentVideoId = null;
  }

  /**
   * Get player response data
   * @returns {Promise<object>} Player response data
   */
  async getPlayerResponse() {
    try {
      const playerResponse = await CaptionFetcher.getPlayerResponseFromPage();
      if (!playerResponse) {
        throw new Error('No player response available');
      }
      this.playerResponse = playerResponse;
      return playerResponse;
    } catch (error) {
      console.error('[CaptionFetcher] Error getting player response:', error);
      throw error;
    }
  }

  /**
   * Get player response from page
   * @returns {Promise<object>} Player response data
   * @static
   */
  static async getPlayerResponseFromPage() {
    try {
      const ytPlayer = document.querySelector('#movie_player');
      if (!ytPlayer) {
        throw new Error('YouTube player not found');
      }
      return ytPlayer.getPlayerResponse();
    } catch (error) {
      console.error('[CaptionFetcher] Error getting player response from page:', error);
      throw error;
    }
  }

  /**
   * Wait for player to be available
   * @param {number} maxAttempts - Maximum number of attempts
   * @param {number} delayMs - Delay between attempts in milliseconds
   * @returns {Promise<Element>} YouTube player element
   * @static
   */
  static async waitForPlayer(maxAttempts = 5, delayMs = 1000) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const player = document.querySelector('#movie_player');
        if (player && typeof player.getPlayerResponse === 'function') {
          return player;
        }
      } catch (error) {
        console.warn('[CaptionFetcher] Error checking player:', error);
      }
      await CaptionFetcher.delay(delayMs);
      attempts++;
    }
    throw new Error(`Player not found after ${maxAttempts} attempts`);
  }

  /**
   * Helper function for delay
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>}
   * @static
   */
  static async delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Get caption tracks
   * @param {boolean} forceRefresh - Force refresh of caption tracks
   * @returns {Promise<Array>} Caption tracks
   */
  async getCaptionTracks(forceRefresh = false) {
    try {
      if (!forceRefresh && this.captionTracks) {
        return this.captionTracks;
      }

      const playerResponse = await this.getPlayerResponse();
      if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        throw new Error('No caption tracks available');
      }

      this.captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      return this.captionTracks;
    } catch (error) {
      console.error('[CaptionFetcher] Error getting caption tracks:', error);
      throw error;
    }
  }

  /**
   * Fetch captions
   * @param {string} languageCode - Language code for captions
   * @returns {Promise<Array>} Fetched captions
   */
  async fetchCaptions(languageCode = 'en') {
    try {
      const tracks = await this.getCaptionTracks();
      const track = tracks.find((t) => t.languageCode === languageCode);

      if (!track) {
        throw new Error(`No captions available for language: ${languageCode}`);
      }

      const response = await fetch(track.baseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch captions: ${response.statusText}`);
      }

      const xml = await response.text();
      return CaptionFetcher.parseCaptionXml(xml);
    } catch (error) {
      console.error('[CaptionFetcher] Error fetching captions:', error);
      throw error;
    }
  }

  /**
   * Parse caption XML
   * @param {string} xml - XML string to parse
   * @returns {Array} Parsed captions
   * @static
   */
  static parseCaptionXml(xml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const textNodes = doc.getElementsByTagName('text');

      return Array.from(textNodes).map((node) => ({
        start: parseFloat(node.getAttribute('start')),
        duration: parseFloat(node.getAttribute('dur')),
        text: node.textContent.trim(),
      }));
    } catch (error) {
      console.error('[CaptionFetcher] Error parsing caption XML:', error);
      throw error;
    }
  }

  /**
   * Log caption tracks for debugging
   * @param {Array} tracks - Caption tracks to log
   * @static
   */
  static logCaptionTracks(tracks) {
    console.log(
      '[CaptionFetcher] Available caption tracks:',
      tracks.map((track) => ({
        language: track.languageCode,
        name: track.name?.simpleText,
        kind: track.kind,
        isTranslatable: track.isTranslatable,
      })),
    );
  }

  /**
   * Log fetch results for debugging
   * @param {Array} captions - Fetched captions to log
   * @static
   */
  static logFetchResults(captions) {
    console.log('[CaptionFetcher] Fetched captions:', {
      count: captions.length,
      firstCaption: captions[0],
      lastCaption: captions[captions.length - 1],
    });
  }

  /**
   * Get video title
   * @returns {string} Video title
   */
  getVideoTitle() {
    try {
      if (!this.playerResponse?.videoDetails?.title) {
        throw new Error('Video title not available');
      }
      return this.playerResponse.videoDetails.title;
    } catch (error) {
      console.error('[CaptionFetcher] Error getting video title:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.playerResponse = null;
    this.captionTracks = null;
    this.currentVideoId = null;
  }
}
