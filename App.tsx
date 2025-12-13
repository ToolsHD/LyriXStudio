
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LyricsDocument, LyricsFormat, Project } from './types';
import { parseLyrics, generateLRC, generateELRC, generateTTML, shiftTimestamps } from './utils/lyrics';
import AudioPlayer from './components/AudioPlayer';
import LyricsPreview from './components/LyricsPreview';
import LyricsEditor from './components/LyricsEditor';
import { Logo } from './components/Logo';
import { AnimatePresence, motion } from 'framer-motion';
import { 
    Save, Folder, Link as LinkIcon, Upload, Music, FileText, 
    Settings, PlayCircle, Layers, ChevronRight,
    Download, RefreshCw, X, ArrowDownWideNarrow, Trash2, Disc, Menu, Check,
    Import, FileAudio, FileCode, Clipboard, Undo2, Redo2, FileEdit,
    Search, Copy, ScrollText, HelpCircle,
    Clock, Timer, Users, UserCog, Split, Sparkles, Keyboard, MousePointerClick
} from 'lucide-react';
// @ts-ignore
import * as Diff from 'diff';
// @ts-ignore
import ISO6391 from 'iso-639-1';

declare const localforage: any;

const LANGUAGES = ISO6391.getAllCodes().map((code: string) => ({
    code,
    name: ISO6391.getName(code)
})).sort((a: any, b: any) => a.name.localeCompare(b.name));

