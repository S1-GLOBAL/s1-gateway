import type { SlotKey } from '../domain/atlas';

export interface DecodedSlotRow {
  number: number;
  key: SlotKey;
  name: string;
  /** The slot's characters, as they appear in the code. */
  raw: string;
  /** Empty for a code the server refused. */
  meaning: string;
  /** The server's messages about this slot, shown in its Meaning cell. */
  messages?: readonly string[] | undefined;
}

/** A Spec ID's 25 slots, one row each. Scrolls sideways inside itself, never the page. */
export function DecodedSlotsTable({ rows }: { rows: readonly DecodedSlotRow[] }) {
  return (
    <div className="overflow-x-auto rounded-surface border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            <th scope="col" className="px-4 py-2.5 font-medium">
              #
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Slot
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Value
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Meaning
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border align-top last:border-b-0">
              <td className="px-4 py-2.5 font-mono text-ink-subtle">{row.number}</td>
              <th scope="row" className="px-4 py-2.5 font-medium whitespace-nowrap text-ink">
                {row.name}
              </th>
              <td className="px-4 py-2.5 font-mono whitespace-nowrap text-ink">{row.raw}</td>
              <td className="px-4 py-2.5 text-ink-muted">
                {row.meaning}
                {row.messages?.map((message) => (
                  <p key={message} role="alert" className="text-xs text-danger">
                    {message}
                  </p>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
