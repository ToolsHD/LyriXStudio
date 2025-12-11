# LyriXStudio - Agents Documentation

This document serves as a complete technical reference for the **LyriXStudio** application. It details the architecture, file structure, state management, and design system to assist developers and AI agents in understanding and modifying the codebase.

## 1. Project Overview

**LyriXStudio** is a professional-grade, client-side Single Page Application (SPA) for creating, editing, and previewing synchronized lyrics. It acts as a bridge between raw text/audio and standardized lyric formats used by major streaming platforms (Apple Music, Spotify, etc.).

### Key Capabilities
*   **Formats**: 
    *   **LRC**: Standard line-level synchronization.
    *   **ELRC**: Enhanced word-level synchronization.
    *   **TTML**: Advanced XML based format (Apple Music spec) supporting roles, background vocals, and extensive metadata.
*   **Visualizer**: High-fidelity, Apple Music-style preview with motion blur, scaling, and dynamic coloring.
*   **Editor**: Granular control over lines, words, voices, and background vocal flags.
*   **Offline Persistence**: Full project state saving (including audio files) using IndexedDB.

## 2. Technology Stack

*   **Runtime**: Browser-native (ES Modules via Import Maps). No build step required (using `React` via CDN).
*   **Framework**: React 18+.
*   **Styling**: Tailwind CSS (Runtime configuration in `index.html`).
*   **Animation**: Framer Motion (Complex UI transitions), CSS Transitions (Performance-critical scrolling).
*   **Icons**: Lucide React.
*   **Utilities**: 
    *   `localforage`: Async IndexedDB wrapper for project storage.
    *   `diff`: Text differencing for version comparison.
    *   `iso-639-1`: Standardized language codes.

## 3. File Structure & Responsibilities

### Entry Points & Config
*   **`index.html`**: The application shell.
    *   **Import Maps**: Defines dependencies (React, Framer Motion, etc.).
    *   **Tailwind Config**: Defines the custom "Dark Navy" color palette (`background`, `surface`, `card`, `accent`).
    *   **Global CSS**: Scrollbar styling and font imports (Inter, JetBrains Mono).
*   **`index.tsx`**: React DOM root mounting.
*   **`metadata.json`**: Application manifest.

### Core Logic
*   **`App.tsx`**: The main controller component.
    *   **State**: Manages `lyricsDoc` (current file), `audioSrc` (media), `history` (Undo/Redo), and UI modals.
    *   **Orchestration**: Connects the Editor (Left) with the Preview (Right) and Audio Player (Bottom).
    *   **File I/O**: Handles drag-and-drop, URL imports, and Project saving/loading.
    *   **Shortcuts**: Manages global hotkeys (`Ctrl+S` Save, `Ctrl+Z` Undo, `Ctrl+V` Paste).

*   **`types.ts`**: TypeScript definitions.
    *   Defines the source of truth for `LyricsDocument`, `TimedLine`, and `TimedWord`.
    *   Defines the `Project` structure for offline storage.

*   **`utils/lyrics.ts`**: The Parsing & Generation Engine.
    *   **`parseTTML`**: A robust DOM-based parser. Uses recursive traversal to handle nested spans, `x-bg` roles (background vocals), and namespaces (`itunes`, `ttm`). Extracts detailed metadata (Songwriters, `itunes:key`).
    *   **`parseLRC` / `parseELRC`**: Regex-based parsers for bracketed timestamps.
    *   **Generators**: `generateTTML` (constructs XML with proper attributes), `generateLRC` (builds standard text output).
    *   **Helpers**: `formatTimestamp` (mm:ss.xx), `shiftTimestamps` (bulk timing adjustment).

### Components (`/components`)

