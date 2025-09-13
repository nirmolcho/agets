import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 3000',
    url: 'http://localhost:3000',
    env: {
      VITE_REQUIRE_AUTH: 'false',
      VITE_E2E: 'true',
      VITE_SUPABASE_URL: 'https://bwkqyjfizhvrrylqjxng.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3F5amZpemh2cnJ5bHFqeG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzQ1ODQsImV4cCI6MjA3Mjc1MDU4NH0.yHHslRbEfFtVScZGf5stehBsZvrMbD8223Gd0apNxBU',
      VITE_GOOGLE_REDIRECT_TO: 'https://agets.vercel.app/',
    },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});


