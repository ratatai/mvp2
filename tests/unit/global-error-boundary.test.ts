import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GlobalError from '@/app/global-error';
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
  const tree = GlobalError({ error: makeError(), reset }) as ReactElement;
  return { tree, html: renderToStaticMarkup(tree) };
}

function findElement<P>(node: ReactNode, type: string): ReactElement<P> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement<P>(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === type) return node as ReactElement<P>;
  return findElement<P>(node.props.children, type);
}

describe('global-error.tsx', () => {
  beforeEach(() => {
    pathname.current = null;
  });

  it('owns the document: returns <html> wrapping <body>', () => {
    const { tree, html } = render('/en');

    expect(tree.type).toBe('html');
    expect(findElement(tree, 'body')).not.toBeNull();
    expect(html.startsWith('<html')).toBe(true);
    expect(html).toContain('<body');
  });

  it.each([
    ['/lt/skelbimai/padangos', 'lt'],
    ['/ru/skelbimai/ratlankiai', 'ru'],
    ['/en/skelbimas/some-slug', 'en'],
    ['/en', 'en'],
  ] as const)('renders %s in %s', (path, locale) => {
    const dict = getDictionary(locale);
    const { tree, html } = render(path);

    expect((tree.props as { lang?: string }).lang).toBe(locale);
    expect(html).toContain(`<html lang="${locale}"`);
    expect(html).toContain(dict.errors.genericTitle);
    expect(html).toContain(dict.errors.genericText);
    expect(html).toContain(dict.common.retry);
    expect(html).toContain(dict.errors.goHome);
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

      expect(html).toContain('<html lang="lt"');
      expect(html).toContain(lt.errors.genericTitle);
      expect(html).toContain(lt.common.retry);
      expect(html).toContain('href="/lt"');
    }
  );

  it.each([
    ['/lt/x', '/lt'],
    ['/ru/x', '/ru'],
    ['/en/x', '/en'],
    [null, '/lt'],
  ] as const)('links home from %j to %s with a plain anchor', (path, href) => {
    const { tree } = render(path);
    const anchor = findElement<{ href?: string }>(tree, 'a');

    expect(anchor).not.toBeNull();
    expect(anchor?.props.href).toBe(href);
  });

  it('never renders error.message or error.digest', () => {
    for (const path of ['/lt', '/ru', '/en', null]) {
      const { html } = render(path);
      expect(html).not.toContain('SECRET_DB_MESSAGE');
      expect(html).not.toContain('DIGEST_1234567890');
    }
  });

  it('calls reset when the retry button is clicked', () => {
    const reset = vi.fn();
    const { tree } = render('/ru', reset);
    const button = findElement<{ onClick?: () => void }>(tree, 'button');

    expect(button).not.toBeNull();
    button?.props.onClick?.();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
