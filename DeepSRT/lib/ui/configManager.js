/**
 * Configuration UI manager for the extension
 * @module configManager
 */

import { Config } from '../config.js';

/**
 * Initialize the configuration UI
 * @param {Object} elements - DOM elements
 */
export async function initializeConfigUI(elements) {
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
export function toggleConfigMenu(elements, show) {
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
  
  if (configMenu && !configMenu.contains(event.target) && 
      configButton && !configButton.contains(event.target)) {
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
    return new Promise((resolve) => {
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
export async function saveSrtProvider(url) {
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
    await Config.setSrtProvider(validUrl);
    
    // Verify the save was successful by reading it back
    const verifiedUrl = await Config.getSrtProvider();
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
export async function getSrtProvider() {
  try {
    // Use the Config class method to get the SRT provider
    const provider = await Config.getSrtProvider();
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
