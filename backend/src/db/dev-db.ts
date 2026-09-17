import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(__dirname, "..", "..", ".pgdata");

const pidFile = path.join(databaseDir, "postmaster.pid");
if (existsSync(pidFile)) {
  const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0].trim());
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch {}
  if (alive) {
    console.log(`[dev-db] PostgreSQL is already running (PID ${pid}).`);
    console.log("[dev-db] Keep that terminal open, or stop it first (Ctrl+C there).");
    process.exit(0);
  }
  unlinkSync(pidFile);
  console.log("[dev-db] Removed stale postmaster.pid");
}

const pg = new EmbeddedPostgres({
  databaseDir,
  port: 55432,
  user: "postgres",
  password: "postgres",
  persistent: true,
});

if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
  console.log("[dev-db] Initialising Postgres data directory...");
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase("restaurantos");
  console.log("[dev-db] Created database 'restaurantos'");
} catch {
  // database already exists
}

console.log("[dev-db] PostgreSQL is running on localhost:55432");
console.log("[dev-db] DATABASE_URL=postgresql://postgres:postgres@localhost:55432/restaurantos");
console.log("[dev-db] Press Ctrl+C to stop");

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
