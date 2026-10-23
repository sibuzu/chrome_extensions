import { Store } from 'webext-redux';
import { handleError } from '../ui/alerts.js';
import { Config } from '../config.js';
import { updateTranscriptDisplay } from './transcriptService.js';
import TranscriptFetcher from '../index.js';

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
export function getStore() {
  return state.store;
}

// Update basic info
export async function updateBasicInfo(elements, storeState) {
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
export async function initStoreSubscription(elements) {
  try {
    // Create store connection
    state.store = new Store({
      portName: 'YOUTUBE_SUBTITLES_STORE',
      reconnectOnDocumentReady: true,
    });

    // Wait for store to be ready
    await state.store.ready();
    console.log('[Sidebar] Store connected successfully', {
      timestamp: new Date().toISOString(),
      readyState: state.store.ready ? 'ready' : 'not ready',
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
            hasProxyData: !!(currentState.playerData?.isProxySource) || !!currentState.isProxySource
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
            const fetcher = new TranscriptFetcher(
              currentState.playerData,
              currentState.videoId,
              { 
                pageHtml: currentState.pageHtml,
                language: currentState.preferredLanguage 
              }
            );
            state.transcriptFetcher = fetcher;
            window.state.transcriptFetcher = fetcher;
            state.lastVideoId = currentState.videoId;
          }

          // Get saved language preference from global state or Config
          const preferredLang = window.state?.preferredLanguage || await Config.getPreferredLanguage();
          console.log('[Sidebar] Using language for update:', preferredLang);
          
          // Update both states with language preference
          currentState.preferredLanguage = preferredLang;
          if (window.state) {
            window.state.preferredLanguage = preferredLang;
          }
          
          await updateTranscriptDisplay(elements, currentState, state.transcriptFetcher);
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
          const fetcher = new TranscriptFetcher(
            initialState.playerData,
            initialState.videoId,
            { 
              pageHtml: initialState.pageHtml,
              language: initialState.preferredLanguage 
            }
          );
          state.transcriptFetcher = fetcher;
          window.state.transcriptFetcher = fetcher;
          state.lastVideoId = initialState.videoId;
        }

        // Get saved language preference
        const preferredLang = window.state?.preferredLanguage || await Config.getPreferredLanguage();
        console.log('[Sidebar] Using language for initial state:', preferredLang);
        
        // Update both states with language preference
        initialState.preferredLanguage = preferredLang;
        if (window.state) {
          window.state.preferredLanguage = preferredLang;
        }
        
        await updateTranscriptDisplay(elements, initialState, state.transcriptFetcher);
      } catch (error) {
        console.error('[Sidebar] Error processing initial state:', error);
        handleError(error);
      }
    }

    return state.store;
  } catch (error) {
    console.error('[Sidebar] Error initializing store subscription:', error);
    handleError(error);
    throw error;
  }
}

// Clean up store subscription
export function cleanupStore() {
  if (state.store) {
    state.store = null;
  }
}

// Get current store state
export function getStoreState() {
  return state.store ? state.store.getState() : null;
}
