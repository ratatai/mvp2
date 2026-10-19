import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LocaleError from '@/app/[locale]/error';
import { getDictionary } from '@/i18n';

const pathname = vi.hoisted(() => ({ current: null as string | null }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}));

// The component is called as a plain function below, outside a React render,
// so the effect hook (dev-only console logging) is replaced by a no-op.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: () => undefined,
}));

type ErrorWithDigest = Error & { digest?: string };

function makeError(): ErrorWithDigest {
  return Object.assign(new Error('SECRET_DB_MESSAGE relation "listings"'), {
    digest: 'DIGEST_1234567890',
  });
}

function render(path: string | null, reset: () => void = () => undefined) {
  pathname.current = path;
  const tree = LocaleError({ error: makeError(), reset }) as ReactElement;
  return { tree, html: renderToStaticMarkup(tree) };
}

function findButton(node: ReactNode): ReactElement<{ onClick?: () => void }> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findButton(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === 'button') return node as ReactElement<{ onClick?: () => void }>;
  return findButton(node.props.children);
}

describe('[locale]/error.tsx', () => {
  beforeEach(() => {
    pathname.current = null;
  });

  it.each([
    ['/lt/skelbimai/padangos', 'lt'],
    ['/ru/skelbimai/ratlankiai', 'ru'],
    ['/en/skelbimas/some-slug', 'en'],
  ] as const)('renders %s in %s', (path, locale) => {
    const dict = getDictionary(locale);
    const { html } = render(path);

    expect(html).toContain(dict.errors.genericTitle);
    expect(html).toContain(dict.errors.genericText);
    expect(html).toContain(dict.common.retry);
  });

  it('does not show Lithuanian text on /ru or /en', () => {
    const lt = getDictionary('lt');
    expect(render('/ru').html).not.toContain(lt.errors.genericTitle);
    expect(render('/en').html).not.toContain(lt.errors.genericTitle);
  });

  it.each([null, '', '/', '/xx/page', '/RU/page', '/skelbimai/en'])(
    'falls back to Lithuanian for pathname %j',
    (path) => {
      const lt = getDictionary('lt');
      const { html } = render(path);

      expect(html).toContain(lt.errors.genericTitle);
      expect(html).toContain(lt.common.retry);
    }
  );

  it('never renders error.message or error.digest', () => {
    for (const path of ['/lt', '/ru', '/en', null]) {
      const { html } = render(path);
      expect(html).not.toContain('SECRET_DB_MESSAGE');
      expect(html).not.toContain('DIGEST_1234567890');
    }
  });

  it('calls reset when the retry button is clicked', () => {
    const reset = vi.fn();
    const { tree } = render('/en', reset);
    const button = findButton(tree);

    expect(button).not.toBeNull();
    button?.props.onClick?.();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
