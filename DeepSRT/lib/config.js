/**
 * Configuration for the Chrome extension
 */

const isDev = chrome.runtime.getManifest().version.includes('-dev') 
  || location.hostname === 'localhost'
  || chrome.runtime.id === 'efmnkbmjoghelgmbhigioddcidenphle';

if (isDev) { console.log('[Config] isDev:', isDev); }

// Constants for configuration
export const CURRENT_CONFIG_VERSION = '1.0';
export const SUPPORTED_LANGUAGES = ['en', 'zh-cn', 'zh-tw', 'zh-hk', 'ko', 'ja', 'fr', 'es', 'th'];
export const FONT_SIZES = [12, 14, 16, 18, 20];
export const DEFAULT_FONT_SIZE = 14;
export const DEFAULT_SRT_PROVIDER = undefined;

// API configuration
export const API_CONFIG = {
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
export const SUBTITLES_CONFIG = {
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
export async function toggleLiveCaptions() {
  const currentState = await Config.getLiveCaptionsEnabled();
  const newState = !currentState;
  
  console.log('[Config] Toggling live captions from:', currentState, 'to:', newState);
  
  SUBTITLES_CONFIG.ENABLE_LIVE_SUBTITLES = newState;
  await Config.setLiveCaptionsEnabled(newState);
  
  // Notify content script
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'TOGGLE_CAPTIONS',
        enabled: newState
      });
    }
  });
  
  return newState;
}

export function forceLiveCaptionsDisabled() {
  Config.setLiveCaptionsEnabled(false);
  return false;
}

export class Config {
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
      const { config } = await chrome.storage.local.get('config');
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
      await chrome.storage.local.set({ config });
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
    const { config } = await chrome.storage.local.get('config');
    
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
