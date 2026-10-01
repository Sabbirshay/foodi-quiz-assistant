import { requireMember, AppError } from "@/lib/auth";
import { database, must } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const m = await requireMember(true);
    const { kind } = z
      .object({ kind: z.enum(["crawl", "publish"]) })
      .strict()
      .parse(await body(request));
    const db = database();
    const cfg = must(
      await db.from("app_settings").select("*").eq("id", 1).single(),
    );
    if (
      !cfg.worker_seen_at ||
      Date.now() - Date.parse(cfg.worker_seen_at) > 120000
    )
      throw new AppError(
        "The crawler worker is offline. Start it before queuing a job.",
        503,
      );
    if (
      kind === "crawl" &&
      (!cfg.crawler_model || cfg.daily_budget_usd <= 0 || cfg.max_call_usd <= 0)
    )
      throw new AppError("Choose a crawler model and spending limits first.");
    const result = await db
      .from("jobs")
      .insert({ kind, requested_by: m.id })
      .select("id")
      .single();
    if (result.error?.code === "23505")
      throw new AppError(
        "A job of this type is already queued or running.",
        409,
      );
    return json({ job: must(result) }, 202);
  } catch (e) {
    return failure(e);
  }
}
