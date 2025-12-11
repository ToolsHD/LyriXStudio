# LyriXStudio

**LyriXStudio** is a professional web-based application for creating, editing, and previewing synchronized lyrics. It bridges the gap between raw text and the complex formats required by modern streaming platforms like Apple Music and Spotify.

This project was built to explore the capabilities of **Google Gemini 3 Pro** when guided by an advanced AI prompting workflow.

---

## 🚀 Features

### Core Functionality
*   **Multi-Format Support**: Import and export standard **LRC** (Line Synced), **Enhanced LRC (ELRC)** (Word Synced), and **TTML** (Apple Music XML).
*   **Precision Editor**: Edit timestamps down to the millisecond for both lines and individual words.
*   **Apple Music-Style Preview**: A high-fidelity visualizer with motion blur, active line scaling, and duet alignment.
*   **Offline Project Management**: Save your work, including large audio files, directly in your browser using IndexedDB.

### Advanced Editing Tools
*   **Voice Management**: Assign specific singers (e.g., "Singer 1", "Singer 2") to lines for duet visualization.
*   **Background Vocals**: Mark specific lines or words as background vocals (`x-bg`) for distinct styling.
*   **Keyboard Shortcuts**: Fast workflows with shortcuts for play/pause, adding lines, and undo/redo.
*   **Diff View**: Compare your current edits against the original file to track changes.

---

## 🛠️ Technology Stack

This project runs entirely in the browser without a complex build step, using modern web standards.

*   **Frontend Library**: [React 18](https://react.dev/) (via ESM).
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Runtime configuration).
*   **Animations**: [Framer Motion](https://www.framer.com/motion/).
*   **Storage**: [LocalForage](https://github.com/localforage/localforage) (IndexedDB wrapper).
*   **Icons**: [Lucide React](https://lucide.dev/).
*   **Utilities**: `diff` (for text comparison), `iso-639-1` (language codes).

---

## 📂 Architecture

The project is structured as a Single Page Application (SPA) loaded via `index.html`.

### Key Files
*   **`App.tsx`**: The main controller. Handles state, audio playback, file imports, and coordinates the Editor and Preview components.
*   **`utils/lyrics.ts`**: The engine room. Contains robust parsers for TTML (XML DOM), LRC (Regex), and logic for timestamp manipulation.
*   **`components/LyricsEditor.tsx`**: The workspace for editing text, timing, and metadata.
*   **`components/LyricsPreview.tsx`**: The visualizer component handling scrolling, animations, and voice alignment.
*   **`types.ts`**: TypeScript definitions for the `LyricsDocument` data model.

### Data Model
Data is normalized into a `LyricsDocument` object:
```typescript
{
  format: "TTML" | "LRC" | "ELRC",
  metadata: { title, artist, songwriters, language, ... },
  lines: [
    {
      startTime: 12.5,
      words: [{ text: "Hello", startTime: 12.5 }, ...],
      voice: "Singer 1",
      isBackground: false
    }
  ]
}
```

---

## ⚡ Setup Instructions

Since this project uses Import Maps and CDN links, you do not need `npm install` or a build process like Webpack.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/toolshd/LyriXStudio.git
    ```
2.  **Serve the directory**:
    You need a simple static file server. You cannot open `index.html` directly (file:// protocol) due to CORS restrictions on ES modules.
    *   **VS Code**: Right-click `index.html` -> "Open with Live Server".
    *   **Python**: `python3 -m http.server 8000`
    *   **Node**: `npx serve .`
3.  **Open in Browser**:
    Navigate to `http://localhost:8000`.

---

## 📖 Usage Guide

### 1. Importing Media
*   **Audio**: Drag and drop an MP3/WAV file, or paste a URL.
*   **Lyrics**: Drag and drop an LRC/TTML file, or paste text directly (Ctrl+V) anywhere in the app.

### 2. Editing
*   **Play/Pause**: Click the play button or use standard media keys.
*   **Adjust Time**: Click the timestamp next to a line to jump there. Edit the text box to change lyrics.
*   **Add Line**: Press `Ctrl + Enter` to insert a new line below the current one.
*   **Word Mode**: Press `Ctrl + M` or the "Word Mode" button to expand lines and edit individual word timings.

### 3. Metadata
*   Click the **Edit** icon (pencil) in the header to set Title, Artist, Songwriters, and Language (`xml:lang`).
*   Language selection includes a searchable list of all standard codes.

### 4. Exporting
*   Click the **Download** icon.
*   Choose **Standard LRC** for basic players.
*   Choose **Enhanced LRC** if you added word-level timings.
*   Choose **Apple TTML** for professional distribution (supports roles, background vocals).

---

## 🤖 AI Integration

**LyriXStudio** is a demonstration of AI-assisted software engineering.

*   **Developer**: Google Gemini 3 Pro.
*   **Prompter**: COMET browser and ATLAS

The entire codebase, from the recursive XML parser to the React component structure, was generated through iterative prompting to test the reasoning and coding capabilities of the Gemini 3 Pro model.

---

## 🤝 Contribution

We welcome contributions!

1.  **Fork** the project.
2.  **Create a branch** (`git checkout -b feature/AmazingFeature`).
3.  **Commit changes** (`git commit -m 'Add some AmazingFeature'`).
4.  **Push** (`git push origin feature/AmazingFeature`).
5.  **Open a Pull Request**.

Please ensure you maintain the solid-color dark mode aesthetic defined in `index.html`.

---

*Built with 🎵 by AI.*
