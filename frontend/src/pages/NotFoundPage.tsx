import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="font-mono text-sm text-ink-subtle">404</p>
      <h1 className="text-2xl font-semibold text-ink">There is nothing at this address.</h1>
      <p className="text-base text-ink-muted">
        It may have moved. Everything the Gateway has is in the sidebar, or go to{' '}
        <Link to="/theme" className="font-medium text-accent-ink underline-offset-4 hover:underline">
          Theme
        </Link>
        .
      </p>
    </div>
  );
}
