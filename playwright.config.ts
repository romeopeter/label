import { defineConfig, devices } from "@playwright/test";

const PORT = 5199;

/**
 * WebKit is what macOS builds run on. The version is pinned in package.json:
 * newer WebKit builds crash on macOS 14.
 */
export default defineConfig({
  testDir: "tests",
  outputDir: "node_modules/.cache/playwright-results",
  workers: 2,
  reporter: "list",
  use: {
    ...devices["Desktop Safari"],
    baseURL: `http://127.0.0.1:${PORT}/`,
    viewport: { width: 1440, height: 950 },
  },
  webServer: {
    // Its own port, so it never touches a running `npm run tauri:dev`.
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
  },
});
