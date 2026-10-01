import { authClient } from "@/lib/auth";
import { body, json, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(request: Request) {
  try {
    const data = z
      .object({ email: z.email(), password: z.string().min(8).max(200) })
      .strict()
      .parse(await body(request));
    const client = await authClient();
    const { error } = await client.auth.signInWithPassword(data);
    if (error)
      return json(
        { error: "Sign-in failed. Check your email and password." },
        401,
      );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
