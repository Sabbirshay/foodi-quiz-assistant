"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  Settings2,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import type { Member } from "@/lib/contracts";
export function Shell({
  children,
  member,
  connected,
}: {
  children: React.ReactNode;
  member: Member | null;
  connected: boolean;
}) {
  const path = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-symbol">f</span>
          <span>
            foodi<span className="brand-sub">QUIZ ASSISTANT</span>
          </span>
        </Link>
        <div className="workspace-label">EMPLOYEE WORKSPACE</div>
        <nav aria-label="Main navigation">
          <Link
            className={path === "/" ? "nav-item active" : "nav-item"}
            href="/"
          >
            <GraduationCap size={19} /> Quiz assistant{" "}
            <span className="nav-dot" />
          </Link>
          <Link
            className={path === "/knowledge" ? "nav-item active" : "nav-item"}
            href="/knowledge"
          >
            <BookOpen size={18} /> Knowledge base
          </Link>
          {(member?.role === "super_admin" || !connected) && (
            <>
              <div className="workspace-label admin-label">ADMINISTRATION</div>
              <Link
                className={path === "/admin" ? "nav-item active" : "nav-item"}
                href="/admin"
              >
                <Settings2 size={18} /> Super admin
              </Link>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-note">
            <ShieldCheck size={21} />
            <strong>Grounded in Foodi guidance</strong>
            <p>Every answer starts with your approved knowledge base.</p>
            <a
              href="https://sites.google.com/view/foodi-service-guidelines/home"
              target="_blank"
              rel="noreferrer"
            >
              Open CE Portal <ArrowUpRight size={14} />
            </a>
          </div>
          <div className="profile">
            <span className="avatar">
              {member ? member.email.slice(0, 2).toUpperCase() : "FQ"}
            </span>
            <div>
              <strong>
                {member?.email.split("@")[0] ?? "Workspace preview"}
              </strong>
              <small>
                {member?.role === "super_admin"
                  ? "Super admin"
                  : member
                    ? "Employee"
                    : "Not connected"}
              </small>
            </div>
            {member && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                  });
                  location.href = "/login";
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="divider">/</span>
            <span>
              {path === "/admin"
                ? "Super admin"
                : path === "/knowledge"
                  ? "Knowledge base"
                  : "Quiz assistant"}
            </span>
          </div>
          <span className="private-label">
            <ShieldCheck size={14} /> Internal workspace
          </span>
        </header>
        <main>
          {!connected && (
            <div className="setup-banner">
              <span className="setup-dot" />
              <span>
                <strong>Workspace preview.</strong> Connect Supabase and
                OpenRouter to answer real quiz questions.
              </span>
              <Link href="/admin">View setup</Link>
            </div>
          )}
          {children}
        </main>
        <footer>
          Foodi Quiz Assistant <span>Find the answer. Understand the why.</span>
        </footer>
      </div>
    </div>
  );
}
