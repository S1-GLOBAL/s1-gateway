import { useState, type ReactNode } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { CheckIcon, PlusIcon, ToolsIcon } from '@/shared/ui/icons';
import { Pagination } from '@/shared/ui/Pagination';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SelectField } from '@/shared/ui/SelectField';
import { TextAreaField } from '@/shared/ui/TextAreaField';
import { TextField } from '@/shared/ui/TextField';
import { ShowcaseSection } from '../ShowcaseSection';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function ControlsSection() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  return (
    <ShowcaseSection
      index={4}
      title="Controls"
      description="One primary action per screen, in lime. Hover a button with an icon to see it play."
    >
      <div className="flex flex-col gap-8 rounded-surface border border-border bg-surface p-6">
        <Row label="Buttons">
          <Button>
            <PlusIcon size={16} />
            Add tool
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Remove</Button>
        </Row>
        <Row label="States and sizes">
          <Button size="sm">
            <CheckIcon size={14} />
            Small
          </Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Name" placeholder="Payroll" hint="As staff will see it in the list." />
          <TextField label="URL" defaultValue="payroll" errors={['URL must be a full http:// or https:// address.']} />
          <SelectField
            label="Shape"
            defaultValue=""
            options={[
              { value: '', label: 'Not known' },
              { value: 'RD', label: 'RD — Round' },
            ]}
          />
          <SelectField label="Gusset" disabled options={[{ value: 'X', label: "Doesn't apply" }]} />
          <TextAreaField label="Search words" defaultValue={'invented fibre\ncane pulp'} hint="One per line." />
          <TextAreaField label="Notes" rows={2} errors={['Keep it to 500 characters.']} />
        </div>
        <Row label="Badges">
          <Badge>Neutral</Badge>
          <Badge tone="accent">New</Badge>
          <Badge tone="success">Healthy</Badge>
          <Badge tone="warning">Degraded</Badge>
          <Badge tone="danger">Down</Badge>
          <Badge tone="info">Maintenance</Badge>
        </Row>
        <Row label="Segmented control">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: 'Grid', icon: <ToolsIcon size={14} /> },
              { value: 'list', label: 'List' },
            ]}
          />
        </Row>
        <Row label="Pages">
          <Pagination page={page} pageCount={8} onPageChange={setPage} />
        </Row>
      </div>
    </ShowcaseSection>
  );
}
