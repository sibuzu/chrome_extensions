/**
 * Fetches video data from YouTube player
 */
export default class VideoDataFetcher {
  constructor() {
    this.cache = new Map();
    this.currentVideoId = null;
    this.lastVideoId = null;
    this.lastNavigationTime = 0;
    this.lastUrl = null;
  }

  /**
   * Update the last URL
   * @param {string} url - Current URL
   */
  updateUrl(url) {
    this.lastUrl = url;
  }

  /**
   * Get video data for a specific video ID
   * @param {string} videoId - YouTube video ID
   * @param {number} retryCount - Number of retries
   * @returns {Promise<object>} Video data
   */
  async getVideoData(videoId, retryCount) {
    try {
      // Check cache first
      if (this.cache.has(videoId)) {
        console.log('[VideoDataFetcher] Cache hit for:', videoId);
        return this.cache.get(videoId);
      }

      const isInitialLoad = this.isInitialPageLoad();
      console.log('[VideoDataFetcher] Getting data:', {
        videoId,
        type: isInitialLoad ? 'Initial Load' : 'Navigation',
        attempt: retryCount === 3 ? 1 : 4 - retryCount,
      });

      // For initial load, try getting data from page source first
      if (isInitialLoad) {
        try {
          console.log('[VideoDataFetcher] Initial load - attempting to get data from page source...');
          const data = await this.getInitialData(videoId);
          if (data) {
            return data;
          }
        } catch (error) {
          console.log('[VideoDataFetcher] Could not get initial data:', error);
        }
      } else {
        // For SPA navigation, wait for player data to become available
        console.log('[VideoDataFetcher] SPA navigation - waiting for player data...');
        const videoData = await this.waitForPlayerData(videoId, 50);

        if (videoData) {
          console.log('[VideoDataFetcher] Got player data:', videoData);

          // Log if there's a mismatch but return the data anyway
          if (videoData.video_id !== videoId) {
            console.log('[VideoDataFetcher] Warning: Video ID mismatch', {
              expected: videoId,
              actual: videoData.video_id,
            });
          }

          return {
            videoId: videoData.video_id,
            title: videoData.title,
            captions: videoData.captions,
            hasCaptions: !!videoData.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length,
            isInitialLoad: false,
          };
        }
      }

      throw new Error('Could not get video data');
    } catch (error) {
      console.error('[VideoDataFetcher] Error getting video data:', error);

      // Retry on error if we have retries left
      if (retryCount > 0) {
        console.log('[VideoDataFetcher] Retrying after error...');
        await this._delay(1000);
        return this.getVideoData(videoId, retryCount - 1);
      }

      throw error;
    }
  }

  /**
   * Helper to detect if this is initial page load
   * @returns {boolean} Whether this is an initial page load
   */
  isInitialPageLoad() {
    const currentUrl = this.lastUrl;
    const isUrlChange = currentUrl !== this.lastUrl;

    // For SPA navigation, we care about URL changes within YouTube
    const isSPANavigation = isUrlChange
            && this.lastUrl.includes('youtube.com/watch')
            && currentUrl.includes('youtube.com/watch');

    // Log detection details
    console.log('[VideoDataFetcher] Load type detection:', {
      currentUrl,
      lastUrl: this.lastUrl,
      isUrlChange,
      isSPANavigation,
      timeSinceLastNav: Date.now() - this.lastNavigationTime,
    });

    // Update tracking state
    this.lastNavigationTime = Date.now();

    // It's an initial load if it's not a SPA navigation between watch pages
    return !isSPANavigation;
  }

  /**
   * Helper to get player data through background script
   * @returns {Promise<object>} Player data
   */
  async getPlayerDataFromPage() {
    const player = await this._getPlayer();
    if (!player) {
      throw new Error('Player not found');
    }
    return player.getPlayerResponse();
  }

  /**
   * Helper to wait for player data (during SPA navigation)
   * @param {string} videoId - YouTube video ID
   * @param {number} maxAttempts - Maximum number of attempts
   * @returns {Promise<object>} Player data
   */
  async waitForPlayerData(videoId, maxAttempts) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        console.log(`[VideoDataFetcher] Attempt ${i + 1}/${maxAttempts} to get player data...`);
        const videoData = await this.getPlayerDataFromPage();

