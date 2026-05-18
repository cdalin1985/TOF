import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import type { TocTheme } from '../../theme/themeTypes';

const OPTIONS: Array<{
  value: TocTheme;
  label: string;
  description: string;
  previewClass: string;
}> = [
  {
    value: 'classic',
    label: 'Current Classic',
    description: 'The existing live TOC look. Dark, matte, red-accented, and safe as the default fallback.',
    previewClass: 'toc-theme-preview toc-theme-preview--classic',
  },
  {
    value: 'neon-billiards',
    label: 'Neon Billiards',
    description: 'The alternate admin-demo style: teal glass panels, lime/cyan HUD glow, and billiards-corner accents.',
    previewClass: 'toc-theme-preview toc-theme-preview--neon',
  },
];

export function AdminThemeSwitcher() {
  const location = useLocation();
  const { profile } = useAuthStore();
  const {
    theme,
    globalTheme,
    previewTheme,
    setPreviewTheme,
    clearPreviewTheme,
    setGlobalThemeLocally,
  } = useTheme();

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canManage = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isAdminPage = location.pathname === '/admin';

  const statusText = useMemo(() => {
    if (message) return message;
    if (previewTheme) return `Previewing ${previewTheme} only on this device. Players still see ${globalTheme}.`;
    return `Global theme is ${globalTheme}.`;
  }, [globalTheme, message, previewTheme]);

  if (!canManage || !isAdminPage) return null;

  async function applyGlobally(nextTheme: TocTheme) {
    setSaving(true);
    setMessage('');

    try {
      const { data: row, error: readError } = await supabase
        .from('league_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (readError) throw readError;
      if (!row?.id) throw new Error('No league_settings row found.');

      const { error: updateError } = await supabase
        .from('league_settings')
        .update({ theme_name: nextTheme })
        .eq('id', row.id);

      if (updateError) throw updateError;

      setGlobalThemeLocally(nextTheme);
      clearPreviewTheme();
      setMessage(`Applied ${nextTheme} globally. Everyone will see it after refresh/reload.`);
    } catch (error) {
      console.error('[AdminThemeSwitcher] Failed to apply global theme', error);
      setMessage(error instanceof Error ? error.message : 'Failed to apply theme globally.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass-card toc-theme-admin-panel mx-4 mt-3">
      <div className="toc-theme-admin-panel__header">
        <div>
          <div className="toc-theme-admin-panel__title">Visual Theme</div>
          <p className="toc-theme-admin-panel__subtitle">
            Switch the full app between the current style and the Neon Billiards admin-demo style.
          </p>
        </div>
      </div>

      <div className="toc-theme-grid">
        {OPTIONS.map((option) => {
          const isCurrent = theme === option.value;
          const isGlobal = globalTheme === option.value;
          const isPreview = previewTheme === option.value;

          return (
            <article key={option.value} className={`toc-theme-tile ${isCurrent ? 'is-active' : ''}`}>
              <div className={option.previewClass} />

              <div>
                <div className="toc-theme-tile__name">{option.label}</div>
                <p className="toc-theme-tile__description">{option.description}</p>
              </div>

              <div className="toc-theme-badge-row">
                {isCurrent && <span className="toc-theme-badge is-preview">ACTIVE NOW</span>}
                {isGlobal && <span className="toc-theme-badge is-live">GLOBAL</span>}
                {isPreview && <span className="toc-theme-badge is-preview">LOCAL PREVIEW</span>}
              </div>

              <div className="toc-theme-actions">
                <button
                  type="button"
                  className="toc-theme-button"
                  disabled={saving}
                  onClick={() => {
                    setPreviewTheme(option.value);
                    setMessage(`Previewing ${option.value} only on this device.`);
                  }}
                >
                  Preview for me
                </button>

                <button
                  type="button"
                  className="toc-theme-button toc-theme-button--primary"
                  disabled={saving}
                  onClick={() => applyGlobally(option.value)}
                >
                  {saving ? 'Saving…' : 'Apply globally'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="toc-theme-button"
          disabled={saving || !previewTheme}
          onClick={() => {
            clearPreviewTheme();
            setMessage('Preview ended. You are back to the global style.');
          }}
        >
          End preview
        </button>

        <button
          type="button"
          className="toc-theme-button toc-theme-button--danger"
          disabled={saving}
          onClick={() => applyGlobally('classic')}
        >
          Revert globally to Classic
        </button>
      </div>

      <p className="toc-theme-admin-panel__status mt-3">{statusText}</p>
    </section>
  );
}
