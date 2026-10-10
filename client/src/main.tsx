import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/providers/AuthProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { App } from '@/App';
import '@/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

/**
 * Installable app + offline shell. Registered in production only: in dev the
 * worker would cache Vite's module graph and fight hot reload.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      // A deployed update should not wait for every tab to close.
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', (event) => {
          const worker = event.target as ServiceWorker;
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage('SKIP_WAITING');
          }
        });
      });
    });
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster
                position="top-center"
                offset={16}
                toastOptions={{
                  className:
                    'rounded-[var(--radius-control)] border border-border bg-surface-raised text-text shadow-[var(--shadow-raised)]',
                }}
              />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
