import React from 'react';

interface EKGLineProps {
  className?: string;
  animated?: boolean;
}

export const EKGLine: React.FC<EKGLineProps> = ({ className = '', animated = true }) => (
  <svg
    viewBox="0 0 200 20"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-[120px] h-[12px] ${className}`}
    style={{ filter: 'drop-shadow(0 0 3px var(--toc-theme-accent))' }}
    aria-hidden
  >
    {animated && (
      <style>{`
        .ekg-line {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: ekg-draw 2s ease-in-out infinite;
        }
        @keyframes ekg-draw {
          0% { stroke-dashoffset: 300; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.6; }
        }
      `}</style>
    )}
    <polyline
      className={animated ? 'ekg-line' : ''}
      points="0,10 30,10 40,10 50,2 55,18 60,6 65,14 70,10 80,10 200,10"
      fill="none"
      stroke="var(--toc-theme-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={animated ? undefined : 0.6}
    />
  </svg>
);
