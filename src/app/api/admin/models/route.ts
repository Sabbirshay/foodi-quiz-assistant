import { requireMember } from "@/lib/auth";
import { listModels } from "@/lib/openrouter";
import { json, failure } from "@/lib/http";
export async function GET() {
  try {
    await requireMember(true);
    return json({ models: await listModels() });
  } catch (e) {
    return failure(e);
  }
}
