import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import { requireMember, AppError } from "@/lib/auth";
import { body, json, failure } from "@/lib/http";
import { database, must } from "@/lib/db";
import { localWorkerEnabled } from "@/lib/local-worker";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await requireMember(true);
    await body(request);
    if (!localWorkerEnabled())
      throw new AppError(
        "Start the crawler from the admin panel on your local device.",
        403,
      );
    const cfg = must(
      await database()
        .from("app_settings")
        .select("worker_seen_at")
        .eq("id", 1)
        .single(),
    );
    if (
      cfg.worker_seen_at &&
      Date.now() - Date.parse(cfg.worker_seen_at) < 120000
    )
      return json({ ok: true, message: "Crawler is already online." });
    await mkdir(resolve(process.cwd(), "storage"), { recursive: true });
    const log = await open(
      resolve(process.cwd(), "storage/worker.log"),
      "a",
      0o600,
    );
    try {
      const child = spawn(
        process.execPath,
        [resolve(process.cwd(), "scripts/local-worker.mjs")],
        {
          cwd: process.cwd(),
          detached: true,
          stdio: ["ignore", log.fd, log.fd],
          env: process.env,
        },
      );
      await new Promise<void>((done, reject) => {
        child.once("spawn", done);
        child.once("error", reject);
      });
      child.unref();
    } finally {
      await log.close();
    }
    return json(
      {
        ok: true,
        message:
          "Local crawler starting. Refresh activity in a few seconds, then run your crawl.",
      },
      202,
    );
  } catch (e) {
    return failure(e);
  }
}
