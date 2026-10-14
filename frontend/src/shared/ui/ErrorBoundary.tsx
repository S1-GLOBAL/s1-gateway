import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Drawn in place of the children after a render error. `retry` clears it. */
  fallback(error: unknown, retry: () => void): ReactNode;
  /** Called before a retry, e.g. to reset failed queries. */
  onReset?(): void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

/** Catches a render error below it and draws `fallback` instead of a blank page. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Kept visible in the console for whoever is debugging; the user sees the fallback.
    console.error(error, info.componentStack);
  }

  retry = (): void => {
    this.props.onReset?.();
    this.setState({ failed: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback(this.state.error, this.retry);
    return this.props.children;
  }
}
