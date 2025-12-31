/**
 * Manages subtitles display and synchronization with YouTube player
 */

import { SubtitlesGenerator, getSubtitles } from './subtitles.js';
import { SUBTITLES_CONFIG } from './config.js';
import { Config } from './config.js';

const { STYLES, UPDATE_INTERVAL } = SUBTITLES_CONFIG;

export default class SubtitlesManager {
  constructor() {
    this.subtitlesGenerator = null;
    this.currentVideoId = null;
    this.subtitlesContainer = null;
    this.updateInterval = null;
    this.lastDisplayedIndex = null;
    this.lastLoggedBatch = null;
    this.lastLoggedTime = 0;
    this.initialized = false;
    this.nativeCaptionsLang = null;
    this.isShowingNativeCaptions = false;
    
    // Initialize enabled state from storage
    this.initializeState();

    // Listen for live captions toggle
    window.addEventListener('liveCaptionsToggled', (event) => {
      console.log('[SubtitlesManager] Received liveCaptionsToggled event:', event.detail);
      this.setEnabled(event.detail.enabled);
    });

    // Listen for messages from extension
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      console.log('[SubtitlesManager] Received message:', message);
      if (message.type === 'UPDATE_CAPTIONS_LANGUAGE') {
        if (this.subtitlesGenerator) {
          console.log('[SubtitlesManager] Updating captions language to:', message.language);
          
          // Handle live captions state
          if (message.disableLiveCaptions) {
            console.log('[SubtitlesManager] Disabling live captions');
            this.setEnabled(false);
            Config.setLiveCaptionsEnabled(false);
            
            // If force disable, also clean up resources
            if (message.forceDisable) {
              console.log('[SubtitlesManager] Force disabling live captions - cleaning up resources');
              this.cleanup();
            }
          } else {
            // Always handle language change, regardless of language
            console.log('[SubtitlesManager] Re-initializing live captions with new language');
            await this.handleLanguageChange(message.language);
            
            // Re-enable captions explicitly if they were enabled
            const isEnabled = await Config.getLiveCaptionsEnabled();
            if (isEnabled) {
              console.log('[SubtitlesManager] Re-enabling captions after language change');
              await this.setEnabled(true);
            }
          }
        }
      }
      sendResponse({ success: true });
      return true;
    });
  }

  async initializeState() {
    // Get initial state from storage
    const isEnabled = await Config.getLiveCaptionsEnabled();
    this.enabled = isEnabled;
    SUBTITLES_CONFIG.ENABLE_LIVE_SUBTITLES = isEnabled;
    
    console.log('[SubtitlesManager] Initialized state from storage:', {
      enabled: isEnabled
    });

    if (isEnabled) {
      // If enabled, start processing
      this.startProcessing();
    }
  }

  /**
   * Initialize subtitles system for a video
   * @param {object} playerData YouTube player data
   * @param {string} videoId Video ID
   */
  async initialize(playerData, videoId) {
    console.log('[SubtitlesManager] Initializing with videoId:', videoId);
    if (this.currentVideoId === videoId) {
      console.log('[SubtitlesManager] Already initialized for this video');
      return;
    }

    this.currentVideoId = videoId;
    this.initialized = true;
    
    // Get native captions info
    const captionsInfo = await getSubtitles(videoId);
    this.nativeCaptionsLang = captionsInfo?.languageCode || null;
    console.log('[SubtitlesManager] Native captions language:', this.nativeCaptionsLang);
    
    // Get user's preferred language
    const userPreferredLang = localStorage.getItem('uiLang') || 'en';
    console.log('[SubtitlesManager] User preferred language:', userPreferredLang);
    
    // Only check CC preference
    const userCCPreference = await Config.getLiveCaptionsEnabled();
    
    console.log('[SubtitlesManager] Captions state:', {
      userCCPreference,
      currentEnabled: this.enabled,
      nativeCaptionsLang: this.nativeCaptionsLang,
      userPreferredLang
    });
    
    if (!userCCPreference) {
      // If CC is off, disable everything
      this.enabled = false;
      await Config.setLiveCaptionsEnabled(false);
      console.log('[SubtitlesManager] Captions disabled by user preference');
      
      // Make sure native captions are also disabled
      await this.disableYouTubeNativeCaptions();
      return;
    }
    
    // Check if native captions in user's preferred language are available
    if (this.nativeCaptionsLang && this.nativeCaptionsLang.toLowerCase() === userPreferredLang.toLowerCase()) {
      // If native captions in user's preferred language are available, use them directly
      console.log(
        `[SubtitlesManager] Native captions in user's preferred language (${userPreferredLang}) are available. ` +
        `Using native captions without live translation.`
      );
      this.isShowingNativeCaptions = true;
      // Still enable captions but don't start live translation
      this.enabled = true;
      await Config.setLiveCaptionsEnabled(true);
      
      // Set up container but don't create subtitles generator or process batches
      this.setupSubtitlesContainer();
      
      // Enable YouTube's native captions with the user's preferred language
      await this.enableYouTubeNativeCaptions(userPreferredLang);
      
      this.startSubtitlesSync();
      return; // Return early to skip creating subtitles generator
    } 
    
    // If native captions in user's preferred language are not available, use live translation
    console.log(
      `[SubtitlesManager] Native captions in user's preferred language (${userPreferredLang}) are not available. ` +
      `Using live translation.`
    );
    this.isShowingNativeCaptions = false;
    this.enabled = true;
    await Config.setLiveCaptionsEnabled(true);
    
    // Make sure native captions are disabled when using DeepSRT
    await this.disableYouTubeNativeCaptions();
    
    await this.startProcessing();
    
    this.setupSubtitlesContainer();
    this.startSubtitlesSync();
  }

  /**
   * Set up the container for displaying subtitles
   */
  setupSubtitlesContainer() {
    // Remove existing container if any
    if (this.subtitlesContainer) {
      this.subtitlesContainer.remove();
    }

    // Create and style the container
    this.subtitlesContainer = document.createElement('div');
    this.subtitlesContainer.className = 'twsrt-subtitles-container';
    Object.assign(this.subtitlesContainer.style, STYLES.CONTAINER);

    // Add to player
    const player = document.getElementById('movie_player');
    if (!player) {
      console.error('[SubtitlesManager] Could not find YouTube player element');
      return;
    }
    
    console.log('[SubtitlesManager] Found YouTube player:', player);
    player.appendChild(this.subtitlesContainer);
    console.log('[SubtitlesManager] Added subtitles container to player');
  }

  /**
   * Start synchronization with video playback
   */
  startSubtitlesSync() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Don't start sync if live subtitles are disabled
    if (!SUBTITLES_CONFIG.ENABLE_LIVE_SUBTITLES) {
      console.log('[SubtitlesManager] Live subtitles disabled');
      return;
    }

    console.log('[SubtitlesManager] Starting subtitles sync');
    
    // If we're showing native captions in the user's preferred language, don't use our custom subtitles
    if (this.isShowingNativeCaptions) {
      console.log('[SubtitlesManager] Using native captions - not displaying custom subtitles');
      // Clear our custom subtitles container
      this.clearSubtitles();
      return;
    }
    
    this.updateInterval = setInterval(() => {
      const player = document.getElementById('movie_player');
      if (!player) {
        console.error('[SubtitlesManager] Could not find YouTube player element');
        return;
      }

      const video = player.querySelector('video');
      if (!video) {
        console.error('[SubtitlesManager] Could not find video element in player');
        return;
      }

      const currentTime = video.currentTime;
      
      // Only log time if it changed by more than 1 second
      if (Math.abs(currentTime - this.lastLoggedTime) >= 1) {
        console.debug(`[SubtitlesManager] Time: ${currentTime.toFixed(1)}`);
        this.lastLoggedTime = currentTime;
      }
      
      const subtitle = this.subtitlesGenerator.getCurrentSubtitle(currentTime);
      if (subtitle) {
        this.displaySubtitle(subtitle);
      } else {
        this.clearSubtitles();
      }

      // Get current batch and pre-fetch next batches
      const currentBatch = this.subtitlesGenerator.getCurrentBatch(currentTime);
      
      if (currentBatch !== null) {
        // Process current batch if needed
        if (currentBatch !== this.subtitlesGenerator.currentBatch) {
          this.processBatchWithLogging(currentBatch);
          this.subtitlesGenerator.currentBatch = currentBatch;
        }

        // Special handling for batch 1 - fetch batches 1, 2, and 3
        if (currentBatch === 1) {
          for (let offset = 0; offset <= 2; offset++) {
            const nextBatch = currentBatch + offset;
            if (nextBatch < this.subtitlesGenerator.totalBatches &&
                !this.subtitlesGenerator.pendingBatches.has(nextBatch)) {
              console.log(`[SubtitlesManager] Pre-fetching batch ${nextBatch} (initial load)`);
              this.processBatchWithLogging(nextBatch);
            }
          }
        }
        // For other batches, pre-fetch next 2 batches
        else if (currentBatch > 1) {
          for (let offset = 1; offset <= 2; offset++) {
            const nextBatch = currentBatch + offset;
            if (nextBatch < this.subtitlesGenerator.totalBatches &&
                !this.subtitlesGenerator.pendingBatches.has(nextBatch)) {
              console.log(`[SubtitlesManager] Pre-fetching batch ${offset} ahead:`, nextBatch);
              this.processBatchWithLogging(nextBatch);
            }
          }
        }
      }
    }, UPDATE_INTERVAL);
  }

  /**
   * Process a batch with consistent logging
   * @param {number} batchNumber Batch to process
   * @private
   */
  async processBatchWithLogging(batchNumber) {
    console.log('[SubtitlesManager] Processing batch:', {
      number: batchNumber,
      isPending: this.subtitlesGenerator.pendingBatches.has(batchNumber)
    });
    
    try {
      // Get preferred language using proper Config method
      const preferredLang = await Config.getPreferredLanguage();
      
      const blocks = await this.subtitlesGenerator.processBatch(batchNumber, preferredLang);
      if (blocks?.length > 0) {
        console.log('[SubtitlesManager] Batch completed:', {
          number: batchNumber,
          blocks: blocks.length,
          language: preferredLang
        });
      }
    } catch (error) {
      console.error(`[SubtitlesManager] Batch ${batchNumber} failed:`, error);
    }
  }

  /**
   * Display subtitle on screen
   * @param {object} subtitle Subtitle block to display
   */
  async displaySubtitle(subtitle) {
    if (!this.subtitlesContainer) return;

    // Only log if this is a new subtitle index
    const isNewSubtitle = this.lastDisplayedIndex !== subtitle.index;
    this.lastDisplayedIndex = subtitle.index;

    // Skip displaying our captions if native YouTube captions match preferred language
    const preferredLang = await Config.getPreferredLanguage();
    const matches = this.nativeCaptionsLang?.toLowerCase() === preferredLang?.toLowerCase();
    
    if (this.nativeCaptionsLang && matches) {
      // Only log when switching to native captions mode
      if (!this.isShowingNativeCaptions) {
        console.log('[SubtitlesManager] Using native captions - showing original only');
        this.isShowingNativeCaptions = true;
      }
      const blockStyle = this._styleToString(STYLES.SUBTITLE_BLOCK);
      const originalStyle = this._styleToString({
        ...STYLES.ZH_TW,
        marginTop: '8px'
      });
      this.subtitlesContainer.innerHTML = `
        <div class="twsrt-subtitle-block" style="${blockStyle}">
          <div class="twsrt-subtitle original" style="${originalStyle}">${subtitle.content.Original}</div>
        </div>
      `;
      return;
    }
    
    // Reset native captions flag when switching to translated mode
    this.isShowingNativeCaptions = false;

    // Only show if we have both languages
    if (!subtitle.content.Translated) {
      if (isNewSubtitle) {
        console.log('[SubtitlesManager] Waiting for translation:', {
          index: subtitle.index
        });
      }
      const blockStyle = this._styleToString(STYLES.SUBTITLE_BLOCK);
      const enStyle = this._styleToString({
        ...STYLES.EN,
        marginTop: '8px' // Add spacing above English text
      });
      this.subtitlesContainer.innerHTML = `
        <div class="twsrt-subtitle-block" style="${blockStyle}">
          <div class="twsrt-subtitle original" style="${enStyle}">${subtitle.content.Original}</div>
        </div>
      `;
      return;
    }

    if (isNewSubtitle) {
      console.log('[SubtitlesManager] New subtitle:', {
        index: subtitle.index
      });
    }

    const blockStyle = this._styleToString(STYLES.SUBTITLE_BLOCK);
    const translatedStyle = this._styleToString({
      ...STYLES.ZH_TW,
      marginBottom: '8px' // Add spacing between translated and English
    });
    const enStyle = this._styleToString({
      ...STYLES.EN,
      marginTop: '8px' // Add spacing above English text
    });
    
    this.subtitlesContainer.innerHTML = `
      <div class="twsrt-subtitle-block" style="${blockStyle}">
        <div class="twsrt-subtitle translated" style="${translatedStyle}">${subtitle.content.Translated}</div>
        <div class="twsrt-subtitle original" style="${enStyle}">${subtitle.content.Original}</div>
      </div>
    `;
  }

  /**
   * Convert style object to string
   * @param {object} style Style object
   * @returns {string} Style string
   * @private
   */
  _styleToString(style) {
    return Object.entries(style)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`)
      .join('; ');
  }

  /**
   * Clear subtitles from screen
   */
  clearSubtitles() {
    if (this.subtitlesContainer) {
      this.subtitlesContainer.innerHTML = '';
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('[SubtitlesManager] Cleaning up resources');
    this.stopProcessing();
    
    if (this.subtitlesContainer) {
      this.subtitlesContainer.remove();
      this.subtitlesContainer = null;
    }

    this.currentVideoId = null;
    this.initialized = false;
    this.isShowingNativeCaptions = false;
  }

  async setEnabled(enabled) {
    console.log('[SubtitlesManager] Setting enabled state:', { 
      enabled,
      wasEnabled: this.enabled,
      initialized: this.initialized,
      hasContainer: !!this.subtitlesContainer,
      hasGenerator: !!this.subtitlesGenerator
    });
    
    this.enabled = enabled;
    SUBTITLES_CONFIG.ENABLE_LIVE_SUBTITLES = enabled;

    if (!this.subtitlesContainer && enabled) {
      this.setupSubtitlesContainer();
    }
    
    if (this.subtitlesContainer) {
      if (enabled) {
        console.log('[SubtitlesManager] Enabling live captions');
        this.subtitlesContainer.style.display = 'flex';
        
        // If we have a current video but no generator, initialize it
        if (this.initialized && !this.subtitlesGenerator && this.currentVideoId) {
          const player = document.getElementById('movie_player');
          if (player) {
            console.log('[SubtitlesManager] Reinitializing subtitle generator');
            this.subtitlesGenerator = new SubtitlesGenerator(player, this.currentVideoId);
            await this.subtitlesGenerator.initialize(this.currentVideoId);
          }
        }
        
        // Start/resume processing if initialized
        if (this.initialized) {
          await this.startProcessing();
        }
      } else {
        console.log('[SubtitlesManager] Disabling live captions');
        this.subtitlesContainer.style.display = 'none';
        this.stopProcessing();
      }
    }
  }

  async startProcessing() {
    console.log('[SubtitlesManager] Starting processing:', {
      enabled: this.enabled,
      initialized: this.initialized,
      videoId: this.currentVideoId
    });

    if (!this.enabled || !this.initialized) {
      console.log('[SubtitlesManager] Cannot start processing - disabled or not initialized');
      return;
    }

    try {
      // Initialize subtitle generator if needed
      if (!this.subtitlesGenerator) {
        const player = document.getElementById('movie_player');
        if (!player) {
          throw new Error('Player not found');
        }
        
        console.log('[SubtitlesManager] Creating new subtitles generator');
        this.subtitlesGenerator = new SubtitlesGenerator(player, this.currentVideoId);
        await this.subtitlesGenerator.initialize(this.currentVideoId);
      }

      // Start sync if not already running
      if (!this.updateInterval) {
        console.log('[SubtitlesManager] Starting subtitles sync');
        this.startSubtitlesSync();
      }

      // Process initial batches
      console.log('[SubtitlesManager] Processing initial batches');
      await Promise.all([
        this.processBatchWithLogging(0),
        this.processBatchWithLogging(1),
        this.processBatchWithLogging(2)
      ]);
    } catch (error) {
      console.error('[SubtitlesManager] Error starting processing:', error);
    }
  }

  stopProcessing() {
    console.log('[SubtitlesManager] Stopping processing:', {
      hasInterval: !!this.updateInterval,
      hasContainer: !!this.subtitlesContainer
    });

    // Clear any existing intervals or timeouts
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Clear any existing subtitles
    if (this.subtitlesContainer) {
      this.subtitlesContainer.innerHTML = '';
    }

    // Clean up subtitle generator
    if (this.subtitlesGenerator) {
      console.log('[SubtitlesManager] Cleaning up subtitle generator');
      this.subtitlesGenerator = null;
    }
  }

  /**
   * Handle language change by resetting state and re-fetching
   * @param {string} newLanguage The new target language
   */
  async handleLanguageChange(newLanguage) {
    console.log('[SubtitlesManager] Handling language change to:', newLanguage);
    
    try {
      // Get current video time before cleanup
      const player = document.getElementById('movie_player');
      const video = player?.querySelector('video');
      const currentTime = video?.currentTime || 0;

      // Stop current processing
      this.stopProcessing();

      // Clear existing subtitles
      this.clearSubtitles();

      // Reset state
      this.lastDisplayedIndex = null;
      this.lastLoggedBatch = null;
      this.lastLoggedTime = currentTime;
      
      // Re-check native captions language
      const captionsInfo = await getSubtitles(this.currentVideoId);
      this.nativeCaptionsLang = captionsInfo?.languageCode || null;
      const matches = this.nativeCaptionsLang?.toLowerCase() === newLanguage?.toLowerCase();
      console.log('[SubtitlesManager] Caption language check:', {
        nativeCaptionsLang: this.nativeCaptionsLang,
        preferredLang: newLanguage,
        matches
      });

      // Create new subtitle generator with same video ID but new language
      if (!player) {
        throw new Error('Player not found');
      }

      this.subtitlesGenerator = new SubtitlesGenerator(player, this.currentVideoId);
      await this.subtitlesGenerator.initialize(this.currentVideoId);
      this.subtitlesGenerator.setTargetLanguage(newLanguage);

      // Re-enable captions
      await Config.setLiveCaptionsEnabled(true);
      this.setEnabled(true);

      // Get batch size with fallback
      const getBatchSize = () => {
        try {
          return this.subtitlesGenerator.getBatchSize?.() || 30;
        } catch {
          return 30; // Default to 30 seconds if method not available
        }
      };

      // Calculate current batch
      const batchSize = getBatchSize();
      const currentBatch = Math.floor(currentTime / batchSize);

      // Start processing with new language
      await this.startProcessing();

      // Pre-fetch nearby batches for smooth playback
      const batchesToFetch = [currentBatch - 1, currentBatch, currentBatch + 1, currentBatch + 2]
        .filter(batch => batch >= 0 && batch < this.subtitlesGenerator.totalBatches);

      await Promise.all(
        batchesToFetch.map(batch => this.processBatchWithLogging(batch))
      );
      
      console.log('[SubtitlesManager] Language change completed successfully');
    } catch (error) {
      console.error('[SubtitlesManager] Error during language change:', error);
      // Attempt recovery by disabling captions
      this.setEnabled(false);
      await Config.setLiveCaptionsEnabled(false);
      throw error;
    }
  }

  /**
   * Enable YouTube's native captions
   * @param {string} languageCode - Language code to enable (e.g., 'zh-tw')
   */
  async enableYouTubeNativeCaptions(languageCode) {
    try {
      console.log(`[SubtitlesManager] Attempting to enable YouTube native captions for language: ${languageCode}`);
      
      // Wait for player to be ready
      const player = await this._waitForPlayerReady();
      if (!player) {
        console.error('[SubtitlesManager] Could not find YouTube player element after waiting');
        return;
      }
      
      // First, try to use YouTube's API to enable captions
      if (typeof player.toggleSubtitles === 'function') {
        // Check if captions are already on
        const areCaptionsOn = player.getOption('captions', 'track') && 
                             player.getOption('captions', 'track').languageCode !== '';
        
        console.log('[SubtitlesManager] Current captions state:', { areCaptionsOn });
        
        // If captions are off, turn them on
        if (!areCaptionsOn) {
          console.log('[SubtitlesManager] Enabling captions via player API');
          player.toggleSubtitles();
        }
        
        // Set the language if possible
        if (typeof player.setOption === 'function') {
          console.log(`[SubtitlesManager] Setting caption language to: ${languageCode}`);
          player.setOption('captions', 'track', { languageCode });
        }
        
        return;
      }
      
      // Fallback: Try to find and click the captions button
      console.log('[SubtitlesManager] Trying fallback method to enable captions');
      
      // Find the captions button in the player controls
      const captionsButton = player.querySelector('.ytp-subtitles-button');
      if (!captionsButton) {
        console.error('[SubtitlesManager] Could not find captions button');
        return;
      }
      
      // Check if captions are already enabled (button is toggled)
      const isCaptionsEnabled = captionsButton.getAttribute('aria-pressed') === 'true';
      console.log('[SubtitlesManager] Captions button state:', { isCaptionsEnabled });
      
      // If captions are not enabled, click the button to enable them
      if (!isCaptionsEnabled) {
        console.log('[SubtitlesManager] Clicking captions button to enable captions');
        captionsButton.click();
      }
      
      // Now try to set the language by finding and clicking the settings button,
      // but this is more complex and might not always work reliably
      console.log('[SubtitlesManager] Successfully enabled YouTube native captions');
    } catch (error) {
      console.error('[SubtitlesManager] Error enabling YouTube native captions:', error);
    }
  }

  /**
   * Disable YouTube's native captions
   */
  async disableYouTubeNativeCaptions() {
    try {
      console.log('[SubtitlesManager] Attempting to disable YouTube native captions');
      
      // Wait for player to be ready
      const player = await this._waitForPlayerReady();
      if (!player) {
        console.error('[SubtitlesManager] Could not find YouTube player element after waiting');
        return;
      }
      
      // First, try to use YouTube's API to disable captions
      if (typeof player.toggleSubtitles === 'function') {
        // Check if captions are already on
        const areCaptionsOn = player.getOption('captions', 'track') && 
                             player.getOption('captions', 'track').languageCode !== '';
        
        console.log('[SubtitlesManager] Current captions state:', { areCaptionsOn });
        
        // If captions are on, turn them off
        if (areCaptionsOn) {
          console.log('[SubtitlesManager] Disabling captions via player API');
          player.toggleSubtitles();
        }
        
        return;
      }
      
      // Fallback: Try to find and click the captions button
      console.log('[SubtitlesManager] Trying fallback method to disable captions');
      
      // Find the captions button in the player controls
      const captionsButton = player.querySelector('.ytp-subtitles-button');
      if (!captionsButton) {
        console.error('[SubtitlesManager] Could not find captions button');
        return;
      }
      
      // Check if captions are already enabled (button is toggled)
      const isCaptionsEnabled = captionsButton.getAttribute('aria-pressed') === 'true';
      console.log('[SubtitlesManager] Captions button state:', { isCaptionsEnabled });
      
      // If captions are enabled, click the button to disable them
      if (isCaptionsEnabled) {
        console.log('[SubtitlesManager] Clicking captions button to disable captions');
        captionsButton.click();
      }
      
      console.log('[SubtitlesManager] Successfully disabled YouTube native captions');
    } catch (error) {
      console.error('[SubtitlesManager] Error disabling YouTube native captions:', error);
    }
  }

  /**
   * Wait for YouTube player to be ready
   * @returns {Promise<HTMLElement|null>} The player element when ready, or null if timeout
   * @private
   */
  _waitForPlayerReady() {
    return new Promise((resolve) => {
      const maxAttempts = 50; // Maximum number of attempts (5 seconds total with 100ms intervals)
      let attempts = 0;
      
      const checkPlayer = () => {
        attempts++;
        const player = document.getElementById('movie_player');
        
        // If player exists and has necessary functions, resolve with player
        if (player && 
            (typeof player.toggleSubtitles === 'function' || 
             player.querySelector('.ytp-subtitles-button'))) {
          console.log('[SubtitlesManager] Player ready after', attempts, 'attempts');
          resolve(player);
          return;
        }
        
        // If we've exceeded max attempts, resolve with null
        if (attempts >= maxAttempts) {
          console.error('[SubtitlesManager] Timed out waiting for player to be ready');
          resolve(null);
          return;
        }
        
        // Otherwise, try again after a short delay
        setTimeout(checkPlayer, 100);
      };
      
      checkPlayer();
    });
  }
}
