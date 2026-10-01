import { requireMember, AppError } from "@/lib/auth";
import { database, must } from "@/lib/db";
import { body, json, failure } from "@/lib/http";
import { z } from "zod";
// Provision password accounts without sending messages; the owner distributes initial passwords securely.
export async function POST(request: Request) {
  try {
    const admin = await requireMember(true);
    const input = z
      .object({
        email: z.email(),
        password: z.string().min(12).max(100),
        role: z.enum(["employee", "super_admin"]),
      })
      .strict()
      .parse(await body(request));
    const db = database();
    const { data, error } = await db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new AppError(
        "Could not create this account. It may already exist.",
        409,
      );
    const result = await db
      .from("members")
      .insert({ id: data.user.id, email: input.email, role: input.role });
    if (result.error) {
      await db.auth.admin.deleteUser(data.user.id);
      throw new Error("Account membership creation failed.");
    }
    must(
      await db.from("audit_events").insert({
        actor_id: admin.id,
        action: "member_created",
        object_id: data.user.id,
      }),
    );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const admin = await requireMember(true);
    const { id, active } = z
      .object({ id: z.uuid(), active: z.boolean() })
      .strict()
      .parse(await body(request));
    if (id === admin.id)
      throw new AppError("You cannot disable your own account.");
    const db = database();
    must(await db.from("members").update({ active }).eq("id", id));
    must(
      await db.from("audit_events").insert({
        actor_id: admin.id,
        action: active ? "member_enabled" : "member_disabled",
        object_id: id,
      }),
    );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
