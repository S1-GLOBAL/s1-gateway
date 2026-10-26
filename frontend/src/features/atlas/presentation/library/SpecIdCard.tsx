import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SavedSpecId } from '../../domain/atlas';
import { SpecIdSummary } from './SpecIdSummary';

/**
 * A Spec ID card that opens its manufacturers. The copy control sits beside the
 * code, outside the link, so copying does not navigate.
 */
export function SpecIdCard({ saved, timeZone }: { saved: SavedSpecId; timeZone?: string }) {
  const [hovers, setHovers] = useState(0);
  return (
    <div
      className="relative rounded-surface border border-border bg-surface p-5 shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised"
      onMouseEnter={() => setHovers((n) => n + 1)}
      onClick={(event) => {
        // The stage row sits above the link so its tip can show. A click there still opens the card.
        if (!(event.target instanceof Element)) return;
        if (!event.target.closest('[aria-label="Manufacturer stages"]')) return;
        const link = event.currentTarget.querySelector(':scope > a');
        if (!(link instanceof HTMLAnchorElement) || link.contains(event.target)) return;
        link.click();
      }}
    >
      <Link
        to={`/atlas/${saved.id}/manufacturers`}
        aria-labelledby={`spec-${saved.id}-name`}
        className="absolute inset-0 rounded-surface"
      />
      <div className="pointer-events-none relative">
        <SpecIdSummary saved={saved} timeZone={timeZone} hovers={hovers} />
      </div>
    </div>
  );
}
