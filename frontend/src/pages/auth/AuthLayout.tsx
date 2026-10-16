import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/Card';
import { Logo } from '@/shared/ui/Logo';

export interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Links under the card: the other places a signed-out person might mean to go. */
  footer?: ReactNode;
}

/** The bare frame of every signed-out page: the canvas, the logo, one card. No shell. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas px-4 py-12">
      <span className="text-ink">
        <Logo variant="wordmark" height={28} />
      </span>
      <Card className="flex w-full max-w-sm flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          {description && <p className="text-base text-ink-muted">{description}</p>}
        </div>
        {children}
      </Card>
      {footer && <p className="text-sm text-ink-muted">{footer}</p>}
    </main>
  );
}

/** The class of a link in running text on these pages. */
export const AUTH_LINK = 'font-medium text-accent-ink underline-offset-4 hover:underline';