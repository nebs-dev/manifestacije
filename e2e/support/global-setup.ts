/**
 * Brings the disposable database to a known state once per run: truncate, then
 * seed the reference data (regions, counties, cities, categories, one admin)
 * with the project's own `prisma:seed`, with SEED_DEMO_DATA off so no sample
 * events exist. Every test then creates its own uniquely named rows.
 *
 * Migrations are not applied here: `pnpm --filter api start` runs
 * `prisma migrate deploy` as its first step, and Playwright starts that server
 * before this hook.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { accountSeedEnv, assertDisposableDatabase, DATABASE_URL, seedEnv } from "./env";

const repoRoot = path.resolve(__dirname, "..", "..");

function run(label: string, args: string[], env: Record<string, string>) {
  process.stdout.write(`[e2e] ${label}…\n`);
  execFileSync("pnpm", args, {
    cwd: repoRoot,
    // The developer's own keys live in a .env symlinked into both apps. Only
    // the variables listed in env.ts reach these child processes, and PATH is
    // needed for pnpm itself.
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env },
    stdio: ["ignore", "inherit", "inherit"],
  });
}

/**
 * A clear message instead of a Prisma stack trace: forgetting to start the
 * container is the most likely way this suite fails for someone new.
 */
async function assertDatabaseReachable() {
  const { hostname, port } = new URL(DATABASE_URL);
  const { connect } = await import("node:net");
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host: hostname, port: Number(port) });
    const fail = () =>
      reject(
        new Error(
          `Nothing is listening on ${hostname}:${port}. Start the disposable E2E database with \`pnpm e2e:db:up\` ` +
            "(or, in CI, check the postgres service container)."
        )
      );
    socket.setTimeout(5000);
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      fail();
    });
    socket.once("error", () => {
      socket.destroy();
      fail();
    });
  });
}

export default async function globalSetup() {
  assertDisposableDatabase();
  await assertDatabaseReachable();

  // `pnpm --filter api start` applies migrations as its first step and
  // Playwright starts that server before this hook, so this is normally a
  // no-op. It is here so the truncate below cannot run against a schema-less
  // database if that order ever changes.
  run("applying migrations", ["--filter", "api", "prisma:migrate"], { DATABASE_URL });

  run("truncating the E2E database", ["--filter", "api", "exec", "tsx", path.join(repoRoot, "e2e/support/reset-db.ts")], {
    DATABASE_URL,
  });
  run("seeding reference data (no demo events)", ["--filter", "api", "prisma:seed"], seedEnv);
  run(
    "creating the synthetic account pool",
    ["--filter", "api", "exec", "tsx", path.join(repoRoot, "e2e/support/seed-accounts.ts")],
    accountSeedEnv
  );
}
