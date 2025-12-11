
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TimedLine } from '../types';

interface LyricsPreviewProps {
  lines: TimedLine[];
  currentTime: number;
  onLineClick: (time: number) => void;
  autoScroll: boolean;
  isPlaying: boolean;
  onTogglePlay?: () => void;
  definedVoices: string[];
}

const LyricsPreview: React.FC<LyricsPreviewProps> = ({ 
  lines, 
  currentTime, 
  onLineClick, 
  autoScroll, 
  isPlaying,
  onTogglePlay,
  definedVoices
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const activeLineIndex = lines.findIndex((line, i) => {
    const nextLine = lines[i + 1];
    return currentTime >= line.startTime && (!nextLine || currentTime < nextLine.startTime);
  });

  useEffect(() => {
    if (autoScroll && activeLineIndex !== -1 && containerRef.current) {
      const activeEl = containerRef.current.children[activeLineIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, autoScroll]);

  const getAlignmentClass = (voice?: string) => {
      if (!voice || definedVoices.length <= 1) return 'text-left max-w-4xl mx-auto'; // Standard center-ish
      
      const idx = definedVoices.indexOf(voice);
      if (idx === -1) return 'text-center max-w-4xl mx-auto'; // Fallback
      
      // Even index = Left (V1, V3...), Odd index = Right (V2, V4...)
      return idx % 2 === 0 
        ? 'text-left mr-auto max-w-[85%] pl-4 md:pl-12' 
        : 'text-right ml-auto max-w-[85%] pr-4 md:pr-12';
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-background group/preview">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-surface to-background z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_70%)] z-0" />

      {/* Scroller */}
      <div 
        ref={containerRef}
        className="relative h-full overflow-y-auto py-[45vh] scrollbar-hide space-y-12 z-10"
        style={{ scrollBehavior: 'smooth', contentVisibility: 'auto' }}
      >
        {lines.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted gap-4 pointer-events-none">
             <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center">
                 <span className="text-2xl">🎵</span>
             </div>
             <p className="font-medium">No lyrics to display</p>
          </div>
        )}
        
        {lines.map((line, index) => {
          const isActive = index === activeLineIndex;
          const isPast = index < activeLineIndex;
          const isLineBackground = line.isBackground;
          const alignClass = getAlignmentClass(line.voice);

          return (
            <div 
              key={line.id}
              className={`
                transition-all duration-500 ease-out
                ${alignClass}
                ${isActive ? 'opacity-100 blur-0 my-8 scale-100' : 'blur-[1px] scale-95'}
                ${isPast ? 'opacity-40' : isActive ? '' : 'opacity-20'}
              `}
            >
              <div 
                className={`
                   font-bold leading-tight tracking-tight transition-colors duration-300
                   ${isLineBackground ? 'text-2xl md:text-3xl italic font-light' : 'text-3xl md:text-5xl lg:text-6xl'}
                   ${isActive ? 'text-white' : 'text-zinc-300 cursor-pointer hover:text-white hover:opacity-80'}
                `}
                onClick={() => !isActive && onLineClick(line.startTime)}
              >
                {/* Word Renderer */}
                {line.words.length > 0 ? (
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1" style={{ justifyContent: alignClass.includes('right') ? 'flex-end' : 'flex-start' }}>
                        {line.words.map((word, wIdx) => {
                            const nextWord = line.words[wIdx + 1];
                            const effEnd = word.endTime || (nextWord ? nextWord.startTime : (line.endTime || line.startTime + 2));
                            const isCurrentWord = currentTime >= word.startTime && currentTime < effEnd;
                            const isPastWord = currentTime >= effEnd;
                            const isBgWord = word.isBackground;

                            return (
                                <motion.span 
                                    key={word.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onLineClick(word.startTime);
                                    }}
                                    animate={{
                                        scale: isCurrentWord ? 1.1 : 1,
                                        opacity: isActive && !isPastWord && !isCurrentWord ? (isBgWord ? 0.4 : 0.6) : 1,
                                        textShadow: isCurrentWord ? "0 0 15px rgba(139,92,246,0.6)" : "0 0 0px rgba(0,0,0,0)",
                                        color: isCurrentWord ? '#ffffff' : 'inherit'
                                    }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    className={`
                                        inline-block cursor-pointer
                                        ${isCurrentWord ? 'text-accent-500 font-extrabold' : 'text-white'}
                                        ${!isActive && !isPastWord ? 'text-inherit' : ''}
                                        ${isBgWord ? 'text-[0.65em] italic font-medium opacity-80' : ''}
                                    `}
                                >
                                    {isBgWord && '('}{word.text}{isBgWord && ')'}
                                </motion.span>
                            );
                        })}
                    </span>
                ) : (
                    <span className="whitespace-pre-wrap break-words">{line.rawText || "..."}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LyricsPreview;
