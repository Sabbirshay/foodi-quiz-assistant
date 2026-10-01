"use client";
import { useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
export function Login({ connected }: { connected: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            const r = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: data.get("email"),
                password: data.get("password"),
              }),
            });
            const result = await r.json();
            if (!r.ok) throw new Error(result.error);
            location.href = "/";
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Link href="/" className="brand">
          <span className="brand-symbol">f</span>
          <span>
            foodi<span className="brand-sub">QUIZ ASSISTANT</span>
          </span>
        </Link>
        <h1>Welcome to your workspace.</h1>
        <p>Sign in with your employee account to get started.</p>
        <label className="field-label" htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@example.com"
        />
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          maxLength={200}
          required
        />
        <button className="primary-button" disabled={busy || !connected}>
          {busy && <LoaderCircle size={16} className="spin" />}Sign in
        </button>
        {!connected && (
          <div className="notice">
            Sign-in is available after your administrator connects Supabase.
          </div>
        )}
        {error && (
          <div role="alert" className="error-message">
            {error}
          </div>
        )}
        <p className="help-text" style={{ marginTop: 20, marginBottom: 0 }}>
          Need access or a password reset? Contact your super admin.
        </p>
        <Link href="/">Back to workspace</Link>
      </form>
    </div>
  );
}
