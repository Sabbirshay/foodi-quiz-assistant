import { requireMember, AppError } from "@/lib/auth";
import { database, must } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const m = await requireMember(true);
    const { id, hash, decision, images_reviewed } = z
      .object({
        id: z.uuid(),
        hash: z.string().length(64),
        decision: z.enum(["approved", "rejected"]),
        images_reviewed: z.boolean().optional(),
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
    if (decision === "approved") {
      const snapshot = must(
        await db.storage
          .from("crawl-snapshots")
          .download(candidate.storage_path),
      );
      const saved = JSON.parse(await snapshot.text());
      if (saved.images?.length && !images_reviewed)
        throw new AppError(
          "Review each original SOP image and confirm its steps and branches before approval.",
          422,
        );
    }
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

export async function GET(request: Request) {
  try {
    await requireMember(true);
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const db = database();
    const candidate = must(
      await db
        .from("candidates")
        .select("storage_path,hash")
        .eq("id", id)
        .single(),
    );
    const blob = must(
      await db.storage.from("crawl-snapshots").download(candidate.storage_path),
    );
    const snapshot = JSON.parse(await blob.text());
    return json({ hash: candidate.hash, images: snapshot.images ?? [] });
  } catch (e) {
    return failure(e);
  }
}
