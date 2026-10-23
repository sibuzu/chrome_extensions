/**
 * Subtitles system for handling bilingual subtitles generation and synchronization
 */

import TranscriptFetcher from './index.js';
import { API_CONFIG, SUBTITLES_CONFIG } from './config.js';

const { BATCH_SIZE, MAX_CONCURRENT_BATCHES } = SUBTITLES_CONFIG;

class SubtitlesGenerator {
  constructor(playerData, videoId) {
    this.currentBatch = 0;
    this.totalBatches = 0;
    this.blocks = [];
    this.pendingBatches = new Set();
    // Get user's preferred language from localStorage
    this.targetLanguage = localStorage.getItem('uiLang') || 'en';
    // Pass the user's preferred language to TranscriptFetcher
    this.transcriptFetcher = new TranscriptFetcher(playerData, videoId, { language: this.targetLanguage });
    this.lastBatchCheck = 0; // For debouncing
    this.targetLanguage = localStorage.getItem('uiLang') || 'en';
  }

  /**
   * Initialize the generator with video data
   * @param {string} videoId Video ID to process
   */
  async initialize(videoId) {
    console.log('[SubtitlesGenerator] 🚀 Initializing with video:', videoId);
    const transcript = await this.transcriptFetcher.fetchTranscript(videoId);
    console.log('[SubtitlesGenerator] 📝 Received transcript:', {
      length: transcript.length,
      sample: transcript.slice(0, 3)
    });
    
    this.blocks = this.formatTranscriptToBlocks(transcript);
    console.log('[SubtitlesGenerator] 📦 Formatted blocks:', {
      total: this.blocks.length,
      sample: this.blocks.slice(0, 3).map(b => ({
        index: b.index,
        timestamp: b.timestamp,
        hasOriginal: !!b.content.Original
      }))
    });
    
    this.totalBatches = Math.ceil(this.blocks.length / BATCH_SIZE);
    console.log('[SubtitlesGenerator] ℹ️ Initialization complete:', {
      totalBlocks: this.blocks.length,
      totalBatches: this.totalBatches,
      batchSize: BATCH_SIZE
    });
  }

  /**
   * Set target language for translations
   * @param {string} lang - Target language code
   */
  setTargetLanguage(lang) {
    console.log('[SubtitlesGenerator] Setting target language:', lang);
    this.targetLanguage = lang;
    localStorage.setItem('uiLang', lang);
    // Clear any cached translations since we're changing languages
    this.clearCache();
  }

  /**
   * Clear cached translations
   */
  clearCache() {
    console.log('[SubtitlesGenerator] Clearing translation cache');
    this.blocks = this.blocks.map(block => ({
      ...block,
      content: {
        Original: block.content.Original,
        Translated: '' // Use generic key for translated content
      }
    }));
  }

  /**
   * Format transcript segments into SRT blocks
   * @param {Array} transcript Array of transcript segments
   * @returns {Array} Formatted SRT blocks
   */
  formatTranscriptToBlocks(transcript) {
    console.log('[SubtitlesGenerator] Formatting transcript segments:', transcript.length);
    
    const blocks = transcript.map((segment, index) => {
      const formattedStart = TranscriptFetcher._formatTimestamp(segment.start);
      const formattedEnd = TranscriptFetcher._formatTimestamp(segment.start + segment.duration);
      const timestamp = `${formattedStart} --> ${formattedEnd}`;
      
      return {
        index: index + 1,
        timestamp,
        content: {
          Translated: '', // Use generic key for translated content
          Original: segment.text
        }
      };
    });
    
    console.log('[SubtitlesGenerator] Blocks formatted:', blocks.length);
    return blocks;
  }

  /**
   * Get current batch based on video timestamp with debouncing
   * @param {number} currentTime Video current time in seconds
   * @returns {number|null} Batch number or null if debounced
   */
  getCurrentBatch(currentTime) {
    // Special handling for start of video - bypass debounce
    if (currentTime === 0) {
      this.lastBatchCheck = Date.now();
      return 0; // Always return first batch when starting from beginning
    }

    // Debounce batch checks (300ms) for subsequent updates
    const now = Date.now();
    if (now - this.lastBatchCheck < 300) {
      return null;
    }
    this.lastBatchCheck = now;

    // Find the block that contains the current time
    const block = this.blocks.find(block => {
      const [start, end] = this.parseTimestamp(block.timestamp);
      return currentTime >= start && currentTime < end;
    });

    if (!block) {
      // If no block found, find the next closest block
      const nextBlock = this.blocks.find(block => {
        const [start] = this.parseTimestamp(block.timestamp);
        return start > currentTime;
      });
      
      if (!nextBlock) {
        return this.totalBatches - 1; // Return last batch if no next block
      }
      
      return Math.floor((nextBlock.index - 1) / BATCH_SIZE);
    }
    
    // Calculate batch number from block index
    const batchNumber = Math.floor((block.index - 1) / BATCH_SIZE);
    return batchNumber;
  }

