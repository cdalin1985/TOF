import React, { useMemo } from 'react';

interface ParticleData {
  left: string;
  bottom: string;
  delay: string;
  duration: string;
  isCrimson: boolean;
}

const Particle: React.FC<{ data: ParticleData }> = ({ data }) => (
  <div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: '2px',
      height: '2px',
      left: data.left,
      bottom: data.bottom,
      background: data.isCrimson ? 'rgba(198,40,40,0.9)' : 'rgba(255,255,255,0.75)',
      opacity: 0,
      animationName: 'float-up',
      animationDuration: data.duration,
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
      animationDelay: data.delay,
    }}
  />
);

export const AmbientBackground: React.FC = () => {
  const particles = useMemo<ParticleData[]>(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: `${(i * 4.5 + 3) % 95}%`,
      bottom: `${(i * 6.5 + 5) % 50}%`,
      delay: `${(i * 0.38) % 7}s`,
      duration: `${4.5 + (i % 5) * 1.2}s`,
      isCrimson: i % 7 === 0,
    })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>

      {/* Pool felt diagonal texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)',
          pointerEvents: 'none',
        }}
      />

      {/* Radial vignette — deepens edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Crimson orb — top left */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: '-12%',
          width: '620px',
          height: '620px',
          background: 'radial-gradient(circle, rgba(198,40,40,0.13) 0%, transparent 65%)',
          filter: 'blur(90px)',
          animation: 'drift1 22s ease-in-out infinite',
        }}
      />

      {/* Gold orb — bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: '3%',
          right: '-10%',
          width: '520px',
          height: '520px',
          background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 65%)',
          filter: 'blur(90px)',
          animation: 'drift2 30s ease-in-out infinite',
        }}
      />

      {/* Secondary crimson — mid right */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          right: '5%',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(198,40,40,0.055) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'drift3 18s ease-in-out infinite',
        }}
      />

      {/* Floating dust particles */}
      {particles.map((p, i) => (
        <Particle key={i} data={p} />
      ))}
    </div>
  );
};
