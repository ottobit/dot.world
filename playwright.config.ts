import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // The dev server, not the built bundle: a failure here should point at the
  // source line, not at a minified chunk.
  webServer: { command: 'npm run dev -- --port 5174', url: 'http://localhost:5174', reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:5174',
    // Chromium is preinstalled in this environment; `playwright install` is
    // neither needed nor allowed to run here.
    // This environment preinstalls Chromium and forbids `playwright install`;
    // CI installs its own and clears the variable to fall back to the default.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM === ''
      ? {}
      : { executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium' },
  },
});
