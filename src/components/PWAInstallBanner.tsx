import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [prompt, setPrompt]       = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('toc-pwa-dismissed') === '1'
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('toc-pwa-dismissed', '1');
  };

  return (
    <AnimatePresence>
      {prompt && !dismissed && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="fixed top-0 left-0 right-0 z-[60] px-4 py-2.5"
          style={{
            background: 'rgba(13,13,13,0.97)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--toc-theme-border-strong)',
          }}
        >
          <div className="max-w-sm mx-auto flex items-center gap-3">
            <span className="text-xl shrink-0">🎱</span>
            <div className="flex-1 min-w-0">
              <div className="font-[Barlow] font-semibold text-[#E8E2D6] text-sm leading-tight">
                Add to Home Screen
              </div>
              <div className="text-[#9CA3AF] text-xs font-[Barlow]">
                Install for the best experience
              </div>
            </div>
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-[Barlow] font-semibold shrink-0 active:opacity-80"
              style={{ backgroundColor: 'var(--toc-theme-accent)' }}
            >
              <Download size={12} /> Install
            </button>
            <button onClick={handleDismiss} className="text-[#6B7280] p-1 shrink-0 -mr-1">
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
