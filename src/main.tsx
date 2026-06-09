import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './theme/themes.css';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { THEME_STORAGE_KEY } from './theme/themeTypes';
import { isLocalDemoHost } from './demo/topOfTheFallsDemo';

if (isLocalDemoHost() && new URLSearchParams(window.location.search).get('demo') === 'totf') {
  window.localStorage.setItem(THEME_STORAGE_KEY, 'emerald-forest');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
