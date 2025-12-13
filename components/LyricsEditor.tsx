
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricsDocument, TimedLine, TimedWord } from '../types';
import { generateId, parseTimestamp, formatTimestamp, shiftTimestamps, shiftLine, detectAudioSilence } from '../utils/lyrics';
import { Trash2, Plus, ChevronUp, ChevronDown, Split, PlayCircle, X, UserCog, Users, Minus, Clock, Timer, Sparkles, ChevronRight } from 'lucide-react';

interface LyricsEditorProps {
  doc: LyricsDocument;
  onUpdate: (doc: LyricsDocument, addToHistory?: boolean) => void;
  onSeek: (time: number) => void;
  currentTime: number;
  definedVoices: string[];
  setDefinedVoices: (voices: string[]) => void;
  audioSrc: string | null;
}

const LyricsEditor: React.FC<LyricsEditorProps> = ({ doc, onUpdate, onSeek, currentTime, definedVoices, setDefinedVoices, audioSrc }) => {
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [globalWordMode, setGlobalWordMode] = useState(false);
  const [showVoiceManager, setShowVoiceManager] = useState(false);
  const [voiceEditMode, setVoiceEditMode] = useState(false);
  
  // Advanced Tools State
  const [showTimingTools, setShowTimingTools] = useState(false);
  const [shiftOffset, setShiftOffset] = useState<string>('0');
  const [shiftFeedback, setShiftFeedback] = useState<string | null>(null);
  const [lineSyncMode, setLineSyncMode] = useState(false);
  const [detectedSilence, setDetectedSilence] = useState<number | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Initialize voices from doc if empty
  useEffect(() => {
      if (definedVoices.length === 0) {
          const unique = Array.from(new Set(doc.lines.map(l => l.voice).filter(Boolean))) as string[];
          if (unique.length > 0) setDefinedVoices(unique);
          else setDefinedVoices(['v1', 'v2']);
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

  const syncLineToCurrent = (line: TimedLine) => {
      const newLine = shiftLine(line, currentTime);
      updateLine(line.id, newLine, true);
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

  const handleBatchShift = (direction: 1 | -1) => {
      // Use parseTimestamp which handles seconds (1.5) and time format (00:01.5)
      const val = parseTimestamp(shiftOffset);
      
      // Safety check: Don't shift if 0 (unless user intended 0, but that does nothing)
      if (val === 0 && shiftOffset !== '0' && shiftOffset !== '0.0') {
           // could add error handling if parsing failed, but parseTimestamp returns 0
      }
      
      const seconds = val * direction;
      const newDoc = shiftTimestamps(doc, seconds);
      onUpdate(newDoc, true);
      
      const sign = direction === 1 ? '+' : '-';
      setShiftFeedback(`Shifted all by ${sign}${formatTimestamp(val, 3)}`);
      setTimeout(() => setShiftFeedback(null), 2000);
  };

  const handleSilenceDetection = async () => {
      if (!audioSrc) return;
      setIsDetecting(true);
      const time = await detectAudioSilence(audioSrc);
      setIsDetecting(false);
      setDetectedSilence(time);
  };

  const applySilenceToFirst = () => {
      if (detectedSilence !== null && doc.lines.length > 0) {
          const firstLine = doc.lines[0];
          const newLine = shiftLine(firstLine, detectedSilence);
          updateLine(firstLine.id, newLine, true);
          setDetectedSilence(null);
      }
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

  const setVoiceCount = (count: number) => {
      if (count < 1) return;
      const current = [...definedVoices];
      if (count > current.length) {
          for (let i = current.length; i < count; i++) {
               let nextNum = i + 1;
               while (current.includes(`v${nextNum}`)) nextNum++;
               current.push(`v${nextNum}`);
          }
      } else {
          current.length = count;
      }
      setDefinedVoices(current);
  };

  const cycleVoice = (lineId: string, currentVoice?: string) => {
      if (definedVoices.length === 0) {
          setDefinedVoices(['v1', 'v2']);
          updateLine(lineId, { voice: 'v1' });
          return;
      }
      
      const currentIndex = currentVoice ? definedVoices.indexOf(currentVoice) : -1;
      let nextVoice = definedVoices[0];
      
      if (currentIndex !== -1) {
          nextVoice = definedVoices[(currentIndex + 1) % definedVoices.length];
      }
      
      updateLine(lineId, { voice: nextVoice });
  };

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      {/* Header Tools */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface sticky top-0 z-20">
        <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-text hidden sm:block">Editor</span>
            
            {/* Timing Tools Toggle */}
            <button 
                onClick={() => setShowTimingTools(!showTimingTools)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${showTimingTools ? 'bg-accent-primary text-white' : 'text-muted hover:text-text'}`}
                title="Timing Tools"
            >
                <Clock size={14} />
            </button>
            
            {/* Line Sync Toggle */}
             <button 
                onClick={() => setLineSyncMode(!lineSyncMode)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${lineSyncMode ? 'bg-accent-secondary text-white' : 'text-muted hover:text-text'}`}
                title="Line Sync Mode (Click to set time)"
            >
                <Timer size={14} />
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Voice Toggle */}
            <button 
                onClick={() => setShowVoiceManager(!showVoiceManager)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${showVoiceManager ? 'bg-accent-primary text-white' : 'text-muted hover:text-text'}`}
                title="Manage Project Voices"
            >
                <Users size={14} />
            </button>
        </div>
        
        {/* Right Actions */}
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setVoiceEditMode(!voiceEditMode)}
                className={`hidden md:flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${voiceEditMode ? 'bg-accent-primary text-white' : 'text-muted hover:text-text'}`}
                title="Toggle Voice Assignment Buttons"
            >
                <UserCog size={14} />
            </button>
            <button 
                onClick={() => setGlobalWordMode(!globalWordMode)}
                className={`flex items-center gap-2 text-xs px-2 py-1 rounded transition-colors ${globalWordMode ? 'bg-accent-primary text-white' : 'text-muted hover:text-text'}`}
                title="Toggle Word Mode (Ctrl+M)"
            >
                <Split size={14} />
            </button>
        </div>
      </div>

      {/* Expandable Panels Container */}
      <div className="bg-background border-b border-border">
        <AnimatePresence>
            {/* Timing Tools Panel */}
            {showTimingTools && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-card">
                    <div className="p-4 space-y-4">
                        {/* Batch Shift */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-muted uppercase">Batch Shift Timestamps</label>
                                {shiftFeedback && <span className="text-xs text-accent-secondary animate-pulse">{shiftFeedback}</span>}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={shiftOffset} 
                                    onChange={(e) => setShiftOffset(e.target.value)}
                                    className="bg-surface border border-border rounded px-3 py-1 text-sm text-text w-full focus:border-accent-primary outline-none"
                                    placeholder="Seconds (1.5) or Time (00:01.5)"
                                />
                                <button onClick={() => handleBatchShift(-1)} className="whitespace-nowrap bg-surface hover:bg-border border border-border rounded px-3 py-1 text-xs font-bold transition-colors">Shift Earlier</button>
                                <button onClick={() => handleBatchShift(1)} className="whitespace-nowrap bg-surface hover:bg-border border border-border rounded px-3 py-1 text-xs font-bold transition-colors">Shift Later</button>
                            </div>
                        </div>

                        {/* Silence Detection */}
                        <div className="border-t border-border pt-3">
                            <label className="text-xs font-bold text-muted uppercase mb-2 block">Silence Detection</label>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handleSilenceDetection}
                                    disabled={!audioSrc || isDetecting}
                                    className="flex items-center gap-2 bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 px-3 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                    {isDetecting ? <span className="animate-spin">⏳</span> : <Sparkles size={14} />}
                                    Detect Intro
                                </button>
                                {detectedSilence !== null ? (
                                    <div className="flex items-center gap-2 flex-1 justify-end">
                                        <span className="text-xs text-text font-mono">Suggested: {formatTimestamp(detectedSilence, 2)}</span>
                                        <button onClick={applySilenceToFirst} className="text-xs bg-success/20 text-success hover:bg-success/30 px-2 py-1 rounded font-bold">Apply</button>
                                    </div>
                                ) : (
                                    !audioSrc && <span className="text-[10px] text-muted italic">No audio loaded</span>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Voice Manager Panel */}
            {showVoiceManager && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-card border-t border-border">
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-text">Voice Configuration</span>
                            <span className="text-[10px] text-muted">Auto-generated IDs</span>
                        </div>
                        <div className="flex items-center gap-3 bg-surface p-1 rounded-lg border border-border">
                            <button onClick={() => setVoiceCount(definedVoices.length - 1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-card hover:text-accent-primary disabled:opacity-30 transition-colors" disabled={definedVoices.length <= 1}><Minus size={16} /></button>
                            <span className="text-lg font-bold text-text w-6 text-center">{definedVoices.length}</span>
                            <button onClick={() => setVoiceCount(definedVoices.length + 1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-card hover:text-accent-primary transition-colors"><Plus size={16} /></button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {doc.lines.map((line, idx) => {
            const isActive = currentTime >= line.startTime && (!doc.lines[idx+1] || currentTime < doc.lines[idx+1].startTime);
            const showWords = globalWordMode || expandedLineId === line.id;
            const showTools = isActive || line.voice || line.isBackground || voiceEditMode;

            return (
                <div 
                    key={line.id} 
                    className={`
                        rounded-lg border transition-all duration-200 group relative
                        ${isActive ? 'border-accent-primary bg-card shadow-sm' : 'border-border bg-surface hover:border-border/80'}
                    `}
                >
                    {/* Line Sync Overlay */}
                    {lineSyncMode && (
                        <div className="absolute right-2 top-2 z-10">
                            <button 
                                onClick={() => syncLineToCurrent(line)}
                                className="flex items-center gap-1 bg-accent-secondary text-white text-[10px] font-bold px-2 py-1 rounded shadow hover:bg-emerald-600 transition-colors"
                            >
                                <Timer size={12}/> Set: {formatTimestamp(currentTime, 2)}
                            </button>
                        </div>
                    )}

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
                        <div className="flex-1 min-w-0 pt-0.5">
                             <div className="relative">
                                <textarea
                                    className={`
                                        w-full bg-transparent resize-none outline-none text-sm font-medium leading-relaxed break-words
                                        ${isActive ? 'text-text' : 'text-text/90'}
                                    `}
                                    rows={1}
                                    value={line.rawText}
                                    onChange={(e) => updateLine(line.id, { rawText: e.target.value, words: e.target.value.split(/\s+/).filter(Boolean).map((w,i) => line.words[i] ? {...line.words[i], text:w} : {id:generateId(), text:w, startTime: line.startTime, isBackground: line.isBackground}) }, false)}
                                    onBlur={() => updateLine(line.id, {}, true)} 
                                    onKeyDown={(e) => { handleLineKeyDown(e, line.id, idx); handleEnterKey(e, idx); }}
                                    style={{ minHeight: '1.5rem', height: 'auto' }}
                                    onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                                />
                                
                                {/* Tools Row */}
                                {showTools && (
                                    <div className="flex flex-wrap gap-1 mt-1 min-h-[20px] items-center">
                                        {voiceEditMode ? (
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
                                            <button 
                                                onClick={() => cycleVoice(line.id, line.voice)}
                                                className={`
                                                    px-1.5 py-0.5 text-[10px] rounded border font-bold transition-colors
                                                    ${line.voice 
                                                        ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/20' 
                                                        : 'text-muted border-dashed border-border hover:bg-surface hover:text-text'
                                                    }
                                                `}
                                            >
                                                {line.voice || "+ Voice"}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => {
                                                const newBg = !line.isBackground;
                                                updateLine(line.id, { 
                                                    isBackground: newBg,
                                                    words: line.words.map(w => ({ ...w, isBackground: newBg }))
                                                });
                                            }}
                                            className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${line.isBackground ? 'bg-accent-secondary/20 text-accent-secondary border-accent-secondary/20' : 'bg-background border-border text-muted hover:text-text'}`}
                                        >
                                            BG
                                        </button>
                                    </div>
                                )}
                             </div>
                        </div>

                        {/* Actions */}
                        <div className={`flex flex-col gap-1 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
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
