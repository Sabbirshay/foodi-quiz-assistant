import { authClient } from "@/lib/auth";
import { body, json, failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    await body(request);
    const client = await authClient();
    await client.auth.signOut();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
