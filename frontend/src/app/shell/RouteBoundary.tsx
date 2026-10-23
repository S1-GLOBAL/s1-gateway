import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { AppError } from '@/shared/application/app-error';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { ErrorState } from '@/shared/ui/ErrorState';
import { useDoorHold } from './door-hold';

/**
 * Wraps one route: its skeleton while its code or data loads, and a calm
 * error with Try again if either fails (ADR 0013).
 */
export function RouteBoundary({ skeleton, children }: { skeleton: ReactNode; children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallback={(error, retry) => <PageFailed error={error} onRetry={retry} />}
        >
          <Suspense fallback={skeleton}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

/** A chunk that failed still has to let the curtain clear onto this sentence. */
function PageFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  useDoorHold(false);
  return (
    <ErrorState
      title="This page could not load."
      message={
        error instanceof AppError ? error.message : 'Something went wrong while loading it. Try again in a moment.'
      }
      onRetry={onRetry}
    />
  );
}
