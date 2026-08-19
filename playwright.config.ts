import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 10_000,
  use: { headless: true },
  reporter: [['list'], ['json', { outputFile: 'artifacts/healing-report.json' }]],
});