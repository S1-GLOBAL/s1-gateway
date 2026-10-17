import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/** The way back to the library, above a Spec ID's header. */
export function BackToAtlas() {
  return (
    <Link
      to="/atlas"
      className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-muted transition-colors duration-150 ease-standard hover:text-ink"
    >
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      Atlas
    </Link>
  );
}
