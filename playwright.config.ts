import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Smoke-test config for the TabSync extension.
 *
 * Extensions cannot run in pure-headless Chromium — Playwright's persistent
 * context with --load-extension is the supported path, and it must be headed
 * (or use the new "headless" mode that Chromium added recently).
 *
 * Run:
 *   npm run build                # produces dist/
 *   npm run test:smoke:install   # one-time, downloads playwright chromium
 *   npm run test:smoke
 */
export default defineConfig({
  testDir: path.resolve(__dirname, 'tests'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
  },
});
