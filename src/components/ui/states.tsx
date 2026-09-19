import Link from 'next/link';
import type { ReactNode } from 'react';

/** Neutral empty state. Used for "no results", "no listings yet", and similar. */
export function EmptyState({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text?: string;
  action?: { href: string; label: string };
  icon?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon !== undefined && <div className="text-ink-faint">{icon}</div>}
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {text !== undefined && (
        <p className="max-w-md text-sm text-ink-muted">{text}</p>
      )}
      {action !== undefined && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Error state. It deliberately accepts only translated copy — a raw backend
 * message must never reach this component.
 */
export function ErrorState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: { href: string; label: string };
}) {
  return (
    <div
      role="alert"
      className="card flex flex-col items-center gap-3 border-brand/40 px-6 py-14 text-center"
    >
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="max-w-md text-sm text-ink-muted">{text}</p>
      {action !== undefined && (
        <Link href={action.href} className="btn-ghost mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow !== undefined && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-2xl sm:text-3xl">{title}</h2>
        {subtitle !== undefined && (
          <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
