import type { ReactNode } from 'react';

import './globals.css';

/**
 * The real document shell lives in src/app/[locale]/layout.tsx, because only
 * that segment knows which language to put on <html lang>. This root layout
 * exists to satisfy the App Router and does nothing else.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
