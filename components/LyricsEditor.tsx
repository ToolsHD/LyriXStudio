import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricsDocument, TimedLine, TimedWord } from '../types';
import { generateId, parseTimestamp, formatTimestamp } from '../utils/lyrics';
import { Trash2, Plus, ChevronUp, ChevronDown, Split, PlayCircle, Mic2, Users, X, UserCog, Check } from 'lucide-react';

interface LyricsEditorProps {
  doc: LyricsDocument;
  onUpdate: (doc: LyricsDocument, addToHistory?: boolean) => void;
  onSeek: (time: number) => void;
  currentTime: number;
  definedVoices: string[];
  setDefinedVoices: (voices: string[]) => void;
}

const LyricsEditor: React.FC<LyricsEditorProps> = ({ doc, onUpdate, onSeek, currentTime, definedVoices, setDefinedVoices }) => {
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [globalWordMode, setGlobalWordMode] = useState(false);
  const [showVoiceManager, setShowVoiceManager] = useState(false);
  const [mobileVoiceEditMode, setMobileVoiceEditMode] = useState(false);

  // Initialize voices from doc if empty
  useEffect(() => {
      if (definedVoices.length === 0) {
          const unique = Array.from(new Set(doc.lines.map(l => l.voice).filter(Boolean))) as string[];
          if (unique.length > 0) setDefinedVoices(unique);
          else setDefinedVoices(['Singer 1', 'Singer 2']);
      }
  }, [doc.lines]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        setGlobalWordMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const updateLine = (lineId: string, updates: Partial<TimedLine>, addToHistory = true) => {
    const newLines = doc.lines.map(l => l.id === lineId ? { ...l, ...updates } : l);
    onUpdate({ ...doc, lines: newLines }, addToHistory);
  };

  const deleteLine = (lineId: string) => {
    onUpdate({ ...doc, lines: doc.lines.filter(l => l.id !== lineId) }, true);
  };

  const addLine = (afterIndex: number, specificStartTime?: number, initialText: string = "") => {
    const prevLine = doc.lines[afterIndex];
    const startTime = specificStartTime !== undefined ? specificStartTime : (prevLine ? prevLine.startTime + 2 : 0);
    
    const words = initialText.split(/\s+/).filter(Boolean).map(w => ({ id: generateId(), text: w, startTime }));
    
    const newLine: TimedLine = {
      id: generateId(),
      startTime,
      words,
      rawText: initialText,
      voice: prevLine?.voice 
    };
    const newLines = [...doc.lines];
    newLines.splice(afterIndex + 1, 0, newLine);
    onUpdate({ ...doc, lines: newLines }, true);
  };

  const handleLineKeyDown = (e: React.KeyboardEvent, lineId: string, idx: number) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          addLine(idx);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
          e.preventDefault();
          if (doc.lines.length > 1) deleteLine(lineId);
      }
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, lineIdx: number) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const target = e.currentTarget;
          const cursorPosition = target.selectionStart || 0;
          const line = doc.lines[lineIdx];
          
          const textBefore = line.rawText.substring(0, cursorPosition).trim();
          const textAfter = line.rawText.substring(cursorPosition).trim();
          
          if (!textAfter && !textBefore) {
             addLine(lineIdx);
             return;
          }

          const updatedCurrentLine = {
              ...line,
              rawText: textBefore,
              words: textBefore.split(/\s+/).filter(Boolean).map((w, i) => line.words[i] ? { ...line.words[i], text: w } : { id: generateId(), text: w, startTime: line.startTime })
          };

          const nextLineStartTime = line.startTime + 0.5;
          const newLine = {
              id: generateId(),
              startTime: nextLineStartTime,
              words: textAfter.split(/\s+/).filter(Boolean).map(w => ({ id: generateId(), text: w, startTime: nextLineStartTime })),
              rawText: textAfter,
              voice: line.voice
          };

          const newLines = [...doc.lines];
          newLines[lineIdx] = updatedCurrentLine;
          newLines.splice(lineIdx + 1, 0, newLine);
          onUpdate({ ...doc, lines: newLines }, true);
      }
  };

  const moveWord = (lineIndex: number, direction: 'up' | 'down') => {
      if (direction === 'up' && lineIndex <= 0) return;
      if (direction === 'down' && lineIndex >= doc.lines.length - 1) return;

      const currentLine = doc.lines[lineIndex];
      const targetIdx = direction === 'up' ? lineIndex - 1 : lineIndex + 1;
      const targetLine = doc.lines[targetIdx];
      
      if (currentLine.words.length === 0) return;

      const newLines = [...doc.lines];
      if (direction === 'up') {
          const wordToMove = currentLine.words[0];
          const newCurrentWords = currentLine.words.slice(1);
          const newTargetWords = [...targetLine.words, wordToMove];
          newLines[lineIndex] = { ...currentLine, words: newCurrentWords, rawText: newCurrentWords.map(w => w.text).join(' '), startTime: newCurrentWords[0]?.startTime ?? currentLine.startTime };
          newLines[targetIdx] = { ...targetLine, words: newTargetWords, rawText: newTargetWords.map(w => w.text).join(' ') };
      } else {
          const wordToMove = currentLine.words[currentLine.words.length - 1];
          const newCurrentWords = currentLine.words.slice(0, -1);
          const newTargetWords = [wordToMove, ...targetLine.words];
          newLines[lineIndex] = { ...currentLine, words: newCurrentWords, rawText: newCurrentWords.map(w => w.text).join(' ') };
          newLines[targetIdx] = { ...targetLine, words: newTargetWords, rawText: newTargetWords.map(w => w.text).join(' '), startTime: wordToMove.startTime };
      }
      onUpdate({ ...doc, lines: newLines }, true);
  };

  const updateWord = (lineIndex: number, wordIndex: number, updates: Partial<TimedWord>) => {
      const newLines = [...doc.lines];
      const line = newLines[lineIndex];
      const newWords = [...line.words];
      newWords[wordIndex] = { ...newWords[wordIndex], ...updates };
      
      let newRawText = line.rawText;
      if (updates.text) newRawText = newWords.map(w => w.text).join(' ');
      const newStartTime = (wordIndex === 0 && updates.startTime) ? updates.startTime : line.startTime;

      newLines[lineIndex] = { ...line, words: newWords, rawText: newRawText, startTime: newStartTime };
      onUpdate({ ...doc, lines: newLines }, true);
  };

  const handleAddVoice = (name: string) => {
      if (name && !definedVoices.includes(name)) {
          setDefinedVoices([...definedVoices, name]);
      }
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface sticky top-0 z-20">
        <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-text">Editor</span>
            <div className="h-4 w-px bg-border" />
            <button 
                onClick={() => setShowVoiceManager(!showVoiceManager)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${showVoiceManager ? 'bg-accent-primary text-white' : 'text-muted hover:text-text'}`}
                title="Manage Project Voices"
            >
                <Users size={14} />
                <span className="hidden sm:inline">Voices</span>
            </button>
            
            <button 
                onClick={() => setMobileVoiceEditMode(!mobileVoiceEditMode)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors md:hidden ${mobileVoiceEditMode ? 'bg-accent-primary text-white' : 'text-muted hover:text-text'}`}
                title="Toggle Voice Assignment Buttons"
            >
                <UserCog size={14} />
            </button>
        </div>
        <button 
            onClick={() => setGlobalWordMode(!globalWordMode)}
            className={`flex items-center gap-2 text-xs px-2 py-1 rounded transition-colors ${globalWordMode ? 'bg-accent-primary text-white' : 'text-muted hover:text-text'}`}
            title="Toggle Word Mode (Ctrl+M)"
        >
            <Split size={14} />
            <span className="hidden sm:inline">Word Mode</span>
        </button>
      </div>

      {/* Voice Manager Dropdown */}
      <AnimatePresence>
        {showVoiceManager && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border bg-background">
                <div className="p-3 grid grid-cols-2 gap-2">
                    {definedVoices.map(v => (
                        <div key={v} className="flex items-center justify-between bg-card px-2 py-1 rounded border border-border text-xs">
                            <span className="text-text">{v}</span>
                            <button className="text-muted hover:text-error" onClick={() => setDefinedVoices(definedVoices.filter(dv => dv !== v))}><X size={12} /></button>
                        </div>
                    ))}
                    <div className="flex items-center gap-1">
                        <input 
                            className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs outline-none focus:border-accent-primary text-text"
                            placeholder="New Voice..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddVoice(e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }
                            }}
                        />
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {doc.lines.map((line, idx) => {
            const isActive = currentTime >= line.startTime && (!doc.lines[idx+1] || currentTime < doc.lines[idx+1].startTime);
            const showWords = globalWordMode || expandedLineId === line.id;

            return (
                <div 
                    key={line.id} 
                    className={`
                        rounded-lg border transition-all duration-200 group
                        ${isActive ? 'border-accent-primary bg-card shadow-sm' : 'border-border bg-surface hover:border-border/80'}
                    `}
                >
                    {/* Line Header */}
                    <div className="flex items-start p-2 gap-2">
                        {/* Time Controls */}
                        <div className="flex flex-col items-center gap-1 pt-1">
                            <button className="text-muted hover:text-accent-primary" onClick={() => onSeek(line.startTime)}>
                                <PlayCircle size={14} />
                            </button>
                            <span className="text-[10px] font-mono text-muted">{formatTimestamp(line.startTime)}</span>
                        </div>

                        {/* Text Input */}
                        <div className="flex-1 min-w-0">
                             <div className="relative">
                                <textarea
                                    className={`
                                        w-full bg-transparent resize-none outline-none text-sm font-medium leading-relaxed
                                        ${isActive ? 'text-text' : 'text-text/90'}
                                    `}
                                    rows={1}
                                    value={line.rawText}
                                    onChange={(e) => updateLine(line.id, { rawText: e.target.value, words: e.target.value.split(/\s+/).filter(Boolean).map((w,i) => line.words[i] ? {...line.words[i], text:w} : {id:generateId(), text:w, startTime: line.startTime, isBackground: line.isBackground}) }, false)}
                                    onBlur={() => updateLine(line.id, {}, true)} // Commit on blur
                                    onKeyDown={(e) => { handleLineKeyDown(e, line.id, idx); handleEnterKey(e, idx); }}
                                    style={{ minHeight: '1.5rem', height: 'auto' }}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                />
                                {/* Voice Indicator */}
                                {(line.voice || mobileVoiceEditMode) && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {mobileVoiceEditMode ? (
                                             definedVoices.map(v => (
                                                <button 
                                                    key={v}
                                                    onClick={() => updateLine(line.id, { voice: line.voice === v ? undefined : v })}
                                                    className={`px-1.5 py-0.5 text-[10px] rounded border ${line.voice === v ? 'bg-accent-primary border-accent-primary text-white' : 'bg-background border-border text-muted'}`}
                                                >
                                                    {v}
                                                </button>
                                             ))
                                        ) : (
                                            line.voice && <span className="px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary rounded text-[10px] font-bold border border-accent-primary/20">{line.voice}</span>
                                        )}
                                        {/* Background Vocal Toggle */}
                                        <button 
                                            onClick={() => updateLine(line.id, { isBackground: !line.isBackground })}
                                            className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${line.isBackground ? 'bg-accent-secondary/20 text-accent-secondary border-accent-secondary/20' : 'bg-background border-border text-muted hover:text-text'}`}
                                            title="Toggle Background Vocal"
                                        >
                                            BG
                                        </button>
                                    </div>
                                )}
                             </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => deleteLine(line.id)} className="text-muted hover:text-error p-1"><Trash2 size={12} /></button>
                            <button onClick={() => addLine(idx)} className="text-muted hover:text-accent-primary p-1"><Plus size={12} /></button>
                            <button onClick={() => setExpandedLineId(expandedLineId === line.id ? null : line.id)} className="text-muted hover:text-text p-1">
                                {expandedLineId === line.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                        </div>
                    </div>

                    {/* Word Level Editor */}
                    <AnimatePresence>
                        {showWords && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} 
                                className="overflow-hidden bg-background border-t border-border"
                            >
                                <div className="p-2 grid grid-cols-1 gap-1">
                                    {line.words.map((word, wIdx) => (
                                        <div key={word.id} className="flex items-center gap-2 text-xs py-1">
                                            <div className="flex flex-col gap-0.5">
                                                <button className="text-muted hover:text-accent-primary" onClick={() => moveWord(idx, 'up')} disabled={wIdx === 0 && idx === 0}><ChevronUp size={10}/></button>
                                                <button className="text-muted hover:text-accent-primary" onClick={() => moveWord(idx, 'down')} disabled={wIdx === line.words.length -1 && idx === doc.lines.length -1}><ChevronDown size={10}/></button>
                                            </div>
                                            <input 
                                                className="w-16 bg-surface border border-border rounded px-1 py-0.5 text-center font-mono text-[10px] focus:border-accent-primary outline-none text-text"
                                                value={formatTimestamp(word.startTime)}
                                                onChange={(e) => {
                                                    const val = parseTimestamp(e.target.value);
                                                    if (!isNaN(val)) updateWord(idx, wIdx, { startTime: val });
                                                }}
                                                onBlur={(e) => {
                                                     const val = parseTimestamp(e.target.value);
                                                     if (!isNaN(val)) updateWord(idx, wIdx, { startTime: val });
                                                }}
                                            />
                                            <input 
                                                className="flex-1 bg-transparent border-b border-transparent focus:border-border outline-none px-1 text-text"
                                                value={word.text}
                                                onChange={(e) => updateWord(idx, wIdx, { text: e.target.value })}
                                            />
                                            <button 
                                                onClick={() => updateWord(idx, wIdx, { isBackground: !word.isBackground })}
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${word.isBackground ? 'bg-accent-secondary/20 text-accent-secondary' : 'text-muted hover:bg-surface'}`}
                                            >
                                                BG
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        })}
        <div className="h-24 flex items-center justify-center text-muted text-xs border-2 border-dashed border-border rounded-lg m-2 hover:border-accent-primary hover:text-accent-primary hover:bg-card cursor-pointer transition-colors" onClick={() => addLine(doc.lines.length - 1)}>
            <Plus size={16} className="mr-2" /> Add Line (Ctrl+Enter)
        </div>
      </div>
    </div>
  );
};

export default LyricsEditor;