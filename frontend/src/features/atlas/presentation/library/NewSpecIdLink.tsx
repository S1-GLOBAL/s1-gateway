import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

/** The library's one primary action: a link that looks like the primary button. */
export function NewSpecIdLink() {
  return (
    <Link
      to="/atlas/new"
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-medium whitespace-nowrap text-on-accent shadow-sm transition-colors duration-150 ease-standard hover:bg-accent-hover"
    >
      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
      New Spec ID
    </Link>
  );
}
