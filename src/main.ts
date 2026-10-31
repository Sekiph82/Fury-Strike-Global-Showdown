import './styles.css';

import { createApp } from './shell/appShell';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root');
}

createApp(root);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Offline game shell could not be registered.', error);
    });
  });
}
