import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
process.loadEnvFile(resolve(root, ".env.local"));
const lock = resolve(root, "storage/local-worker.lock");
mkdirSync(resolve(root, "storage"), { recursive: true });
try {
  mkdirSync(lock);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  let alive = true;
  try {
    const pid = Number(readFileSync(resolve(lock, "pid"), "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("invalid_pid");
    try {
      process.kill(pid, 0);
    } catch (e) {
      if (e.code === "ESRCH") alive = false;
    }
  } catch {
    console.error(
      "Worker lock is incomplete. Remove storage/local-worker.lock only after confirming no worker is running.",
    );
    process.exit(1);
  }
  if (alive) {
    let recent = false;
    try {
      const heartbeat = Date.parse(
        readFileSync(resolve(root, "storage/worker-heartbeat"), "utf8"),
      );
      recent = Number.isFinite(heartbeat) && Date.now() - heartbeat < 120000;
    } catch {}
    console.log(
      recent
        ? "The local crawler is running and recently connected to Supabase. Refresh Crawl activity on the website."
        : "A crawler process exists, but its heartbeat is missing or stale. It may be stopping or disconnected. Check storage/worker.log; this does not mean the crawler is online.",
    );
    process.exit(recent ? 0 : 1);
  }
  rmSync(lock, { recursive: true });
  mkdirSync(lock);
}
writeFileSync(resolve(lock, "pid"), String(process.pid), { mode: 0o600 });
if (!process.env.CHROME_PATH) {
  const installed = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
  if (installed) process.env.CHROME_PATH = installed;
}
const child = spawn(
  process.execPath,
  ["--import", "tsx", "worker/src/index.ts"],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (!stopping) {
      stopping = true;
      child.kill(signal);
    }
  });
child.on("error", () => {
  rmSync(lock, { recursive: true, force: true });
  process.exitCode = 1;
});
child.on("exit", (code) => {
  rmSync(lock, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});
