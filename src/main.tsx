import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './theme/themes.css';
import App from './App';
import { ThemeProvider } from './theme/ThemeProvider';

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
