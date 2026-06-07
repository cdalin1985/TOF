import React from 'react';

const COLORS = ['#16A34A','#1565C0','#2E7D32','#F57F17','#6A1B9A','#00695C','#AD1457','#E65100','#4527A0','#00838F'];

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Simple emoji detection: single grapheme cluster that is an emoji
function isEmoji(str: string): boolean {
  return str.length <= 4 && /\p{Emoji}/u.test(str);
}

interface AvatarProps {
  player: { full_name: string; avatar_url?: string | null };
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ player, size = 44, className = '' }) => {
  const { full_name, avatar_url } = player;
  const color    = nameToColor(full_name);
  const initials = getInitials(full_name);
  const fontSize = size * 0.36;

  // Photo URL
  if (avatar_url && (avatar_url.startsWith('http') || avatar_url.startsWith('/'))) {
    return (
      <img
        src={avatar_url}
        alt={full_name}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Premade emoji icon
  if (avatar_url && isEmoji(avatar_url)) {
    return (
      <div
        className={`rounded-full flex items-center justify-center shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: `${color}22`,
          border: `2px solid ${color}44`,
          fontSize: size * 0.52,
          lineHeight: 1,
        }}
      >
        {avatar_url}
      </div>
    );
  }

  // Initials fallback
  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 font-[Barlow] font-bold ${className}`}
      style={{
        width: size,
        height: size,
        background: `${color}22`,
        border: `2px solid ${color}55`,
        color,
        fontSize,
      }}
    >
      {initials}
    </div>
  );
};
