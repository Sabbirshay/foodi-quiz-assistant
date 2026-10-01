"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Workspace temporarily unavailable</h1>
        <p>
          We couldn’t load your workspace. Please retry or contact the super
          admin.
        </p>
        <button className="primary-button" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
