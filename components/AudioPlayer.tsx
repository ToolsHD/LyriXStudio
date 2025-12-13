
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';
import { formatTimestamp } from '../utils/lyrics';
import { motion } from 'framer-motion';

interface AudioPlayerProps {
  src: string | null;
  isPlaying: boolean;
  onPlayPauseChange: (isPlaying: boolean) => void;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  currentTime: number;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
  src, 
  isPlaying, 
  onPlayPauseChange, 
  onTimeUpdate, 
  onDurationChange,
  currentTime 
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (audioRef.current && !audioRef.current.paused && !isDragging) {
        const t = audioRef.current.currentTime;
        setLocalTime(t);
        onTimeUpdate(t);
      }
      rafRef.current = requestAnimationFrame(update);
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(update);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, isDragging, onTimeUpdate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(e => {
        console.error("Play failed", e);
        onPlayPauseChange(false);
    });
    else audio.pause();
  }, [isPlaying, src, onPlayPauseChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && Math.abs(audio.currentTime - currentTime) > 0.05 && !isDragging) {
      audio.currentTime = currentTime;
      setLocalTime(currentTime);
    }
  }, [currentTime, isDragging]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      setDuration(d);
      onDurationChange(d);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLocalTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
    onTimeUpdate(val);
  };

  const toggleMute = () => {
      if (audioRef.current) {
          audioRef.current.muted = !isMuted;
          setIsMuted(!isMuted);
      }
  };

  const skip = (amount: number) => {
      if (audioRef.current) {
          audioRef.current.currentTime += amount;
          setLocalTime(audioRef.current.currentTime);
          onTimeUpdate(audioRef.current.currentTime);
      }
  };

  const progressPercent = duration > 0 ? (localTime / duration) * 100 : 0;

  return (
    <div className="w-full flex flex-col gap-2">
      <audio 
        ref={audioRef} 
        src={src || undefined} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => onPlayPauseChange(false)}
      />
      
      {/* Sleek Progress Bar */}
      <div className="flex items-center gap-3 group relative py-2">
        <span className="text-[10px] font-mono text-muted tabular-nums w-16 text-right">{formatTimestamp(localTime, 3)}</span>
        
        <div className="relative flex-1 h-1 bg-white/10 rounded-full cursor-pointer group-hover:h-1.5 transition-all">
            {/* Filled Track */}
            <motion.div 
                className="absolute left-0 top-0 bottom-0 bg-accent-500 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                style={{ width: `${progressPercent}%` }}
                transition={{ duration: 0 }}
            />
             {/* Thumb (only visible on hover/drag) */}
             <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `${progressPercent}%`, transform: `translate(-50%, -50%)` }}
             />
            {/* Input Overlay */}
            <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                step="0.001"
                value={isDragging ? localTime : (audioRef.current?.currentTime || 0)} 
                onChange={handleSeek}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                disabled={!src}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
        </div>
        
        <span className="text-[10px] font-mono text-muted tabular-nums w-16">{formatTimestamp(duration, 3)}</span>
      </div>

      {/* Minimal Controls */}
      <div className="flex items-center justify-center gap-8">
         <button className="text-muted hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 active:scale-95" onClick={() => skip(-10)} title="-10s">
             <RotateCcw size={18} />
         </button>
         
         <button 
            onClick={() => onPlayPauseChange(!isPlaying)}
            disabled={!src}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-white/5"
         >
            {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
         </button>

         <button className="text-muted hover:text-white transition-colors p-2 rounded-full hover:bg-white/5 active:scale-95" onClick={() => skip(10)} title="+10s">
             <RotateCw size={18} />
         </button>
         
         {/* Mute (Desktop) */}
         <button onClick={toggleMute} className="text-muted hover:text-white absolute right-0 hidden md:block">
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
         </button>
      </div>
    </div>
  );
};

export default AudioPlayer;
