import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Guards the repo's own check scripts, which is why a web test reaches across
 * the workspace: there is no root-level unit-test project, and `pnpm --filter
 * web test` is the suite CI already runs.
 *
 * It asserts the script text, not a run of it — executing ESLint and tsc here
 * would make the unit suite as slow as CI. The behaviour behind the text was
 * confirmed by hand on a file with a deliberate type error: the old
 * `next lint || tsc` exited 0, the current script exits 1.
 */
const packageScripts = (workspace: "web" | "api") => {
  const dir = path.resolve(__dirname, "../..", workspace === "web" ? "." : "../api")
  return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).scripts as Record<string, string>
}

describe("local checks match the ones CI runs", () => {
  // This script used to be `next lint || tsc -p tsconfig.json --noEmit`. The
  // `||` meant the typecheck ran only when ESLint failed, so a clean lint
  // reported success while TypeScript errors went unnoticed until CI, which
  // runs the two as separate steps and never had the hole. That happened: a
  // test file with two type errors passed `pnpm --filter web lint` locally
  // and broke the CI job.
  it("chains ESLint into the typecheck, so a passing check can no longer skip the other", () => {
    const lint = packageScripts("web").lint

    expect(lint).toContain("next lint")
    expect(lint).toContain("tsc -p tsconfig.json --noEmit")
    expect(lint, "`||` lets a passing check skip the other one").not.toContain("||")
    expect(lint).toMatch(/next lint[^&|]*&&[^&|]*tsc/)
  })

  // Not strictly part of closing the `||` hole, but the same class of gap:
  // without it a warning passes locally and fails the CI step, which is the
  // local-vs-CI mismatch this test exists to prevent.
  it("fails ESLint on a warning, as the CI step does", () => {
    expect(packageScripts("web").lint).toContain("--max-warnings=0")
  })

  it("keeps the API typecheck wired to its lint script", () => {
    expect(packageScripts("api").lint).toContain("tsc -p tsconfig.json --noEmit")
  })
})
