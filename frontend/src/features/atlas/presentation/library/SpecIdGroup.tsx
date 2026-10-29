import type { SavedSpecId } from '../../domain/atlas';
import { SpecIdCard } from './SpecIdCard';

/** A titled list of saved Spec IDs, one card each: those that fit some facts, or might. */
export function SpecIdGroup({ title, items, timeZone }: { title: string; items: SavedSpecId[]; timeZone?: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((saved) => (
          <li key={saved.id}>
            <SpecIdCard saved={saved} timeZone={timeZone} />
          </li>
        ))}
      </ul>
    </section>
  );
}
