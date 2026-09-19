import { NextResponse, type NextRequest } from 'next/server';

import { DEFAULT_LOCALE, isLocale } from '@/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Supabase auth callback.
 *
 * Handles both email confirmation and password recovery links. An expired or
 * already-used link is not an error page: the visitor is sent to a neutral
 * notice that offers to request a new one.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get('code');
  const flow = searchParams.get('flow');
  const localeParam = searchParams.get('locale');
  const locale = isLocale(localeParam) ? localeParam : DEFAULT_LOCALE;

  if (code === null) {
    return NextResponse.redirect(
      `${origin}/${locale}/auth/pranesimas?state=invalid`
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null) {
    return NextResponse.redirect(
      `${origin}/${locale}/auth/pranesimas?state=invalid`
    );
  }

  if (flow === 'recovery') {
    return NextResponse.redirect(`${origin}/${locale}/naujas-slaptazodis`);
  }

  return NextResponse.redirect(
    `${origin}/${locale}/auth/pranesimas?state=confirmed`
  );
}
