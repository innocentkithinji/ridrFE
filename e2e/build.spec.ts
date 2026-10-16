import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A production build must sign in with Clerk, or name its dev token on
// purpose; it never falls back to the local stack's token unasked.

// build runs a production build with only the given VITE_ settings, into
// a throwaway folder, and returns how it went.
function build(settings: Record<string, string>) {
  const outDir = mkdtempSync(join(tmpdir(), "ridr-web-build-"));
  const env: NodeJS.ProcessEnv = { ...settings };
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith("VITE_")) env[name] = value;
  }
  try {
    const run = spawnSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], {
      env,
      encoding: "utf8",
    });
    return { ok: run.status === 0, output: run.stdout + run.stderr };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

test.describe("a production build", () => {
  // One build at a time: they are slow, and no browser is needed.
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("refuses to build with neither a Clerk key nor a named dev token", () => {
    const result = build({});
    expect(result.ok).toBe(false);
    expect(result.output).toContain("VITE_CLERK_PUBLISHABLE_KEY");
  });

  test("builds with a Clerk key", () => {
    const result = build({ VITE_CLERK_PUBLISHABLE_KEY: "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k" });
    expect(result.ok, result.output).toBe(true);
  });

  test("builds for a local stack when the dev token is named on purpose", () => {
    const result = build({ VITE_RIDR_DEV_TOKEN: "dev-user-token" });
    expect(result.ok, result.output).toBe(true);
  });
});
