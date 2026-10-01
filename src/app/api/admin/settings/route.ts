import { requireMember, AppError } from "@/lib/auth";
import { database, must } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
import { settingsSchema } from "@/lib/contracts";
import { nextRun } from "@/lib/safety";
import { listModels } from "@/lib/openrouter";
export async function GET() {
  try {
    await requireMember(true);
    return json(
      must(
        await database().from("app_settings").select("*").eq("id", 1).single(),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    const m = await requireMember(true);
    const data = settingsSchema.parse(await body(request));
    let next: string;
    try {
      next = nextRun(data.cron_expression, data.timezone);
    } catch (e) {
      throw new AppError(e instanceof Error ? e.message : "Invalid schedule.");
    }
    if (data.answer_model || data.crawler_model) {
      const models = await listModels();
      for (const id of [data.answer_model, data.crawler_model].filter(Boolean))
        if (!models.some((m) => m.id === id))
          throw new AppError(
            "Select a currently available model with structured outputs.",
          );
    }
    if (
      data.schedule_enabled &&
      (!data.crawler_model ||
        !process.env.OPENROUTER_API_KEY ||
        data.daily_budget_usd <= 0 ||
        data.max_call_usd <= 0)
    )
      throw new AppError(
        "Choose a crawler model, connect OpenRouter, and set spending limits before enabling the schedule.",
      );
    const db = database();
    must(
      await db
        .from("app_settings")
        .update({
          ...data,
          next_run_at: data.schedule_enabled ? next : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1),
    );
    must(
      await db
        .from("audit_events")
        .insert({ actor_id: m.id, action: "settings_updated" }),
    );
    return json({ ok: true, next_run_at: data.schedule_enabled ? next : null });
  } catch (e) {
    return failure(e);
  }
}
