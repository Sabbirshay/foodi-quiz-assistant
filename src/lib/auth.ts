import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configured, database, must } from "./db";
import type { Member } from "./contracts";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function authClient() {
  if (!configured())
    throw new AppError("Connect Supabase to enable employee sign-in.", 503);
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server pages refresh via proxy. */
          }
        },
      },
    },
  );
}
export async function requireMember(admin = false): Promise<Member> {
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new AppError("Please sign in to continue.", 401);
  const m = must(
    await database()
      .from("members")
      .select("*")
      .eq("id", user.id)
      .maybeSingle(),
  ) as Member | null;
  if (!m?.active)
    throw new AppError("Your account has not been granted access.", 403);
  if (admin && m.role !== "super_admin")
    throw new AppError("Super admin access is required.", 403);
  return m;
}
export async function viewer() {
  if (!configured()) return null;
  try {
    return await requireMember();
  } catch {
    return null;
  }
}
