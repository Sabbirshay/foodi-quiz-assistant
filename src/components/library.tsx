"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Search, ArrowUpRight } from "lucide-react";
type Page = {
  id: string;
  title: string;
  url: string;
  eligible: boolean;
  state: string;
  verified_at: string | null;
};
export function Library({
  pages,
  admin = false,
}: {
  pages: Page[];
  admin?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function revoke(id: string) {
    setBusy(id);
    setError("");
    try {
      const r = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke source.");
    } finally {
      setBusy("");
    }
  }
  const [query, setQuery] = useState("");
  const shown = pages.filter((p) =>
    (p.title + " " + p.url).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE KNOWLEDGE BEHIND YOUR ANSWERS</div>
          <h1>Knowledge base</h1>
          <p>Approved sources from the Foodi CE Portal.</p>
        </div>
        <span className="badge">{pages.length} sources</span>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      <div className="toolbar">
        <Search size={19} />
        <input
          aria-label="Search knowledge sources"
          placeholder="Find a source by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {shown.length ? (
        <div className="library-grid">
          {shown.map((p) => (
            <article className="panel source-card" key={p.id}>
              <div className="save-bar" style={{ marginTop: 0 }}>
                <BookOpen size={22} />
                <span className={p.eligible ? "badge green" : "badge"}>
                  {p.eligible ? "Approved" : p.state.replaceAll("_", " ")}
                </span>
              </div>
              <h2 style={{ marginTop: 18 }}>{p.title}</h2>
              <p>
                {p.eligible
                  ? "Available for evidence-based quiz answers."
                  : "Not currently eligible for quiz answers."}
              </p>
              <a href={p.url} target="_blank" rel="noreferrer">
                Open original source <ArrowUpRight size={15} />
              </a>
              <small>
                {p.verified_at
                  ? "Last verified " + new Date(p.verified_at).toLocaleString()
                  : "Awaiting source verification"}
              </small>
              {admin && p.eligible && (
                <button
                  className="secondary-button"
                  style={{ marginTop: 14 }}
                  disabled={!!busy}
                  onClick={() => revoke(p.id)}
                >
                  Revoke source
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="panel empty-state">
          <BookOpen size={33} />
          <h3>
            {query
              ? "No matching sources"
              : "Your knowledge base is getting ready"}
          </h3>
          <p>
            {query
              ? "Try a different title."
              : "Your super admin will crawl, review, and publish the first set of sources."}
          </p>
        </div>
      )}
    </>
  );
}
