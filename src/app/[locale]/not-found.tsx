import { NotFoundContent, type NotFoundCopy } from '@/components/ui/not-found-content';
import { getDictionary } from '@/i18n';
import { LOCALES, type Locale } from '@/i18n/config';

/**
 * Locale-scoped 404, rendered inside [locale]/layout.tsx (header, footer,
 * <html lang>) with a 404 status.
 *
 * A not-found boundary receives no params, so the language is taken from the
 * URL by NotFoundContent; this component only prepares the strings.
 */
export default function LocaleNotFound() {
  const copy = Object.fromEntries(
    LOCALES.map((locale) => {
      const dict = getDictionary(locale);
      return [
        locale,
        {
          title: dict.errors.notFoundTitle,
          text: dict.errors.notFoundText,
          goHome: dict.errors.goHome,
          catalog: dict.nav.catalog,
        },
      ];
    })
  ) as Record<Locale, NotFoundCopy>;

  return <NotFoundContent copy={copy} />;
}
