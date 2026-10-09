import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type State = { error: Error | null };

/**
 * Last line of defence. A render crash in one screen should not leave the user
 * staring at a white page with no way out.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-lg font-semibold text-text">Something broke on this screen</h1>
          <p className="mt-2 text-sm text-text-muted">
            Your workout data is safe. Reloading usually fixes it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Reload the app</Button>
            <Button variant="ghost" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
          {import.meta.env.DEV ? (
            <pre className="mt-6 max-h-48 overflow-auto rounded-[var(--radius-control)] border border-border bg-surface-inset p-3 text-left text-xs text-text-muted">
              {error.stack ?? error.message}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
