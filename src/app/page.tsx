import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { QuizWorkspace } from "@/components/quiz-workspace";
import { configured, database } from "@/lib/db";
import { viewer } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const connected = configured(),
    member = await viewer();
  if (connected && !member) redirect("/login");
  let count = 0;
  if (member) {
    const result = await database()
      .from("source_pages")
      .select("id", { count: "exact", head: true })
      .eq("eligible", true);
    count = result.count ?? 0;
  }
  return (
    <Shell member={member} connected={connected}>
      <QuizWorkspace
        connected={connected}
        signedIn={!!member}
        sourceCount={count}
      />
    </Shell>
  );
}
