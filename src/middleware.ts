/**
 * Middleware: locale routing plus Supabase session refresh.
 *
 * 1. Requests without a locale prefix are redirected to the visitor's
 *    remembered language, or to Lithuanian on a first visit.
 * 2. The Supabase auth cookie is refreshed on every request so Server
 *    Components always observe a valid session.
 * 3. Protected areas redirect anonymous visitors to the login page and
 *    remember where they were heading.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  matchLocale,
} from '@/i18n/config';
import { isProtectedPath } from '@/lib/routes';

const PUBLIC_FILE = /\.[^/]+$/;

function localeFromRequest(request: NextRequest) {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  return matchLocale(request.headers.get('accept-language'));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Never touch static assets, the Next.js internals or the auth callback.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth/callback') ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  const first = segments[0];

  // ---- 1. Locale prefix ---------------------------------------------------
  if (!isLocale(first)) {
    const locale = localeFromRequest(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

    const redirect = NextResponse.redirect(url);
    redirect.cookies.set(LOCALE_COOKIE, locale, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
    return redirect;
  }

  const locale = first;

  // ---- 2. Supabase session refresh ---------------------------------------
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration the site still renders (and shows a clear error on
  // the pages that need data) instead of failing every request here.
  if (
    supabaseUrl === undefined ||
    supabaseAnonKey === undefined ||
    supabaseUrl.length === 0 ||
    supabaseAnonKey.length === 0
  ) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Keep the language cookie in sync with the URL the visitor actually uses.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
      path: '/',
    });
  }

  // ---- 3. Protected routes ------------------------------------------------
  if (user === null && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/prisijungti`;
    url.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static files and image optimisation, so that the
     * locale redirect and the session refresh apply to real pages only.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

export const LOCALE_LIST = LOCALES;
export const FALLBACK_LOCALE = DEFAULT_LOCALE;