  /**
   * Parse SRT timestamp into seconds
   * @param {string} timestamp SRT format timestamp (HH:MM:SS,mmm --> HH:MM:SS,mmm)
   * @returns {Array} Array of [start, end] times in seconds
   */
  parseTimestamp(timestamp) {
    const [start, end] = timestamp.split(' --> ');
    
    const parseTime = (timeStr) => {
      const [time, ms] = timeStr.split(',');
      const [hours, minutes, seconds] = time.split(':').map(Number);
      return (hours * 3600) + (minutes * 60) + seconds + (Number(ms) / 1000);
    };

    return [parseTime(start), parseTime(end)];
  }

  /**
   * Get current target language from localStorage
   * @returns {string} Current target language
   */
  getCurrentLanguage() {
    return localStorage.getItem('uiLang') || 'en';
  }

  /**
   * Process a single batch of subtitles with retry logic
   * @param {number} batchNumber Batch number to process
   * @param {number} retryCount Number of retries attempted (default: 0)
   * @returns {Promise<Array>} Processed subtitle blocks
   */
  async processBatch(batchNumber, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second delay between retries
    const nlp = require('compromise');

    // Always get the latest language preference
    this.targetLanguage = this.getCurrentLanguage();

    // Prevent duplicate processing
    if (this.pendingBatches.has(batchNumber)) {
      console.log(`[SubtitlesGenerator] Batch ${batchNumber} already being processed, skipping`);
      return;
    }

    // Get original blocks for this batch
    const batchStart = batchNumber * BATCH_SIZE;
    const batchEnd = batchStart + BATCH_SIZE;
    const originalBlocks = this.blocks.slice(batchStart, batchEnd);
    
    // Process text with NLP for natural phrasing
    const processedText = originalBlocks.map(block => {
      const doc = nlp(block.content.Original);
      // Split into natural phrases
      const phrases = doc.sentences().json()
        .map(s => s.text)
        .join('\n');
      return {
        index: block.index,
        text: phrases
      };
    });

    const _start = batchNumber * BATCH_SIZE;
    this.pendingBatches.add(batchNumber);

    try {
      // Get the transcript arg from TranscriptFetcher
      const transcriptArg = this.transcriptFetcher.getTranscriptArg();

      // Add error handling for missing transcriptArg
      if (!transcriptArg) {
        throw new Error('Missing transcript arg');
      }

      console.log(`[SubtitlesGenerator] Sending batch ${batchNumber} for translation to ${this.targetLanguage}`);

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TRANSCRIBE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          arg: transcriptArg,
          batchNumber: batchNumber + 1, // API expects 1-based batch numbers
          processedText, // Send the NLP-processed text
          lang: this.targetLanguage // Include target language
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error from transcribe API');
      }

      console.log(`[SubtitlesGenerator] Got translation response for batch ${batchNumber}:`, {
        success: result.success,
        blockRange: result.blockRange,
        translationLength: result.translation.length
      });

      // Parse translated content - simpler version that assumes we have the original timestamps
      const lines = result.translation.split('\n');
      const blocks = [];
      let currentBlock = null;
      let originalBlock = null;
      let state = 'TEXT';

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine === '') continue;

        if (/^\d+$/.test(trimmedLine)) {
          // New block starting
          if (currentBlock) {
            this.finalizeBlock(currentBlock, blocks);
          }
          
          // Get the original block to preserve its timestamp
          originalBlock = this.blocks[parseInt(trimmedLine, 10) - 1];
          if (!originalBlock) {
            console.warn(`[SubtitlesGenerator] Could not find original block for index ${trimmedLine}`);
            continue;
          }

          currentBlock = {
            index: parseInt(trimmedLine, 10),
            timestamp: originalBlock.timestamp,
            content: {
              Translated: '',
              Original: originalBlock.content.Original // Preserve original text
            }
          };
          state = 'TIMESTAMP'; // Next line should be timestamp
          continue;
        }

