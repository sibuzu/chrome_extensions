/**
 * Custom error for YouTube transcript issues
 */
export class YouTubeTranscriptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'YouTubeTranscriptError';
  }
}

export default YouTubeTranscriptError;
