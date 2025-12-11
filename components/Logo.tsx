
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 32 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Container Background */}
      <rect width="200" height="200" rx="50" fill="#6366f1" />
      
      {/* Decorative Gradient Overlay */}
      <rect width="200" height="200" rx="50" fill="url(#shine)" fillOpacity="0.2" />
      
      {/* Lyric Lines */}
      {/* Top Line (Inactive) */}
      <rect x="40" y="65" width="80" height="16" rx="8" fill="white" fillOpacity="0.4" />
      
      {/* Middle Line (Active/Sync) */}
      <rect x="40" y="100" width="60" height="16" rx="8" fill="white" />
      {/* Music Note Head integrated into the line */}
      <circle cx="120" cy="108" r="18" fill="white" />
      {/* Music Note Stem & Flag */}
      <path 
        d="M132 108 V55 C132 55 152 55 160 75" 
        stroke="white" 
        strokeWidth="12" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Bottom Line (Inactive) */}
      <rect x="40" y="145" width="100" height="16" rx="8" fill="white" fillOpacity="0.4" />

      {/* Defs for gradients */}
      <defs>
        <linearGradient id="shine" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.5"/>
          <stop offset="1" stopColor="white" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  );
};
