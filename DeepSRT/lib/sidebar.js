// Add language change handler
elements.uiLang?.addEventListener('change', async () => {
  const newLang = elements.uiLang.value;
  const oldLang = localStorage.getItem('uiLang') || 'en';
  
  console.log('[Sidebar] UI Language changed:', {
    from: oldLang,
    to: newLang,
    timestamp: new Date().toISOString()
  });

  localStorage.setItem('uiLang', newLang);
  
  // Log Config update
  const config = await Config.get();
  console.log('[Sidebar] Current Config before update:', {
    preferredCaptionLanguage: config.preferredCaptionLanguage,
    newLang
  });

  config.preferredCaptionLanguage = newLang;
  await Config.save(config);
  
  console.log('[Sidebar] Config updated with new language:', {
    preferredCaptionLanguage: config.preferredCaptionLanguage,
    localStorage: localStorage.getItem('uiLang')
  });

  // Disable live captions if English is selected
  if (newLang === 'en') {
    console.log('[Sidebar] English selected - disabling live captions');
    const ccBtn = document.getElementById('ccBtn');
    if (ccBtn) {
      ccBtn.classList.remove('active');
      ccBtn.classList.add('inactive');
    }
    // Force disable live captions
    forceLiveCaptionsDisabled();
    // Dispatch event to disable live captions
    window.dispatchEvent(new CustomEvent('liveCaptionsToggled', {
      detail: { enabled: false }
    }));
    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        console.log('[Sidebar] Sending language update to content script:', {
          language: newLang,
          disableLiveCaptions: true
        });
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_CAPTIONS_LANGUAGE',
          language: newLang,
          disableLiveCaptions: true,
          forceDisable: true
        });
      }
    });
  } else {
    // Re-summarize with new language if we have content
    const currentState = state.store.getState();
    if (currentState?.playerData && state.transcriptFetcher) {
      try {
        console.log('[Sidebar] Non-English language selected - updating translation:', {
          newLang,
          hasTranscriptFetcher: !!state.transcriptFetcher,
          hasPlayerData: !!currentState.playerData
        });

        // Get the transcript URL and arg if not already available
        if (!currentState.transcriptArg) {
          await state.transcriptFetcher.fetchTranscript(currentState.videoId);
          currentState.transcriptArg = state.transcriptFetcher.getTranscriptArg();
        }

        // Send message to content script to update language
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            console.log('[Sidebar] Sending language update to content script:', {
              language: newLang,
              disableLiveCaptions: false
            });
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'UPDATE_CAPTIONS_LANGUAGE',
              language: newLang,
              disableLiveCaptions: false
            });
          }
        });

        await autoSummarize({
          videoId: currentState.videoId,
          title: currentState.title,
          transcriptArg: currentState.transcriptArg,
        }, elements.transcript?.textContent, newLang);
      } catch (error) {
        console.error('[Sidebar] Error updating language:', error);
        handleError(error);
      }
    }
  }
}); 