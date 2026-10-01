import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { AdminPanel } from "@/components/admin-panel";
import { configured, database, must } from "@/lib/db";
import { viewer } from "@/lib/auth";
import { localWorkerEnabled } from "@/lib/local-worker";
import { defaultSettings } from "@/lib/contracts";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const connected = configured(),
    member = await viewer();
  if (connected && !member) redirect("/login");
  if (member && member.role !== "super_admin") redirect("/");
  let initial = defaultSettings,
    candidates = [],
    jobs = [],
    members = [],
    usage = 0;
  if (member) {
    const db = database();
    const [s, c, j, m, u] = await Promise.all([
      db.from("app_settings").select("*").eq("id", 1).single(),
      db
        .from("candidates")
        .select("*")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      db.from("members").select("*").order("created_at", { ascending: false }),
      db
        .from("usage_events")
        .select("reserved_usd,actual_usd")
        .gte(
          "created_at",
          new Date().toISOString().slice(0, 10) + "T00:00:00Z",
        ),
    ]);
    initial = must(s);
    candidates = must(c);
    jobs = must(j);
    members = must(m);
    usage = must(u).reduce(
      (n, r) => n + Number(r.actual_usd ?? r.reserved_usd),
      0,
    );
  }
  return (
    <Shell member={member} connected={connected}>
      <AdminPanel
        connected={connected}
        localWorker={localWorkerEnabled()}
        openrouter={!!process.env.OPENROUTER_API_KEY}
        initial={initial}
        candidates={candidates}
        jobs={jobs}
        members={members}
        usage={usage}
      />
    </Shell>
  );
}