1.  **`LyricsEditor.tsx`**
    *   **Purpose**: The primary workspace for creation and correction.
    *   **Features**:
        *   **Voice Manager**: Create and assign dynamic voices (V1, V2, etc.) to lines.
        *   **Word Mode**: Expand a line to edit individual word timestamps and flags (`isBackground`).
        *   **Smart Inputs**: Auto-growing textareas; `Enter` splits lines; `Backspace` merges/deletes.
    
2.  **`LyricsPreview.tsx`**
    *   **Purpose**: The consumer-facing visualization.
    *   **Features**:
        *   **Duet Logic**: Alternates alignment (Left/Right) based on Voice ID to simulate conversation.
        *   **Active State**: Highlights current line (White) vs past/future (Blurred/Dimmed).
        *   **Word Animation**: Karaokee-style highlighting using Framer Motion.
        *   **Background Vocals**: Renders `isBackground` words as smaller, italicized, and lower opacity.

3.  **`AudioPlayer.tsx`**
    *   **Purpose**: Precision media control.
    *   **Tech**: Uses `requestAnimationFrame` to sync state with the `<audio>` element for millisecond-precision updates required for lyrics.
    *   **UI**: Custom progress bar with hover-seek and distinct play/pause/skip controls.

4.  **`Logo.tsx`**
    *   **Purpose**: Brand identity.
    *   **Tech**: SVG component rendering the "Note-in-Lyrics" icon.

## 4. Design System

The application uses a strict solid-color dark mode palette defined in `index.html`:

*   **Background** (`#0f1419`): Main app background (Very Dark Navy).
*   **Surface** (`#1a1f2e`): Sidebar, Headers, Player background.
*   **Card** (`#25303d`): Elevated elements (Modals, Active inputs).
*   **Border** (`#374151`): Subtle separators.
*   **Accent** (`#6366f1`): Primary Indigo used for buttons, active states, and highlights.
*   **Text**: 
    *   Primary: `#e8eaed`
    *   Muted: `#9ca3af`

## 5. Data Model (`LyricsDocument`)

The entire app state is derived from this structure:

```typescript
interface LyricsDocument {
  format: LyricsFormat; // LRC, ELRC, TTML
  lines: TimedLine[];
  metadata: {
    title?: string;
    artist?: string;
    album?: string;
    songwriters?: string[]; // Extracted from TTML <songwriters> or LRC [au]
    language?: string;      // ISO-639-1 code
    // ...
  };
}

interface TimedLine {
  id: string;
  startTime: number;        // Seconds
  endTime?: number;
  words: TimedWord[];       // Array of words (even for line-synced lyrics)
  voice?: string;           // "Singer 1", "Singer 2", etc.
  isBackground?: boolean;   // Line-level background vocal flag
  attributes?: Record<string, string>; // Preserves TTML attributes (e.g., itunes:key)
  rawText: string;          // Convenience string
}

interface TimedWord {
  startTime: number;
  endTime?: number;
  text: string;
  isBackground?: boolean;   // Word-level background vocal flag
}
```

## 6. Parsing Logic Deep Dive (TTML)

The `parseTTML` function in `utils/lyrics.ts` is critical for professional workflows:
1.  **Namespaces**: It explicitly handles `ttm` and `itunes` namespaces to ensure compatibility with Apple Music specifications.
2.  **Recursion**: It traverses the DOM tree to inherit roles. If a parent `<span>` has `ttm:role="x-bg"`, all child text nodes inherit `isBackground=true`.
3.  **Agent Mapping**: Maps `xml:id` agents in `<head>` to human-readable voice names used in the Editor.

## 7. Developer Notes

*   **Global Paste**: The app listens for `paste` events on the `window`. If the user pastes text while *not* focused on an input, the app attempts to parse it as a new Lyrics Document.
*   **Undo/Redo**: Implemented via a snapshot history array in `App.tsx`. Most actions in `LyricsEditor` trigger a snapshot.
*   **Offline Audio**: Audio files are stored as binary `Blob`s in IndexedDB. When loading a project, `URL.createObjectURL` is used to create a playable source.