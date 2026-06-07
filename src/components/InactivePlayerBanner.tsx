import React from 'react';

interface InactivePlayerBannerProps {
  playerName?: string;
}

export const InactivePlayerBanner: React.FC<InactivePlayerBannerProps> = ({ playerName }) => {
  return (
    <div
      style={{
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.45)',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
      }}
    >
      <span style={{ fontSize: '20px' }}>⚠️</span>
      <div>
        <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '14px', letterSpacing: '0.5px' }}>
          PLAYER INACTIVE
        </div>
        <div style={{ color: '#ccc', fontSize: '13px', marginTop: '2px' }}>
          {playerName ? `${playerName} is` : 'This player is'} currently inactive and cannot be challenged.
        </div>
      </div>
    </div>
  );
};