        if (videoData) {
          console.log('[VideoDataFetcher] Current player data:', {
            attempt: i + 1,
            videoData,
            expectedId: videoId,
            matches: videoData?.video_id === videoId,
          });

          if (videoData.video_id === videoId) {
            return {
              videoId: videoData.video_id,
              title: videoData.title,
              captions: videoData.captions,
              hasCaptions: !!videoData.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length,
              isInitialLoad: false,
            };
          }
          console.log('[VideoDataFetcher] Video ID mismatch, retrying...');
        }
      } catch (e) {
        console.log('[VideoDataFetcher] Error getting video data:', {
          attempt: i + 1,
          error: e.message,
        });
      }

      // Wait before next attempt
      await this._delay(100);
    }

    console.log('[VideoDataFetcher] Failed to get player data after', maxAttempts, 'attempts');
    throw new Error(`Failed to get player data after ${maxAttempts} attempts`);
  }

  /**
   * Get data for initial page load
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<object>} Video data
   */
  async getInitialData(videoId) {
    try {
      // First try to get data from page source
      console.log('[VideoDataFetcher] Trying to get initial data from page source...');
      const initialResponse = await this._getInitialData();

      if (initialResponse?.videoDetails?.videoId === videoId) {
        const captionTrack = initialResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0];
        
        // Add safety checks for URL parsing
        let captionVideoId = null;
        if (captionTrack?.baseUrl) {
          try {
            captionVideoId = new URL(captionTrack.baseUrl).searchParams.get('v');
          } catch (e) {
            console.log('[VideoDataFetcher] Invalid caption URL:', captionTrack.baseUrl);
          }
        }

        console.log('[VideoDataFetcher] Found initial data in page source:', {
          videoId,
          title: initialResponse?.videoDetails?.title,
          hasCaptions: !!initialResponse?.captions,
          captionDetails: captionTrack ? {
            url: captionTrack.baseUrl || null,
            lang: captionTrack.languageCode,
            kind: captionTrack.kind,
            videoId: captionVideoId
          } : null,
        });

        return {
          videoId,
          title: initialResponse?.videoDetails?.title,
          captions: initialResponse?.captions,
          hasCaptions: !!initialResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length,
          isInitialLoad: true,
        };
      }

      // If page source data doesn't match video ID, try fresh fetch
      console.log('[VideoDataFetcher] Page source data mismatch, fetching fresh data...');
      const freshResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const html = await freshResponse.text();
      const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);

      if (match) {
        const data = JSON.parse(match[1]);
        const captionTrack = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.[0];

        console.log('[VideoDataFetcher] Found fresh initial data:', {
          videoId,
          title: data?.videoDetails?.title,
          hasCaptions: !!data?.captions,
          captionDetails: captionTrack ? {
            url: captionTrack.baseUrl,
            lang: captionTrack.languageCode,
            kind: captionTrack.kind,
            videoId: new URL(captionTrack.baseUrl).searchParams.get('v'),
          } : null,
        });

        return {
          videoId,
          title: data?.videoDetails?.title,
          captions: data?.captions,
          hasCaptions: !!data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length,
          isInitialLoad: true,
        };
      }

      throw new Error('Could not get initial data from page source or fresh fetch');
    } catch (error) {
      console.error('[VideoDataFetcher] Error getting initial data:', error);
      throw error;
    }
  }

  /**
   * Helper to get player response from page source
   * @returns {Promise<object>} Player response
   */
  async getPlayerResponseFromPage() {
    const response = await this._getPlayerResponse();
    if (!response) {
      throw new Error('Player response not found');
    }
    this.playerResponse = response;
    return response;
  }

  /**
   * Helper to get fresh captions
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<object>} Caption data
   */
  async getFreshCaptions(videoId) {
    const cachedCaptions = this.cache.get(`captions_${videoId}`);
    if (cachedCaptions) {
      return cachedCaptions;
    }

    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const html = await response.text();
      const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);

      if (!match) {
        throw new Error('Could not find player data in page');
      }

      const data = JSON.parse(match[1]);
      const captions = data?.captions?.playerCaptionsTracklistRenderer;

      if (!captions) {
        throw new Error('No captions found in video data');
      }

      this.cache.set(`captions_${videoId}`, captions);
      return captions;
    } catch (error) {
      throw new Error(`Failed to fetch captions: ${error.message}`);
    }
  }

  /**
   * Wait for player to be ready
   * @returns {Promise<object>} Player
   * @static
   */
  static async waitForPlayer() {
    return new Promise((resolve) => {
      const checkForPlayer = () => {
        const player = document.querySelector('#movie_player');
        if (player) {
          resolve(player);
          return;
        }
        setTimeout(checkForPlayer, 100);
      };
      checkForPlayer();
    });
  }

  /**
   * Wait for player data to stabilize
   * @returns {Promise<object>} Player data
   * @static
   */
  static async waitForPlayerDataStable() {
    return new Promise((resolve) => {
      let lastData = null;
      let stableCount = 0;

      const checkStability = () => {
        const player = document.querySelector('#movie_player');
        if (!player?.getVideoData) {
          setTimeout(checkStability, 100);
          return;
        }

        const currentData = player.getVideoData();
        if (!currentData?.video_id) {
          setTimeout(checkStability, 100);
          return;
        }

        if (JSON.stringify(currentData) === JSON.stringify(lastData)) {
          stableCount++;
          if (stableCount >= 3) {
            resolve(currentData);
            return;
          }
        } else {
          stableCount = 0;
        }

        lastData = currentData;
        setTimeout(checkStability, 100);
      };

      checkStability();
    });
  }

  /**
   * Wait for fresh data to be available
   * @returns {Promise<object>} Fresh data
   * @static
   */
  static async waitForFreshData() {
    return new Promise((resolve) => {
      const checkData = () => {
        const data = window.ytInitialPlayerResponse;
        if (data?.videoDetails) {
          resolve(data);
          return;
        }
        setTimeout(checkData, 100);
      };
      checkData();
    });
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.cache.clear();
    this.currentVideoId = null;
  }

  /**
   * Helper function for delay
   * @param {number} ms - Delay in milliseconds
   * @returns {Promise<void>}
   * @private
   */
  async _delay(ms) {
    if (!this.delayPromises) {
      this.delayPromises = new Map();
    }
    const key = Date.now();
    const promise = new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.delayPromises.delete(key);
        resolve();
      }, ms);
      this.delayPromises.set(key, timeoutId);
    });
    return promise;
  }

  /**
   * Helper function to retry an operation
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @param {number} delayMs - Delay between retries
   * @returns {Promise<any>} Operation result
   * @private
   */
  async _retry(operation, maxRetries = 3, delayMs = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await this._delay(delayMs);
        }
      }
    }
    throw lastError;
  }

  // Private helper methods
  async _getPlayer() {
    this.player = document.querySelector('#movie_player');
    return this.player;
  }

  async _getInitialData() {
    const { ytInitialData } = window;
    this.initialData = ytInitialData || null;
    return this.initialData;
  }

  async _getPlayerResponse() {
    const player = await this._getPlayer();
    if (player) {
      this.playerResponse = await player.getPlayerResponse();
      return this.playerResponse;
    }
    return null;
  }
}
