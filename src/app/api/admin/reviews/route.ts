import { requireMember, AppError } from "@/lib/auth";
import { database, must } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const m = await requireMember(true);
    const { id, hash, decision } = z
      .object({
        id: z.uuid(),
        hash: z.string().length(64),
        decision: z.enum(["approved", "rejected"]),
      })
      .strict()
      .parse(await body(request));
    const db = database();
    const candidate = must(
      await db
        .from("candidates")
        .select("*,source_pages(observed_hash)")
        .eq("id", id)
        .single(),
    );
    if (
      candidate.status !== "pending" ||
      candidate.hash !== hash ||
      candidate.source_pages.observed_hash !== hash
    )
      throw new AppError(
        "This candidate changed. Refresh before reviewing.",
        409,
      );
    if (decision === "approved" && candidate.coverage_notes.length)
      throw new AppError(
        "This source has extraction gaps. Resolve them before approval.",
        422,
      );
    const changed = must(
      await db
        .from("candidates")
        .update({
          status: decision,
          reviewed_by: m.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id"),
    );
    if (!changed.length)
      throw new AppError(
        "Another reviewer already handled this candidate.",
        409,
      );
    must(
      await db.from("audit_events").insert({
        actor_id: m.id,
        action: `candidate_${decision}`,
        object_id: id,
      }),
    );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
