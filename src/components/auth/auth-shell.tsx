import type { ReactNode } from 'react';

/** Centred card used by every authentication page. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="shell flex min-h-[70vh] items-center justify-center py-10">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl">{title}</h1>
        {subtitle !== undefined && (
          <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
