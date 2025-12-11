
export enum LyricsFormat {
  PLAIN = 'PLAIN',
  LRC = 'LRC',
  ELRC = 'ELRC', // Extended LRC (Word/Syllable level)
  TTML = 'TTML', // Timed Text Markup Language
}

export interface TimedWord {
  id: string;
  text: string;
  startTime: number; // Seconds
  endTime?: number; // Seconds
  isBackground?: boolean;
}

export interface TimedLine {
  id: string;
  startTime: number; // Seconds
  endTime?: number; // Seconds
  words: TimedWord[];
  rawText: string; // Convenience text representation
  voice?: string; // Optional speaker identifier
  isBackground?: boolean; // For x-bg or parenthesis backing vocals
  attributes?: Record<string, string>; // Parsing attributes like itunes:key
}

export interface LyricsDocument {
  format: LyricsFormat;
  lines: TimedLine[];
  metadata: {
    title?: string;
    artist?: string;
    album?: string;
    songwriters?: string[];
    offset?: number; // Global offset in ms
    hasBackgroundVocals?: boolean;
    language?: string;
    [key: string]: any;
  };
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // Seconds
  duration: number; // Seconds
}

export interface Project {
  id: string;
  name: string;
  updatedAt: number;
  lyrics: LyricsDocument;
  audioSrc?: string | null; 
  audioBlob?: Blob; // Store actual binary for offline access
}
