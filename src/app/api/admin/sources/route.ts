import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { database, must } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const m = await requireMember(true);
    const { id } = z
      .object({ id: z.uuid() })
      .strict()
      .parse(await body(request));
    const db = database();
    must(
      await db
        .from("source_pages")
        .update({ eligible: false, state: "revoked" })
        .eq("id", id),
    );
    must(
      await db
        .from("audit_events")
        .insert({ actor_id: m.id, action: "source_revoked", object_id: id }),
    );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
