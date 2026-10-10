import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // Tests never reach the real Khaime API: fetch is stubbed per test, and
        // these fake values override anything in .dev.vars.
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations('./migrations'),
          APP_KEY: 'test-app-key-test-app-key-test-app-key',
          APP_URL: 'http://localhost',
          KHAIME_API_KEY: 'test-key',
          KHAIME_API_URL: 'https://khaime.test/api/v1',
          KHAIME_WEBHOOK_SECRET: 'test-webhook-secret',
          BREVO_API_KEY: '',
          MAIL_FROM_EMAIL: '',
        },
      },
    })),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
})
