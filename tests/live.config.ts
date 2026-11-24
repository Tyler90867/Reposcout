import { defineConfig } from '@playwright/test'
import { chromiumLaunchOptions } from 'deepspace/testing'

/**
 * Runs the same browser tests against the live site instead of a local
 * server. Nothing is started on this computer.
 *
 * Run it with:
 *   npx playwright test -c tests/live.config.ts
 *
 * The tests sign in as the two test accounts, and they delete every brief
 * they create. The real-repository test spends a little over one credit.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'https://reposcout.app.space',
    headless: true,
    launchOptions: chromiumLaunchOptions(),
  },
})
