/**
 * Utility class for formatting text and timestamps
 */
export default class Formatter {
  /**
   * Format text for digest display
   * @param {string} text - Text to format
   * @returns {string} Formatted text
   */
  static formatDigest(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Format timestamp for display
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted timestamp (HH:MM:SS)
   */
  static formatTimestamp(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return [hours, minutes, secs]
      .map((n) => n.toString().padStart(2, '0'))
      .join(':');
  }
}
