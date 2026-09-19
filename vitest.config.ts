import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws when imported outside a React Server Component;
      // under Vitest it is replaced by a harmless empty module so repository
      // code can be unit tested.
      'server-only': fileURLToPath(
        new URL('./tests/stubs/server-only.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    // Playwright specs are run by `npm run test:e2e`, not by Vitest.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    reporters: ['default'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/domain/**', 'src/lib/search.ts', 'src/lib/slug.ts', 'src/lib/format.ts'],
    },
  },
});
