
import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
      if (!voice || definedVoices.length <= 1) return 'text-left max-w-4xl mx-auto'; 
      
      const idx = definedVoices.indexOf(voice);
      if (idx === -1) return 'text-center max-w-4xl mx-auto'; 
      
      return idx % 2 === 0 
        ? 'text-left mr-auto max-w-[85%] pl-4 md:pl-12' 
        : 'text-right ml-auto max-w-[85%] pr-4 md:pr-12';
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-background group/preview">
      {/* Solid background only - No gradients per request */}
      
      <div 
        ref={containerRef}
        className="relative h-full overflow-y-auto py-[45vh] scrollbar-hide space-y-10 z-10 px-6"
        style={{ scrollBehavior: 'smooth' }}
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
                ${isActive ? 'opacity-100 blur-0 my-8 scale-100' : 'blur-[1px] scale-95 opacity-50'}
              `}
            >
              <div 
                className={`
                   font-bold leading-tight tracking-tight transition-all duration-300 rounded-xl p-2
                   ${isLineBackground ? 'text-2xl md:text-3xl italic font-light' : 'text-3xl md:text-5xl lg:text-6xl'}
                   ${isActive ? 'text-text-primary' : 'text-muted cursor-pointer hover:text-text-primary hover:opacity-80'}
                   ${isActive && !isLineBackground ? 'pl-4 border-l-4 border-accent-primary' : ''}
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
                                        scale: isCurrentWord ? 1.05 : 1,
                                        opacity: isActive && !isPastWord && !isCurrentWord ? (isBgWord ? 0.4 : 0.6) : 1,
                                        color: isCurrentWord ? '#ffffff' : 'inherit'
                                    }}
                                    transition={{ duration: 0.1 }}
                                    className={`
                                        inline-block cursor-pointer
                                        ${isCurrentWord ? 'text-accent-500 font-extrabold' : 'text-inherit'}
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