        if (state === 'TIMESTAMP') {
          // Skip timestamp line
          state = 'TEXT';
          continue;
        }

        if (state === 'TEXT') {
          if (!originalBlock) {
            console.warn('[SubtitlesGenerator] Missing original block reference');
            continue;
          }
          
          // Use Translated as the key for translated content
          if (state === 'TEXT') {
            currentBlock.content.Translated = trimmedLine;
          }
        }
      }

      // Finalize last block if exists
      if (currentBlock) {
        this.finalizeBlock(currentBlock, blocks);
      }

      const translatedBlocks = blocks.filter(block => {
        const originalBlock = this.blocks[block.index - 1];
        if (!originalBlock) {
          console.warn(`[SubtitlesGenerator] Could not find original block for index ${block.index}`);
          return false;
        }
        return true;
      });

      // Break up the long line with sample content into multiple lines
      console.log(`[SubtitlesGenerator] Parsed blocks for batch ${batchNumber}:`, {
        count: translatedBlocks.length,
        sample: translatedBlocks[0] ? {
          index: translatedBlocks[0].index,
          translated: translatedBlocks[0].content.Translated?.substring(0, 30),
          original: translatedBlocks[0].content.Original?.substring(0, 30)
        } : null
      });

      this.updateBlocks(batchNumber, translatedBlocks);
      return translatedBlocks;
    } catch (error) {
      console.error(`Failed to process batch ${batchNumber}:`, error);
      
      // Implement retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`[SubtitlesGenerator] Retrying batch ${batchNumber} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        this.pendingBatches.delete(batchNumber); // Remove from pending before retry
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        
        // Retry with incremented count
        return this.processBatch(batchNumber, retryCount + 1);
      }
      
      throw error;
    } finally {
      // Only remove from pending if we're not going to retry
      if (retryCount >= MAX_RETRIES) {
        this.pendingBatches.delete(batchNumber);
      }
    }
  }

  /**
   * Finalize a block by adding it to the blocks array
   * @param {Object} block The block to finalize
   * @param {Array} blocks Array to add the block to
   */
  finalizeBlock(block, blocks) {
    if (!block || !block.index || !block.timestamp) {
      console.warn('[SubtitlesGenerator] Invalid block format:', block);
      return;
    }

    // Find the original block to preserve text
    const originalBlock = this.blocks[block.index - 1];
    if (!originalBlock) {
      console.warn(`[SubtitlesGenerator] Could not find original block for index ${block.index}`);
      return;
    }

    // Preserve original text if missing
    if (!block.content.Original && originalBlock.content.Original) {
      block.content.Original = originalBlock.content.Original;
    }

    // Log parsed block for debugging
    const translatedContent = block.content.Translated;
    const originalContent = block.content.Original;
    
    console.debug('[SubtitlesGenerator] Parsed block:', {
      index: block.index,
      timestamp: block.timestamp,
      content: {
        Translated: translatedContent?.substring(0, 50) + (translatedContent?.length > 50 ? '...' : ''),
        Original: originalContent?.substring(0, 50) + (originalContent?.length > 50 ? '...' : '')
      }
    });

    blocks.push(block);
  }

  /**
   * Update blocks with processed subtitles
   * @param {number} batchNumber Batch number
   * @param {Array} processedBlocks Processed subtitle blocks
   */
  updateBlocks(batchNumber, processedBlocks) {
    console.log(`[SubtitlesGenerator] Updating batch ${batchNumber} (${processedBlocks.length} blocks)`);
    
    processedBlocks.forEach((block, index) => {
      const blockIndex = batchNumber * BATCH_SIZE + index;
      if (this.blocks[blockIndex]) {
        this.blocks[blockIndex] = block;
      }
    });

    // Emit update event for UI
    if (typeof this.onBlocksUpdated === 'function') {
      this.onBlocksUpdated({
        batchNumber,
        blocks: processedBlocks,
        isFirstBatch: batchNumber === 0
      });
    }
  }

  /**
   * Process all batches concurrently
   * @returns {Promise<Array>} All processed subtitle blocks
   */
  async processAllBatches() {
    const batchPromises = [];
    
    // Always process first batch synchronously
    if (this.totalBatches > 0) {
      await this.processBatch(0);
    }
    
    // Process remaining batches concurrently
    for (let i = 1; i < this.totalBatches; i += MAX_CONCURRENT_BATCHES) {
      const currentBatchPromises = [];
      for (let j = 0; j < MAX_CONCURRENT_BATCHES && (i + j) < this.totalBatches; j++) {
        currentBatchPromises.push(this.processBatch(i + j));
      }
      const results = await Promise.all(currentBatchPromises);
      batchPromises.push(...results);
    }

    return batchPromises.flat();
  }

  /**
   * Get subtitle block for current video time
   * @param {number} currentTime Current video time in seconds
   * @returns {Object|null} Subtitle block or null if none found
   */
  getCurrentSubtitle(currentTime) {
    if (!this.blocks || !this.blocks.length) {
      return null;
    }

    // Find the latest block whose start time is less than or equal to current time
    let currentBlock = null;
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      const [start] = this.parseTimestamp(block.timestamp);
      
      // If this block starts after current time, stop looking
      if (start > currentTime) {
        break;
      }
      
      // Update current block if this one starts before or at current time
      currentBlock = block;
    }

    return currentBlock;
  }

  async getOriginalBatch(batchNumber) {
    const batchStart = batchNumber * BATCH_SIZE;
    const batchEnd = batchStart + BATCH_SIZE;
    return this.blocks.slice(batchStart, batchEnd);
  }
}

