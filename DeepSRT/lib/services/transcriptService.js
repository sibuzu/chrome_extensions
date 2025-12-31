import { API_CONFIG } from '../config.js';
import { mockFetch } from './mockService.js';
import { Config } from '../config.js';

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
export async function autoSummarize(appState, existingTranscript, targetLang = 'en') {
  // Validate required parameters
  if (!existingTranscript || !appState.title || (!appState.transcriptArg && !appState.isProxySource)) {
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
    const isBulletMode = await Config.getBulletListEnabled();
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

  const endpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TRANSCRIPT}`;
  const normalizedLang = normalizeLanguageCode(targetLang);

  try {
    console.log('[Sidebar] Fetching summary and title in language:', normalizedLang);

    // Log API request details
    console.log('[Sidebar] Making API2 requests with:', {
      endpoint: endpoint,
      mode2: mode,
      lang: normalizedLang,
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
    const [summaryResponse, titleResponse] = await Promise.all([
      mockFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isProxyRequest && proxyUrl 
            ? {
              proxy: proxyUrl,
              action: 'summarize',
              lang: normalizedLang,
              mode: mode
            }
            : {
              arg: appState.transcriptArg,
              action: 'summarize',
              lang: normalizedLang,
              mode: mode
            }
        ),
      }),
      mockFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isProxyRequest && proxyUrl 
            ? {
              proxy: proxyUrl,
              txt: appState.title,
              action: 'translate',
              lang: normalizedLang,
              mode: mode
            }
            : {
              arg: appState.transcriptArg,
              txt: appState.title,
              action: 'translate',
              lang: normalizedLang,
              mode: mode
            }
        ),
      }),
    ]);

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

    const [summaryData, titleData] = await Promise.all([
      summaryResponse.json(),
      titleResponse.json(),
    ]);

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
export async function updateTranscriptDisplay(elements, storeState, transcriptFetcher, options = {}) {
  // Default options
  const { skipSummaryGeneration = false } = options;
  
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
      hasProxyData: !!storeState.transcript || !!(storeState.playerData?.transcript)
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
        const response = await mockFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TRANSCRIPT}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            arg: transcriptArg,
            format,
            lang, // Include language in request
          }),
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
              preferredLanguage: targetLang, // Add language to appState
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
        hasPlayerDataTranscript: !!(storeState.playerData?.transcript)
      });
      
      // Use transcript data from root level or from playerData
      const proxyData = storeState.transcript || storeState.playerData?.transcript;
      
      // Ensure we have the proxyUrl set
      if (!storeState.proxyUrl && storeState.playerData?.proxyUrl) {
        storeState.proxyUrl = storeState.playerData.proxyUrl;
      }
      
      try {
        // Dynamically import the proxy transcript fetcher for parsing
        const { parseSRTContent } = await import('../proxyTranscriptFetcher.js');
        
        // Parse and display the content
        if (proxyData && elements.transcript) {
          const parsedContent = parseSRTContent(proxyData, format);
          if (elements.transcript) {
            elements.transcript.innerHTML = 
              format === 'text' 
                ? `<div class="transcript-text-content">${parsedContent.trim()}</div>` 
                : parsedContent;
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
        const { fetchProxySRT, parseSRTContent } = await import('../proxyTranscriptFetcher.js');
        
        try {
          // Fetch the proxy SRT content
          const proxyData = await fetchProxySRT(videoId, lang);
          console.log('[Sidebar] Proxy fetch completed successfully');
          
          // If we got here, we successfully fetched the proxy data
          // Process it and display it
          if (proxyData && elements.transcript) {
            const parsedContent = parseSRTContent(proxyData, format);
            if (elements.transcript) {
              elements.transcript.innerHTML = 
                format === 'text' 
                  ? `<div class="transcript-text-content">${parsedContent.trim()}</div>` 
                  : parsedContent;
            }
            
            // Mark this as a proxy source for the summary generation
            // Note: This only updates the local storeState object for this function
            // It does not update the Redux store
            storeState.isProxySource = true;
            
            // Get the SRT provider URL and construct the full proxy URL
            const getSrtProviderUrl = async () => {
              const srtProvider = await Config.getSrtProvider();
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
          const srtProvider = await Config.getSrtProvider();
          
          // Check if we have permission for the SRT provider
          const hasPermission = await new Promise(resolve => {
            chrome.permissions.contains({ origins: [`${srtProvider}/*`] }, resolve);
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

    const endpoint = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TRANSCRIPT}`;
    
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
      const response = await mockFetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          arg: transcriptArg,
          format,
          lang, // Include language in request
        }),
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
            preferredLanguage: targetLang, // Add language to appState
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
          Config.getSrtProvider().then(srtProvider => {
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
        Config.getSrtProvider().then(srtProvider => {
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
