import { defineConfig, devices } from "@playwright/test";

// Tests drive the app against the real local stack (`make up && make demo`
// in ../Ridr), signed in with the dev token. Each worktree or CI job can
// pick its own port with PORT. E2E_SERVER=worker serves the production
// build in ./dist through `wrangler dev` instead of the Vite dev server,
// as Cloudflare will serve it (run `npm run build` first).
const port = Number(process.env.PORT) || 5173;
const baseURL = `http://localhost:${port}`;
const worker = process.env.E2E_SERVER === "worker";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: worker
      ? `npx wrangler dev --port ${port} --ip localhost`
      : `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
