import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { Library } from "@/components/library";
import { viewer } from "@/lib/auth";
import { configured, database, must } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Knowledge() {
  const connected = configured(),
    member = await viewer();
  if (connected && !member) redirect("/login");
  const pages = member
    ? must(
        await database()
          .from("source_pages")
          .select("id,title,url,eligible,state,verified_at")
          .not("revision", "is", null)
          .order("title"),
      )
    : [];
  return (
    <Shell member={member} connected={connected}>
      <Library pages={pages} admin={member?.role === "super_admin"} />
    </Shell>
  );
}
