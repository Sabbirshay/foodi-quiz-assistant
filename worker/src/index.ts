import { mkdirSync, writeFileSync } from "node:fs";
import { database, must, configured } from "../../src/lib/db";
import { nextRun } from "../../src/lib/safety";
import { crawl } from "./crawl";
import { publish, verifySpreadsheet } from "./sheets";
import type { Settings } from "../../src/lib/contracts";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
if (!configured())
  throw new Error(
    "Configure Supabase in .env.local before starting the worker.",
  );
if (
  !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
  !process.env.GOOGLE_SPREADSHEET_ID
)
  throw new Error(
    "Configure the Google Sheets service account before starting the worker.",
  );
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
let lastVerification = 0;
console.log(
  "Foodi worker started. Source text and questions are never logged.",
);
while (running) {
  try {
    const db = database();
    const now = new Date().toISOString();
    const cfg = must(
      await db
        .from("app_settings")
        .update({ worker_seen_at: now })
        .eq("id", 1)
        .select("*")
        .single(),
    ) as Settings & { next_run_at: string | null; updated_at: string };
    mkdirSync("storage", { recursive: true });
    writeFileSync("storage/worker-heartbeat", now);
    if (cfg.schedule_enabled && (!cfg.next_run_at || cfg.next_run_at <= now)) {
      const changed = must(
        await db
          .from("app_settings")
          .update({ next_run_at: nextRun(cfg.cron_expression, cfg.timezone) })
          .eq("id", 1)
          .eq("updated_at", cfg.updated_at)
          .eq("schedule_enabled", true)
          .or(`next_run_at.is.null,next_run_at.lte.${now}`)
          .select("id"),
      );
      if (changed.length) {
        const result = await db.from("jobs").insert({ kind: "crawl" });
        if (result.error && result.error.code !== "23505")
          throw new Error("schedule_enqueue_failed");
      }
    }
    const jobs = must(await db.rpc("claim_job"));
    const job = jobs[0];
    if (job) {
      const heartbeat = setInterval(() => {
        void db
          .from("app_settings")
          .update({ worker_seen_at: new Date().toISOString() })
          .eq("id", 1)
          .then((result) => { if (!result.error) writeFileSync("storage/worker-heartbeat", new Date().toISOString()); });
        void db
          .from("jobs")
          .update({ lease_until: new Date(Date.now() + 180000).toISOString() })
          .eq("id", job.id)
          .eq("lease_token", job.lease_token)
          .then((result) => {
            if (result.error) console.error("worker_heartbeat_failed");
          });
      }, 30000);
      try {
        const stats =
          job.kind === "crawl" ? await crawl(job.id, cfg) : await publish();
        must(
          await db
            .from("jobs")
            .update({
              status: "completed",
              stats,
              finished_at: new Date().toISOString(),
              lease_until: null,
            })
            .eq("id", job.id)
            .eq("lease_token", job.lease_token),
        );
      } catch {
        must(
          await db
            .from("jobs")
            .update({
              status: "failed",
              error_code:
                job.kind === "crawl"
                  ? "crawl_incomplete_or_provider_error"
                  : "publication_failed_check_integrations",
              finished_at: new Date().toISOString(),
              lease_until: null,
            })
            .eq("id", job.id)
            .eq("lease_token", job.lease_token),
        );
      } finally {
        clearInterval(heartbeat);
      }
    }
    if (Date.now() - lastVerification > 300000) {
      try {
        await verifySpreadsheet();
      } catch {
        console.error("sheet_verification_failed");
      }
      lastVerification = Date.now();
    }
  } catch {
    console.error("worker_iteration_failed");
  }
  if (running) await sleep(15000);
}

// Crawlee/browser handles may survive a finished job. Once the loop drains,
// terminate so the launcher can release its lock and restart cleanly.
process.exit(0);