// Utility functions
function normalizeText(text) {
  return text
    .replace(/\r?\n|\r/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ')      // Collapse multiple spaces
    .trim();                   // Trim leading/trailing spaces
}

function extractZhTW(input) {
  // Handle both string and array inputs
  const lines = typeof input === 'string' ? input.split('\n') : input;
  
  // Skip index and timestamp lines (first 2 lines)
  const textLines = lines.slice(2);
  
  // Join all text lines until next index number or end of input
  let zhTW = [];
  for (const line of textLines) {
    // Stop if we hit the next index number
    if (/^\d+$/.test(line.trim())) {
      break;
    }
    // Skip empty lines but continue collecting
    if (line.trim() !== '') {
      zhTW.push(line.trim());
    }
  }
  
  return zhTW.join(' ');
}

async function getSubtitles(videoId) {
  try {
    const userPreferredLanguage = localStorage.getItem('uiLang') || 'en';
    console.log(`[VideoDataFetcher] User preferred language - ${userPreferredLanguage}`);
    
    const response = await fetch('https://www.youtube.com/watch?v=' + videoId);
    const html = await response.text();
    
    // Use the robust extraction method from TranscriptFetcher
    const extractCaptionsJson = (html) => {
      try {
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (!playerResponseMatch) {
          console.log('[VideoDataFetcher] No ytInitialPlayerResponse found');
          return null;
        }

        const playerResponse = JSON.parse(playerResponseMatch[1]);
        const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer;
        if (!captions) {
          console.log('[VideoDataFetcher] No captions found in player response');
          return null;
        }

        return captions;
      } catch (e) {
        console.error('[VideoDataFetcher] Failed to parse captions JSON:', e);
        return null;
      }
    };

    const captionsData = extractCaptionsJson(html);
    if (!captionsData?.captionTracks?.length) {
      console.log('[VideoDataFetcher] No caption tracks found');
      return null;
    }

    // Find preferred language track or auto-generated track
    const normalizedWanted = userPreferredLanguage.toLowerCase();
    let track = captionsData.captionTracks.find(t => 
      t.languageCode.toLowerCase() === normalizedWanted
    );

    // If preferred language not found, try auto-generated or fall back to first track
    if (!track) {
      const autoTrack = captionsData.captionTracks.find(t => t.kind === 'asr');
      track = autoTrack || captionsData.captionTracks[0];
    }

    if (!track?.baseUrl) {
      console.log('[VideoDataFetcher] No suitable track found');
      return null;
    }

    const languageCode = track.languageCode;
    console.log(`[VideoDataFetcher] Language code of subtitles - ${languageCode}`);

    const response2 = await fetch(track.baseUrl);
    if (!response2.ok) {
      throw new Error(`Failed to fetch subtitle track: ${response2.status}`);
    }
    const subtitle = await response2.text();

    return {
      text: subtitle,
      languageCode: languageCode
    };
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    return null;
  }
}

export { 
  TranscriptFetcher, 
  SubtitlesGenerator,
  normalizeText,
  extractZhTW,
  getSubtitles
};
