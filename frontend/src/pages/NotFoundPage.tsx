import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">
        There is nothing at this address. <Link to="/" className="text-accent-ink hover:underline">Go to the hub</Link>.
      </p>
    </main>
  );
}