export default function App() {
  const [lyricsDoc, setLyricsDoc] = useState<LyricsDocument>({ format: LyricsFormat.PLAIN, lines: [], metadata: {} });
  const [originalDoc, setOriginalDoc] = useState<LyricsDocument | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [definedVoices, setDefinedVoices] = useState<string[]>([]);
  
  // Undo/Redo History
  const [history, setHistory] = useState<LyricsDocument[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [showDiff, setShowDiff] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('preview'); 
  
  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  
  const [projectNameInput, setProjectNameInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Metadata Search State
  const [langSearch, setLangSearch] = useState('');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  useEffect(() => {
      if (typeof localforage !== 'undefined') {
          localforage.getItem('projects').then((val: any) => { if (val) setProjects(val); });
      }
      // Initialize history
      setHistory([{ format: LyricsFormat.PLAIN, lines: [], metadata: {} }]);
      setHistoryIndex(0);
  }, []);

  // Update Lyrics with History
  const updateLyricsDoc = (newDoc: LyricsDocument, addToHistory = true) => {
      setLyricsDoc(newDoc);
      if (addToHistory && !isUndoRedoAction.current) {
          // If we are not at the end of history, slice it
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(newDoc);
          // Limit history size if needed (e.g. 50)
          if (newHistory.length > 50) newHistory.shift();
          
          setHistory(newHistory);
          setHistoryIndex(newHistory.length - 1);
      }
      isUndoRedoAction.current = false;
  };

  const undo = () => {
      if (historyIndex > 0) {
          isUndoRedoAction.current = true;
          const prevDoc = history[historyIndex - 1];
          setHistoryIndex(historyIndex - 1);
          setLyricsDoc(prevDoc);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          isUndoRedoAction.current = true;
          const nextDoc = history[historyIndex + 1];
          setHistoryIndex(historyIndex + 1);
          setLyricsDoc(nextDoc);
      }
  };

  const clearLyrics = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Use setTimeout to ensure the event loop is clear before blocking with confirm
      setTimeout(() => {
          if (window.confirm("Are you sure you want to clear all lyrics? This cannot be undone.")) {
              const emptyDoc: LyricsDocument = { 
                  format: LyricsFormat.PLAIN, 
                  lines: [], 
                  metadata: { title: '', artist: '', album: '', songwriters: [], author: '', custom: {} } 
              };
              updateLyricsDoc(emptyDoc, true);
              setOriginalDoc(null);
              setDefinedVoices([]);
          }
      }, 50);
  };

  // Download URL to Blob for offline storage
  const fetchAudioBlob = async (url: string): Promise<Blob | null> => {
      try {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Network response was not ok');
          return await response.blob();
      } catch (error) {
          console.error('Failed to fetch audio for offline storage', error);
          return null;
      }
  };

  const handleSaveProject = async () => {
      if (typeof localforage === 'undefined') return;
      setIsSaving(true);
      
      try {
          let audioBlob: Blob | undefined = undefined;
          if (audioSrc && audioSrc.startsWith('blob:')) {
             audioBlob = await fetchAudioBlob(audioSrc) || undefined;
          } else if (audioSrc) {
             audioBlob = await fetchAudioBlob(audioSrc) || undefined;
          }

          const newProject: Project = {
              id: Date.now().toString(),
              name: projectNameInput || lyricsDoc.metadata.title || `Untitled ${new Date().toLocaleDateString()}`,
              updatedAt: Date.now(),
              lyrics: lyricsDoc,
              audioSrc: audioSrc?.startsWith('blob:') ? null : audioSrc, 
              audioBlob: audioBlob
          };

          const updated = [newProject, ...projects.filter(p => p.name !== newProject.name)];
          setProjects(updated);
          await localforage.setItem('projects', updated);
          setShowSaveModal(false);
          setProjectNameInput('');
      } catch (e) {
          console.error("Save failed", e);
          alert("Failed to save project. Audio might be too large.");
      } finally {
          setIsSaving(false);
      }
  };

  const loadProject = (p: Project) => {
      updateLyricsDoc(p.lyrics);
      setOriginalDoc(p.lyrics);
      setDefinedVoices([]); 

      if (audioSrc && audioSrc.startsWith('blob:')) URL.revokeObjectURL(audioSrc);

      if (p.audioBlob) {
          const url = URL.createObjectURL(p.audioBlob);
          setAudioSrc(url);
      } else if (p.audioSrc) {
          setAudioSrc(p.audioSrc);
      } else {
          setAudioSrc(null);
      }
      setShowProjectsModal(false);
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("Are you sure you want to delete this project?")) return;
      
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      await localforage.setItem('projects', updated);
  };

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.metaKey || e.ctrlKey) {
              if (e.key === 's') {
                  e.preventDefault();
                  setProjectNameInput(lyricsDoc.metadata.title || '');
                  setShowSaveModal(true);
              }
              if (e.key === 'z') {
                  e.preventDefault();
                  if (e.shiftKey) redo();
                  else undo();
              }
              if (e.key === 'y') {
                  e.preventDefault();
                  redo();
              }
          }

          // Help Shortcut (?)
          if (e.key === '?' && !['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase() || '')) {
              e.preventDefault();
              setShowHelpModal(prev => !prev);
          }

          // Escape closes modals
          if (e.key === 'Escape') {
              setShowHelpModal(false);
              setShowImportModal(false);
              setShowProjectsModal(false);
              setShowSaveModal(false);
              setShowMetadataModal(false);
              setShowExportMenu(false);
          }
      };

      const handleGlobalPaste = (e: ClipboardEvent) => {
          const activeTag = document.activeElement?.tagName.toLowerCase();
          if (activeTag === 'input' || activeTag === 'textarea') return;

          const text = e.clipboardData?.getData('text');
          if (text) {
              // Enhanced: Check if it's an audio URL first
              const isAudioUrl = text.match(/^https?:\/\/.+\.(mp3|wav|ogg|m4a)(\?.*)?$/i);
              if (isAudioUrl) {
                   if (audioSrc?.startsWith('blob:')) URL.revokeObjectURL(audioSrc);
                   setAudioSrc(text);
                   return;
              }

              const doc = parseLyrics(text);
              if (doc.lines.length > 0) {
                  updateLyricsDoc(doc); // Replaces all lyrics
                  setOriginalDoc(doc);
                  if (window.innerWidth < 768) setActiveTab('editor');
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('paste', handleGlobalPaste);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('paste', handleGlobalPaste);
      };
  }, [lyricsDoc, history, historyIndex, audioSrc, showHelpModal, showImportModal, showProjectsModal, showSaveModal, showMetadataModal]);

  const processFile = async (file: File) => {
    if (file.name.match(/\.(mp3|m4a|wav|ogg)$/i)) {
      if (audioSrc?.startsWith('blob:')) URL.revokeObjectURL(audioSrc);
      setAudioSrc(URL.createObjectURL(file));
    } else {
      const text = await file.text();
      const doc = parseLyrics(text);
      updateLyricsDoc(doc);
      setOriginalDoc(doc);
      if (window.innerWidth < 768) setActiveTab('editor');
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) {
          await processFile(file);
          setShowImportModal(false);
      }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        await processFile(file);
        setShowImportModal(false);
    }
  };

  const handleUrlImport = () => {
      if (urlInput) {
          setAudioSrc(urlInput);
          setShowImportModal(false);
          setUrlInput('');
      }
  };

  const handlePasteImport = () => {
      if (pasteInput.trim()) {
          const doc = parseLyrics(pasteInput);
          updateLyricsDoc(doc);
          setOriginalDoc(doc);
          if (window.innerWidth < 768) setActiveTab('editor');
          setShowImportModal(false);
          setPasteInput('');
      }
  };

  const hasWordSync = useCallback(() => {
    return lyricsDoc.lines.some(l => 
        l.words.length > 1 && 
        l.words.some(w => w.startTime > l.startTime + 0.05)
    );
  }, [lyricsDoc]);

  const handleDownload = (format: 'LRC' | 'ELRC' | 'TTML') => {
    let output = '';
    let ext = 'lrc';
    switch (format) {
      case 'LRC': output = generateLRC(lyricsDoc); ext = 'lrc'; break;
      case 'ELRC': output = generateELRC(lyricsDoc); ext = 'lrc'; break; // ELRC is also .lrc
      case 'TTML': output = generateTTML(lyricsDoc); ext = 'ttml'; break;
    }
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lyricsDoc.metadata.title || 'synced'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleCopy = async (format: 'LRC' | 'ELRC' | 'TTML') => {
      let output = '';
      switch (format) {
        case 'LRC': output = generateLRC(lyricsDoc); break;
        case 'ELRC': output = generateELRC(lyricsDoc); break;
        case 'TTML': output = generateTTML(lyricsDoc); break;
      }
      try {
          await navigator.clipboard.writeText(output);
          setCopiedFormat(format);
          setTimeout(() => setCopiedFormat(null), 2000);
      } catch (err) {
          console.error('Failed to copy', err);
          alert('Failed to copy to clipboard');
      }
  };

  const renderDiff = () => {
      if (!originalDoc) return null;
      const oldText = generateLRC(originalDoc);
      const newText = generateLRC(lyricsDoc);
      const changes = Diff.diffLines(oldText, newText);

      return (
          <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {changes.map((part: any, index: number) => {
                  const color = part.added ? 'bg-success/20 text-success' :
                                part.removed ? 'bg-error/20 text-error' :
                                'text-muted';
                  return <span key={index} className={`block px-2 ${color}`}>{part.value}</span>;
              })}
          </div>
      );
  };

  const filteredLanguages = LANGUAGES.filter((l: any) => 
    l.name.toLowerCase().includes(langSearch.toLowerCase()) || 
    l.code.toLowerCase().includes(langSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen text-text bg-background font-sans overflow-hidden">
      
      {/* Header - Solid Surface */}
      <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0 z-50 relative">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 w-1/4">
            <Logo size={36} className="shadow-sm" />
            <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight leading-none text-white hidden md:block">LyriXStudio</span>
            </div>
        </div>

        {/* Center: Tools */}
        <div className="flex justify-center flex-1 gap-3">
             <div className="flex items-center gap-1 bg-card px-1 py-1 rounded-lg border border-border">
                 <button onClick={undo} disabled={historyIndex <= 0} className="p-2 text-muted hover:text-accent-primary disabled:opacity-30 rounded-md transition-colors" title="Undo (Ctrl+Z)">
                    <Undo2 size={16} />
                 </button>
                 <div className="w-px h-4 bg-border mx-1"></div>
                 <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 text-muted hover:text-accent-primary disabled:opacity-30 rounded-md transition-colors" title="Redo (Ctrl+Y)">
                    <Redo2 size={16} />
                 </button>
             </div>

             <div className="flex items-center gap-1 bg-card px-1 py-1 rounded-lg border border-border">
                 <button onClick={() => setShowMetadataModal(true)} className="p-2 text-muted hover:text-text rounded-md transition-colors" title="Song Metadata">
                    <FileEdit size={16} />
                 </button>
                 <div className="w-px h-4 bg-border mx-1"></div>
                 <button onClick={clearLyrics} className="p-2 text-muted hover:text-error rounded-md transition-colors" title="Clear Lyrics">
                    <Trash2 size={16} />
                 </button>
             </div>
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center justify-end gap-3 w-1/4">
             <button onClick={() => setShowHelpModal(true)} className="p-2 text-muted hover:text-text rounded-md transition-colors md:mr-2" title="Help & Shortcuts (?)">
                <HelpCircle size={18} />
             </button>

             <div className="hidden md:flex bg-card px-1 py-1 rounded-lg border border-border">
                 <button onClick={() => setShowProjectsModal(true)} className="p-2 text-muted hover:text-text rounded-md transition-colors" title="Open Project">
                    <Folder size={18} />
                 </button>
                 <div className="w-px h-4 bg-border mx-1"></div>
                 <button onClick={() => { setProjectNameInput(lyricsDoc.metadata.title || ''); setShowSaveModal(true); }} className="p-2 text-muted hover:text-text rounded-md transition-colors" title="Save Project">
                    <Save size={18} />
                 </button>
             </div>
             
             <button 
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white bg-accent-primary hover:bg-accent-600 rounded-lg transition-colors shadow-sm"
             >
                <Import size={16} />
                <span className="hidden lg:inline">Import</span>
             </button>

             {/* Export Dropdown */}
             <div className="relative">
                 <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 text-muted hover:text-text bg-card border border-border rounded-lg transition-colors hover:border-accent-primary" title="Export">
                    <Download size={18} />
                 </button>
                 <AnimatePresence>
                    {showExportMenu && (
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 5 }} className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50 origin-top-right">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface/50">
                                <span className="text-[10px] uppercase font-bold text-muted">Export As</span>
                                <button onClick={() => setShowExportMenu(false)}><X size={12} className="text-muted hover:text-text"/></button>
                            </div>
                            
                            {/* Formats List */}
                            <div className="p-1 space-y-0.5">
                                {/* LRC */}
                                <div className="flex items-center justify-between px-3 py-2 hover:bg-surface rounded transition-colors group">
                                    <div className="flex-1">
                                        <span className="block text-xs font-medium text-text">Standard LRC</span>
                                        <span className="text-[10px] text-muted">Line-synced (.lrc)</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleCopy('LRC')} className="p-1.5 text-muted hover:text-accent-primary hover:bg-card border border-transparent hover:border-border rounded transition-all" title="Copy">
                                            {copiedFormat === 'LRC' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                        </button>
                                        <button onClick={() => handleDownload('LRC')} className="p-1.5 text-muted hover:text-accent-primary hover:bg-card border border-transparent hover:border-border rounded transition-all" title="Download">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* ELRC */}
                                <div className={`flex items-center justify-between px-3 py-2 hover:bg-surface rounded transition-colors group ${!hasWordSync() ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex-1">
                                        <span className="block text-xs font-medium text-text">Enhanced LRC</span>
                                        <span className="text-[10px] text-muted">Word-synced (.lrc)</span>
                                        {!hasWordSync() && <span className="text-[9px] text-error block">No word timings</span>}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => hasWordSync() && handleCopy('ELRC')} className="p-1.5 text-muted hover:text-accent-primary hover:bg-card border border-transparent hover:border-border rounded transition-all" title="Copy">
                                            {copiedFormat === 'ELRC' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                        </button>
                                        <button onClick={() => hasWordSync() && handleDownload('ELRC')} className="p-1.5 text-muted hover:text-accent-primary hover:bg-card border border-transparent hover:border-border rounded transition-all" title="Download">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* TTML */}
                                <div className="flex items-center justify-between px-3 py-2 hover:bg-surface rounded transition-colors group">
                                    <div className="flex-1">
                                        <span className="block text-xs font-medium text-text">Apple TTML</span>
                                        <span className="text-[10px] text-muted">XML + Styles (.ttml)</span>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleCopy('TTML')} className="p-1.5 text-muted hover:text-accent-primary hover:bg-card border border-transparent hover:border-border rounded transition-all" title="Copy">
                                            {copiedFormat === 'TTML' ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                        </button>
                                        <button onClick={() => handleDownload('TTML')} className="p-1.5 text-muted hover:text-accent-primary hover:bg-card border border-transparent hover:border-border rounded transition-all" title="Download">
                                            <Download size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                 </AnimatePresence>
             </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
          
          {/* Editor Sidebar */}
          <motion.div 
            initial={false}
            animate={{ 
                x: window.innerWidth < 768 && activeTab !== 'editor' ? '-100%' : 0,
                width: window.innerWidth < 768 ? '100%' : '420px',
                position: window.innerWidth < 768 ? 'absolute' : 'relative'
            }}
            className="h-full flex flex-col bg-surface border-r border-border z-40 shadow-lg"
          >
             {lyricsDoc.lines.length === 0 ? (
                 <div 
                    className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted gap-4 cursor-pointer hover:bg-card/50 transition-colors"
                    onClick={() => setShowImportModal(true)}
                 >
                     <div className="p-4 rounded-full bg-card border border-border mb-2">
                        <FileText size={32} className="text-muted" />
                     </div>
                     <div>
                        <p className="text-sm font-medium text-text">No lyrics loaded</p>
                        <p className="text-xs mt-1">Import file or paste (Ctrl+V) to start</p>
                     </div>
                 </div>
             ) : (
                 <LyricsEditor 
                    doc={lyricsDoc} 
                    onUpdate={updateLyricsDoc} 
                    currentTime={currentTime} 
                    onSeek={setCurrentTime}
                    definedVoices={definedVoices}
                    setDefinedVoices={setDefinedVoices}
                    audioSrc={audioSrc}
                 />
             )}
          </motion.div>

          {/* Main Stage */}
          <div className="flex-1 flex flex-col bg-background relative min-w-0">
             
             {/* Preview */}
             <div className="flex-1 relative overflow-hidden">
                <LyricsPreview 
                    lines={lyricsDoc.lines} 
                    currentTime={currentTime} 
                    onLineClick={setCurrentTime}
                    autoScroll={autoScroll}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying(!isPlaying)}
                    definedVoices={definedVoices}
                />
                
                {/* Floating Toolbar */}
                <div className="absolute top-6 right-6 flex flex-col gap-2 items-end z-30">
                    <div className="flex gap-1 bg-card p-1 rounded-lg border border-border shadow-md">
                         <button onClick={() => setAutoScroll(!autoScroll)} className={`p-2 rounded-md transition-colors ${autoScroll ? 'text-accent-primary bg-background' : 'text-muted hover:text-text'}`} title="Auto Scroll">
                             <ScrollText size={18} />
                         </button>
                         <button onClick={() => setShowDiff(!showDiff)} className={`p-2 rounded-md transition-colors ${showDiff ? 'text-accent-primary bg-background' : 'text-muted hover:text-text'}`} title="Diff View">
                             <Layers size={18} />
                         </button>
                    </div>
                </div>

                {/* Diff View Overlay */}
                <AnimatePresence>
                    {showDiff && originalDoc && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute inset-y-4 right-4 w-96 bg-card rounded-lg border border-border z-30 flex flex-col shadow-2xl overflow-hidden">
                            <div className="flex justify-between items-center p-4 border-b border-border bg-surface">
                                <h3 className="text-sm font-bold flex items-center gap-2"><Layers size={14}/> Comparison</h3>
                                <button onClick={() => setShowDiff(false)} className="text-muted hover:text-text"><X size={16}/></button>
                            </div>
                            <div className="flex-1 overflow-auto p-4 bg-background text-xs">
                                {renderDiff()}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
             </div>

             {/* Minimal Bottom Player Bar */}
             {audioSrc && (
                 <div className="bg-surface border-t border-border p-4 z-20">
                    <div className="w-full max-w-2xl mx-auto">
                        <AudioPlayer 
                            src={audioSrc}
                            isPlaying={isPlaying}
                            currentTime={currentTime}
                            onPlayPauseChange={setIsPlaying}
                            onTimeUpdate={setCurrentTime}
                            onDurationChange={setDuration}
                        />
                    </div>
                 </div>
             )}
          </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex bg-surface border-t border-border pb-safe z-50">
        <button onClick={() => setActiveTab('editor')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${activeTab === 'editor' ? 'text-accent-primary bg-background' : 'text-muted'}`}>Editor</button>
        <button onClick={() => setActiveTab('preview')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${activeTab === 'preview' ? 'text-accent-primary bg-background' : 'text-muted'}`}>Preview</button>
      </div>
      
      {/* Help Modal */}
      <AnimatePresence>
        {showHelpModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                    {/* Modal Header */}
                    <div className="flex justify-between items-center p-4 border-b border-border bg-surface shrink-0">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-text">
                            <HelpCircle size={20} className="text-accent-primary"/> 
                            Help & Reference
                        </h3>
                        <button onClick={() => setShowHelpModal(false)} className="p-1 hover:bg-background rounded-full transition-colors"><X size={20} className="text-muted hover:text-text"/></button>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        
                        {/* 1. Quick Start */}
                        <section>
                            <h4 className="text-sm font-bold text-muted uppercase mb-3 flex items-center gap-2">
                                <Sparkles size={14}/> Quick Start
                            </h4>
                            <div className="grid md:grid-cols-3 gap-4">
                                <div className="bg-background border border-border rounded-lg p-3">
                                    <div className="w-8 h-8 rounded bg-accent-primary/10 flex items-center justify-center text-accent-primary mb-2 font-bold">1</div>
                                    <div className="text-sm font-bold mb-1">Import</div>
                                    <p className="text-xs text-muted">Drag & drop Audio (MP3/WAV) and Lyrics (LRC/TXT) files, or paste from clipboard.</p>
                                </div>
                                <div className="bg-background border border-border rounded-lg p-3">
                                    <div className="w-8 h-8 rounded bg-accent-primary/10 flex items-center justify-center text-accent-primary mb-2 font-bold">2</div>
                                    <div className="text-sm font-bold mb-1">Sync & Edit</div>
                                    <p className="text-xs text-muted">Use the Player to seek. Click lines to jump. Edit text directly or use tools to shift timing.</p>
                                </div>
                                <div className="bg-background border border-border rounded-lg p-3">
                                    <div className="w-8 h-8 rounded bg-accent-primary/10 flex items-center justify-center text-accent-primary mb-2 font-bold">3</div>
                                    <div className="text-sm font-bold mb-1">Export</div>
                                    <p className="text-xs text-muted">Download as TTML (for Apple Music) or Enhanced LRC (for standard players).</p>
                                </div>
                            </div>
                        </section>

                        {/* 2. Shortcuts */}
                        <section>
                            <h4 className="text-sm font-bold text-muted uppercase mb-3 flex items-center gap-2">
                                <Keyboard size={14}/> Keyboard Shortcuts
                            </h4>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Save Project</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">Ctrl + S</kbd></div>
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Undo</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">Ctrl + Z</kbd></div>
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Redo</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">Ctrl + Y</kbd></div>
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Paste Lyrics/Audio</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">Ctrl + V</kbd></div>
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Add Line</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">Ctrl + Enter</kbd></div>
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Delete Line</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">Ctrl + Backspace</kbd></div>
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Toggle Word Mode</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">Ctrl + M</kbd></div>
                                <div className="flex justify-between border-b border-border/50 pb-1"><span>Toggle Help</span> <kbd className="bg-surface px-1.5 rounded text-xs border border-border font-mono">?</kbd></div>
                            </div>
                        </section>

                        {/* 3. Icon Legend */}
                        <section>
                            <h4 className="text-sm font-bold text-muted uppercase mb-3 flex items-center gap-2">
                                <MousePointerClick size={14}/> Interface Icons
                            </h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <h5 className="text-xs font-bold text-accent-primary mb-2">Header / General</h5>
                                    <ul className="space-y-2 text-xs">
                                        <li className="flex items-center gap-3"><Import size={16} className="text-muted"/> <span>Import media files or URLs</span></li>
                                        <li className="flex items-center gap-3"><Folder size={16} className="text-muted"/> <span>Open saved local projects</span></li>
                                        <li className="flex items-center gap-3"><Save size={16} className="text-muted"/> <span>Save project (cached in browser)</span></li>
                                        <li className="flex items-center gap-3"><Download size={16} className="text-muted"/> <span>Export/Download lyrics file</span></li>
                                        <li className="flex items-center gap-3"><FileEdit size={16} className="text-muted"/> <span>Edit Metadata (Title, Artist, etc.)</span></li>
                                        <li className="flex items-center gap-3"><Trash2 size={16} className="text-muted"/> <span>Clear all lyrics</span></li>
                                        <li className="flex items-center gap-3"><Undo2 size={16} className="text-muted"/> <span>Undo last action</span></li>
                                    </ul>
                                </div>
                                <div>
                                    <h5 className="text-xs font-bold text-accent-primary mb-2">Editor & Preview</h5>
                                    <ul className="space-y-2 text-xs">
                                        <li className="flex items-center gap-3"><Clock size={16} className="text-muted"/> <span>Timing Tools (Batch Shift, Silence Detect)</span></li>
                                        <li className="flex items-center gap-3"><Timer size={16} className="text-muted"/> <span>Line Sync Mode (Tap to sync)</span></li>
                                        <li className="flex items-center gap-3"><Users size={16} className="text-muted"/> <span>Voice Manager (Add singers)</span></li>
                                        <li className="flex items-center gap-3"><UserCog size={16} className="text-muted"/> <span>Voice Assign Mode (Toggle buttons)</span></li>
                                        <li className="flex items-center gap-3"><Split size={16} className="text-muted"/> <span>Word Mode (Edit syllable timings)</span></li>
                                        <li className="flex items-center gap-3"><ScrollText size={16} className="text-muted"/> <span>Auto-scroll preview</span></li>
                                        <li className="flex items-center gap-3"><Layers size={16} className="text-muted"/> <span>Diff View (Compare with original)</span></li>
                                    </ul>
                                </div>
                            </div>
                        </section>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Import/Metadata/Projects/Save modals remain unchanged... */}
      <AnimatePresence>
        {showImportModal && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            >
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-card border border-border rounded-lg w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                >
                    <div className="flex justify-between items-center p-4 border-b border-border bg-surface shrink-0">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-text">
                            <Import size={20} className="text-accent-primary"/> 
                            Import Media
                        </h3>
                        <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-background rounded-full transition-colors">
                            <X size={20} className="text-muted hover:text-text"/>
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-6 overflow-y-auto bg-card">
                        {/* Drag and Drop Area */}
                        <div 
                            className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 text-center transition-colors hover:border-accent-primary hover:bg-surface cursor-pointer relative group bg-background"
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent-primary', 'bg-surface'); }}
                            onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-accent-primary', 'bg-surface'); }}
                            onDrop={handleFileDrop}
                        >
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileInput} accept=".mp3,.m4a,.wav,.ogg,.lrc,.txt,.xml,.ttml" />
                            <div className="p-3 bg-card rounded-full border border-border group-hover:scale-110 transition-transform">
                                <Upload size={24} className="text-accent-primary" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-text">Click to upload or drag & drop</p>
                                <p className="text-xs text-muted mt-1">Audio (.mp3, .wav) or Lyrics (.lrc, .xml)</p>
                            </div>
                        </div>

                        {/* Divider URL */}
                        <div className="flex items-center gap-3">
                            <div className="h-px bg-border flex-1"></div>
                            <span className="text-[10px] font-bold text-muted uppercase">Or load from URL</span>
                            <div className="h-px bg-border flex-1"></div>
                        </div>

                        {/* URL Input */}
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                <input 
                                    className="w-full bg-background border border-border rounded pl-9 pr-3 py-2.5 text-sm text-text focus:border-accent-primary outline-none transition-colors"
                                    placeholder="https://example.com/audio.mp3"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
                                />
                            </div>
                            <button 
                                onClick={handleUrlImport}
                                disabled={!urlInput}
                                className="px-4 bg-accent-primary text-white rounded text-sm font-bold hover:bg-accent-600 transition-colors disabled:opacity-50"
                            >
                                Load
                            </button>
                        </div>

                        {/* Divider Paste */}
                        <div className="flex items-center gap-3">
                            <div className="h-px bg-border flex-1"></div>
                            <span className="text-[10px] font-bold text-muted uppercase">Or Paste Text</span>
                            <div className="h-px bg-border flex-1"></div>
                        </div>

                        {/* Paste Input */}
                        <div className="flex flex-col gap-2">
                             <div className="relative">
                                <textarea
                                    className="w-full bg-background border border-border rounded p-3 text-sm text-text focus:border-accent-primary outline-none transition-colors resize-none h-24 font-mono leading-relaxed"
                                    placeholder="Paste lyrics here (LRC, Text, XML)..."
                                    value={pasteInput}
                                    onChange={(e) => setPasteInput(e.target.value)}
                                />
                                <Clipboard size={14} className="absolute right-3 bottom-3 text-muted pointer-events-none"/>
                             </div>
                             <button 
                                onClick={handlePasteImport}
                                disabled={!pasteInput.trim()}
                                className="w-full py-2.5 bg-surface border border-border text-accent-primary rounded text-sm font-bold hover:bg-background transition-colors disabled:opacity-50"
                            >
                                Parse Lyrics
                            </button>
                        </div>

                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Metadata Modal, Save Modal, Projects Modal code remains the same as previous output ... */}
      <AnimatePresence>
        {showMetadataModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="bg-card border border-border rounded-lg w-full max-w-sm p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-text">Song Details</h3>
                        <button onClick={() => setShowMetadataModal(false)}><X size={18} className="text-muted hover:text-text"/></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-muted uppercase block mb-1">Title</label>
                            <input 
                                className="w-full bg-background border border-border rounded p-2 text-sm text-text focus:border-accent-primary outline-none" 
                                value={lyricsDoc.metadata.title || ''}
                                onChange={(e) => updateLyricsDoc({ ...lyricsDoc, metadata: { ...lyricsDoc.metadata, title: e.target.value } }, false)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-muted uppercase block mb-1">Artist</label>
                            <input 
                                className="w-full bg-background border border-border rounded p-2 text-sm text-text focus:border-accent-primary outline-none" 
                                value={lyricsDoc.metadata.artist || ''}
                                onChange={(e) => updateLyricsDoc({ ...lyricsDoc, metadata: { ...lyricsDoc.metadata, artist: e.target.value } }, false)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-muted uppercase block mb-1">Album</label>
                            <input 
                                className="w-full bg-background border border-border rounded p-2 text-sm text-text focus:border-accent-primary outline-none" 
                                value={lyricsDoc.metadata.album || ''}
                                onChange={(e) => updateLyricsDoc({ ...lyricsDoc, metadata: { ...lyricsDoc.metadata, album: e.target.value } }, false)}
                            />
                        </div>
                         
                        <div>
                            <label className="text-xs font-bold text-muted uppercase block mb-1">Songwriters</label>
                            <input 
                                className="w-full bg-background border border-border rounded p-2 text-sm text-text focus:border-accent-primary outline-none" 
                                value={lyricsDoc.metadata.songwriters ? lyricsDoc.metadata.songwriters.join(', ') : (lyricsDoc.metadata.author || '')}
                                onChange={(e) => updateLyricsDoc({ ...lyricsDoc, metadata: { ...lyricsDoc.metadata, songwriters: e.target.value.split(',').map(s => s.trim()) } }, false)}
                                placeholder="George Daniel, Matthew Healy"
                            />
                            <p className="text-[10px] text-muted mt-1">Comma separated list of songwriters</p>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-bold text-muted uppercase block mb-1">Language (xml:lang)</label>
                            <div 
                                className="w-full bg-background border border-border rounded p-2 text-sm text-text flex items-center justify-between cursor-pointer"
                                onClick={() => { setShowLangDropdown(!showLangDropdown); setLangSearch(''); }}
                            >
                                <span>{LANGUAGES.find((l: any) => l.code === lyricsDoc.metadata.language)?.name || lyricsDoc.metadata.language || 'Select Language...'}</span>
                                <span className="text-xs bg-surface border border-border px-1.5 rounded text-muted">{lyricsDoc.metadata.language || 'en'}</span>
                            </div>
                            
                            {showLangDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-xl z-50 max-h-48 overflow-y-auto">
                                    <div className="sticky top-0 bg-card p-2 border-b border-border">
                                        <div className="flex items-center gap-2 bg-background border border-border rounded px-2 py-1">
                                            <Search size={12} className="text-muted"/>
                                            <input 
                                                className="w-full bg-transparent outline-none text-xs text-text"
                                                placeholder="Search..."
                                                value={langSearch}
                                                onChange={(e) => setLangSearch(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    {filteredLanguages.map((l: any) => (
                                        <div 
                                            key={l.code}
                                            className="px-3 py-2 hover:bg-accent-primary/20 hover:text-accent-primary cursor-pointer text-xs flex justify-between items-center"
                                            onClick={() => {
                                                updateLyricsDoc({ ...lyricsDoc, metadata: { ...lyricsDoc.metadata, language: l.code } }, false);
                                                setShowLangDropdown(false);
                                            }}
                                        >
                                            <span>{l.name}</span>
                                            <span className="text-[10px] text-muted">{l.code}</span>
                                        </div>
                                    ))}
                                    {filteredLanguages.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-muted">No languages found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                             <button onClick={() => setShowMetadataModal(false)} className="w-full py-2 bg-accent-primary rounded text-xs font-bold text-white hover:bg-accent-600">Done</button>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showProjectsModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-text"><Folder size={20} className="text-accent-primary"/> Saved Projects</h3>
                        <button onClick={() => setShowProjectsModal(false)} className="p-1 hover:bg-surface rounded-full transition-colors"><X size={20} className="text-muted hover:text-text"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {projects.length === 0 ? <p className="text-muted text-sm text-center py-8">No projects saved locally.</p> : 
                            projects.map(p => (
                                <div key={p.id} className="group p-4 rounded-lg bg-background border border-border hover:border-accent-primary cursor-pointer flex justify-between items-center transition-all" onClick={() => loadProject(p)}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-muted group-hover:text-accent-primary transition-colors">
                                            {p.audioBlob || p.audioSrc ? <Disc size={20}/> : <FileText size={20}/>}
                                        </div>
                                        <div>
                                            {/* Truncated Name with Line Clamp */}
                                            <div className="font-bold text-sm text-text line-clamp-2 break-words">{p.name}</div>
                                            <div className="text-[10px] text-muted flex gap-2">
                                                <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span>{p.lyrics.lines.length} lines</span>
                                                {p.audioBlob && <span className="text-accent-primary">• Offline Ready</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => deleteProject(p.id, e)}
                                            className="p-2 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Project"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                        <ChevronRight size={16} className="text-muted group-hover:text-accent-primary"/>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
