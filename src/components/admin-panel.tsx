"use client";
import { useState, useEffect, useTransition } from "react";
import { ImageReview } from "./image-review";
import { useRouter } from "next/navigation";
import {
  Settings2,
  Clock3,
  ScanSearch,
  RefreshCw,
  Play,
  Check,
  X,
  BookOpen,
  Users,
  LoaderCircle,
  ExternalLink,
  Activity,
} from "lucide-react";
import {
  defaultSettings,
  settingsSchema,
  type Settings,
  type Model,
  type Candidate,
  type Member,
  PORTAL_URL,
  SPREADSHEET_URL,
} from "@/lib/contracts";
type Job = {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  error_code: string | null;
  stats: Record<string, number>;
};
type Props = {
  connected: boolean;
  openrouter: boolean;
  localWorker: boolean;
  initial: Settings & { worker_seen_at?: string; next_run_at?: string };
  candidates: Candidate[];
  jobs: Job[];
  members: Member[];
  usage: number;
};
export function AdminPanel({
  connected,
  openrouter,
  localWorker,
  initial,
  candidates,
  jobs,
  members,
  usage,
}: Props) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [lastRefresh, setLastRefresh] = useState<string>("");
  function refreshActivity() {
    startRefresh(() => router.refresh());
    setLastRefresh(new Date().toLocaleTimeString());
  }
  const [imagesReviewed, setImagesReviewed] = useState<Record<string, boolean>>(
    {},
  );
  const [tab, setTab] = useState("settings"),
    [settings, setSettings] = useState<Settings>(() =>
      settingsSchema.parse(
        Object.fromEntries(
          Object.keys(defaultSettings).map((key) => [
            key,
            initial?.[key as keyof Settings] ??
              defaultSettings[key as keyof Settings],
          ]),
        ),
      ),
    ),
    [models, setModels] = useState<Model[]>([]),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [next, setNext] = useState(initial.next_run_at);
  useEffect(() => {
    if (tab !== "runs") return;
    const timer = setInterval(() => {
      startRefresh(() => router.refresh());
      setLastRefresh(new Date().toLocaleTimeString());
    }, 10000);
    return () => clearInterval(timer);
  }, [tab, router]);
  async function request(path: string, method: string, payload?: unknown) {
    const r = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    return data;
  }
  async function action(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      if (!connected)
        throw new Error(
          "Connect a Supabase project before changing live settings.",
        );
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy("");
    }
  }
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }
  const shown = models.filter((m) =>
    (m.name + " " + m.id).toLowerCase().includes(search.toLowerCase()),
  );
  const workerOnline =
    initial.worker_seen_at &&
    Date.now() - Date.parse(initial.worker_seen_at) < 120000;
  const selected = (id: string) => models.find((m) => m.id === id);
  function modelControl(label: string, key: "answer_model" | "crawler_model") {
    const m = selected(settings[key]);
    const choices = shown.filter(
      (model) =>
        key !== "crawler_model" ||
        model.architecture?.input_modalities?.includes("image"),
    );
    return (
      <div>
        <label className="field-label" htmlFor={key}>
          {label}
        </label>
        <select
          id={key}
          value={settings[key]}
          onChange={(e) => update(key, e.target.value)}
        >
          <option value="">Select a model</option>
          {settings[key] && !choices.some((m) => m.id === settings[key]) && (
            <option value={settings[key]}>
              {m?.name ?? settings[key]} ·{" "}
              {m
                ? m.architecture?.input_modalities?.includes("image")
                  ? "Vision · reads images"
                  : "Text only"
                : "Load models to check capabilities"}
            </option>
          )}
          {choices.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ·{" "}
              {m.architecture?.input_modalities?.includes("image")
                ? "Vision · reads images"
                : "Text only"}
            </option>
          ))}
        </select>
        {m && (
          <div style={{ marginTop: 10 }}>
            <span className="badge">
              {m.architecture?.input_modalities?.includes("image")
                ? "Vision · reads images"
                : "Text only · no image input"}
            </span>
            <p className="help-text">
              {m.architecture?.input_modalities?.includes("image")
                ? "Supports image input for SOP text and flowchart extraction. Check extracted steps and branches against the original before approval."
                : "Reads written text only. Cannot extract guidance directly from SOP images or flowcharts."}
            </p>
          </div>
        )}
        {key === "crawler_model" &&
          m &&
          !m.architecture?.input_modalities?.includes("image") && (
            <p className="error-message">
              This saved model is text-only. Choose a vision-capable model
              before your next crawl.
            </p>
          )}
        {m ? (
          <p className="help-text">
            ${(Number(m.pricing.prompt) * 1e6).toFixed(2)} input / $
            {(Number(m.pricing.completion) * 1e6).toFixed(2)} output per 1M
            tokens · {m.context_length.toLocaleString()} context
          </p>
        ) : (
          <p className="help-text">
            Load the live OpenRouter catalog to choose a model.
          </p>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE, YOUR CONTROLS</div>
          <h1>Super admin</h1>
          <p>Choose the intelligence. Keep the knowledge current.</p>
        </div>
        <span className="heading-icon">
          <Settings2 size={26} />
        </span>
      </div>
      <div className="connection-list">
        <span>
          Supabase <b>{connected ? "Connected" : "Not connected"}</b>
        </span>
        <span>
          OpenRouter <b>{openrouter ? "Key configured" : "Key needed"}</b>
        </span>
        <span>
          Crawler <b>{workerOnline ? "Online" : "Offline"}</b>
        </span>
        <span>
          Today’s reserved / used <b>${usage.toFixed(4)}</b>
        </span>
      </div>
      <div className="tabs" role="tablist" aria-label="Administration">
        {[
          ["settings", "Models & schedule", Settings2],
          ["reviews", `Review queue (${candidates.length})`, BookOpen],
          ["runs", "Crawl activity", Activity],
          ["members", "Employees", Users],
        ].map(([id, label, Icon]) => (
          <button
            key={id as string}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id as string)}
          >
            {typeof Icon !== "string" && <Icon size={15} />} {label as string}
          </button>
        ))}
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {tab === "settings" && (
        <>
          <div className="admin-grid">
            <section className="panel">
              <div className="panel-heading">
                <span className="step-number green">
                  <Settings2 size={17} />
                </span>
                <div>
                  <h2>AI models</h2>
                  <p>Separate models for answering and extraction.</p>
                </div>
              </div>
              <div className="section-body">
                <div className="toolbar">
                  <input
                    aria-label="Filter models"
                    placeholder="Search models by name or provider…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    className="secondary-button"
                    disabled={!!busy}
                    onClick={() =>
                      action("models", async () => {
                        setModels(
                          (await request("/api/admin/models", "GET")).models,
                        );
                        setNotice(
                          "Live OpenRouter catalog loaded. Only text models with structured outputs are listed.",
                        );
                      })
                    }
                  >
                    {busy === "models" ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <RefreshCw size={15} />
                    )}{" "}
                    Load models
                  </button>
                </div>
                {modelControl("Quiz answering model", "answer_model")}
                {modelControl("Crawler analysis model", "crawler_model")}
                <p className="help-text">
                  The crawler model must support images. Vision requests reserve
                  the model’s full input-context cost within your spending
                  limits. Crawlee loads the pages. Your crawler model identifies
                  policy sections and returns exact source excerpts for review.
                </p>
                <div className="field-row">
                  <div>
                    <label className="field-label" htmlFor="daily-budget">
                      Daily budget (USD)
                    </label>
                    <input
                      id="daily-budget"
                      type="number"
                      min="0"
                      max="1000"
                      step="0.1"
                      value={settings.daily_budget_usd}
                      onChange={(e) =>
                        update("daily_budget_usd", Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="call-budget">
                      Maximum per AI call (USD)
                    </label>
                    <input
                      id="call-budget"
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      value={settings.max_call_usd}
                      onChange={(e) =>
                        update("max_call_usd", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                <p className="help-text">
                  A zero budget disables paid AI calls. Budgets include both
                  quiz answers and crawler analysis.
                </p>
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <span className="step-number">
                  <Clock3 size={17} />
                </span>
                <div>
                  <h2>Crawl schedule</h2>
                  <p>Keep the knowledge base up to date.</p>
                </div>
              </div>
              <div className="section-body">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.schedule_enabled}
                    onChange={(e) =>
                      update("schedule_enabled", e.target.checked)
                    }
                  />{" "}
                  Enable scheduled crawling
                </label>
                <label className="field-label" htmlFor="cron">
                  Cron expression
                </label>
                <input
                  id="cron"
                  value={settings.cron_expression}
                  onChange={(e) => update("cron_expression", e.target.value)}
                  placeholder="0 */12 * * *"
                />
                <p className="help-text">
                  Minute · hour · day · month · weekday. Default: every 12
                  hours.
                </p>
                <label className="field-label" htmlFor="timezone">
                  Timezone
                </label>
                <select
                  id="timezone"
                  value={settings.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                >
                  <option>Asia/Dhaka</option>
                  <option>UTC</option>
                  <option>Asia/Singapore</option>
                </select>
                <div className="field-row">
                  <div>
                    <label className="field-label" htmlFor="max-pages">
                      Maximum pages per crawl
                    </label>
                    <input
                      id="max-pages"
                      type="number"
                      min="1"
                      max="200"
                      value={settings.max_pages}
                      onChange={(e) =>
                        update("max_pages", Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="stale-hours">
                      Source age limit (hours)
                    </label>
                    <input
                      id="stale-hours"
                      type="number"
                      min="1"
                      max="168"
                      value={settings.stale_hours}
                      onChange={(e) =>
                        update("stale_hours", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
                <p className="help-text">
                  Next run:{" "}
                  {next
                    ? new Date(next).toLocaleString("en-GB", {
                        timeZone: settings.timezone,
                      }) +
                      " " +
                      settings.timezone
                    : "Schedule is paused"}
                </p>
                <a
                  className="inline-link help-text"
                  href={PORTAL_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source: Foodi CE Portal
                </a>
                <p className="help-text">
                  Schedules run only while your local crawler is running. Keep
                  the schedule paused for manual crawls. New and changed pages
                  need your approval before publication.
                </p>
              </div>
            </section>
          </div>
          <div className="save-bar">
            <p className="help-text">
              API keys are configured securely on the server and are never
              displayed here.
            </p>
            <button
              className="primary-button"
              disabled={!!busy}
              onClick={() =>
                action("save", async () => {
                  const payload = Object.fromEntries(
                    Object.keys(defaultSettings).map((k) => [
                      k,
                      settings[k as keyof Settings],
                    ]),
                  );
                  const data = await request(
                    "/api/admin/settings",
                    "PUT",
                    payload,
                  );
                  setNext(data.next_run_at);
                  setNotice("Models and schedule saved.");
                })
              }
            >
              {busy === "save" ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}{" "}
              Save settings
            </button>
          </div>
        </>
      )}
      {tab === "reviews" && (
        <>
          <div className="toolbar">
            <p className="help-text">
              Review source changes, then publish approved pages to the
              knowledge base.
            </p>
            <button
              className="primary-button"
              disabled={!!busy}
              onClick={() =>
                action("publish", async () => {
                  await request("/api/admin/jobs", "POST", { kind: "publish" });
                  setNotice(
                    "Publication queued. The worker will write and verify the spreadsheet before activating the index.",
                  );
                })
              }
            >
              Publish approved
            </button>
            <a
              className="secondary-button"
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} /> Spreadsheet
            </a>
          </div>
          {candidates.length ? (
            candidates.map((c) => (
              <article className="panel review-card" key={c.id}>
                <div className="save-bar" style={{ marginTop: 0 }}>
                  <h2>{c.title}</h2>
                  <span className="badge">{c.status}</span>
                </div>
                <a
                  href={c.url}
                  className="inline-link help-text"
                  target="_blank"
                  rel="noreferrer"
                >
                  View source
                </a>
                {c.coverage_notes.length > 0 && (
                  <div className="error-message">
                    Coverage gaps: {c.coverage_notes.join("; ")}
                  </div>
                )}
                <div className="admin-grid">
                  <div>
                    <h3 className="section-title">Previous approved text</h3>
                    <pre>
                      {c.previous_content ||
                        "New source — no approved version yet."}
                    </pre>
                  </div>
                  <div>
                    <h3 className="section-title">New extracted text</h3>
                    <pre>{c.content}</pre>
                  </div>
                </div>
                {c.content.includes("Image fingerprint:") && (
                  <ImageReview
                    key={c.id + c.hash}
                    id={c.id}
                    hash={c.hash}
                    onReviewed={(checked) =>
                      setImagesReviewed((current) => ({
                        ...current,
                        [c.id]: checked,
                      }))
                    }
                  />
                )}
                {c.status === "pending" && (
                  <div className="review-actions">
                    <button
                      className="primary-button"
                      disabled={
                        !!busy ||
                        c.coverage_notes.length > 0 ||
                        (c.content.includes("Image fingerprint:") &&
                          !imagesReviewed[c.id])
                      }
                      onClick={() =>
                        action(c.id, async () => {
                          await request("/api/admin/reviews", "POST", {
                            id: c.id,
                            hash: c.hash,
                            decision: "approved",
                            images_reviewed: !!imagesReviewed[c.id],
                          });
                          setNotice("Source approved. Publish when ready.");
                        })
                      }
                    >
                      <Check size={16} /> Approve
                    </button>
                    <button
                      className="secondary-button"
                      disabled={!!busy}
                      onClick={() =>
                        action(c.id, async () => {
                          await request("/api/admin/reviews", "POST", {
                            id: c.id,
                            hash: c.hash,
                            decision: "rejected",
                          });
                          setNotice("Candidate rejected.");
                        })
                      }
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="panel empty-state">
              <BookOpen size={30} />
              <h3>No sources waiting for review</h3>
              <p>Run a crawl to discover new or updated guidance.</p>
            </div>
          )}
        </>
      )}
      {tab === "runs" && (
        <>
          <div className="notice">
            {localWorker
              ? "Use Start local crawler below to connect this device."
              : "On your local device, open the local admin panel and start the crawler, or run pnpm worker in the project folder. This hosted dashboard can queue jobs once that device is online."}
          </div>
          <div className="toolbar">
            {localWorker && (
              <button
                className="secondary-button"
                disabled={!!busy || !!workerOnline}
                onClick={() =>
                  action("worker", async () => {
                    const result = await request(
                      "/api/admin/worker",
                      "POST",
                      {},
                    );
                    setNotice(result.message);
                  })
                }
              >
                Start local crawler
              </button>
            )}
            <p className="help-text">
              Start the crawler on your local device, then run a crawl here.
              Keep your device awake until crawling and publication finish.
            </p>
            <button
              className="primary-button"
              disabled={!!busy}
              onClick={() =>
                action("crawl", async () => {
                  await request("/api/admin/jobs", "POST", { kind: "crawl" });
                  setNotice(
                    "Crawl queued. Refresh activity to see its progress.",
                  );
                })
              }
            >
              <Play size={16} /> Run crawl now
            </button>
            <button
              className="secondary-button"
              onClick={refreshActivity}
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />{" "}
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <p className="help-text" role="status">
            Activity checks automatically every 10 seconds.
            {lastRefresh && ` Last check: ${lastRefresh}.`}
          </p>
          <section className="panel">
            {jobs.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Started</th>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td>{new Date(j.created_at).toLocaleString()}</td>
                        <td>{j.kind}</td>
                        <td>
                          <span className="badge">{j.status}</span>
                        </td>
                        <td>
                          {j.error_code && (
                            <p>
                              {j.error_code === "crawl_budget_limit"
                                ? "Stopped: AI budget reservation exceeds the daily or per-call limit. Review Models & schedule before retrying."
                                : j.error_code.replaceAll("_", " ")}
                            </p>
                          )}
                          {Object.entries(j.stats)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" · ") ||
                            (j.status === "running"
                              ? "Starting or processing a page; progress appears after the next worker update."
                              : "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <ScanSearch size={30} />
                <h3>No crawl activity yet</h3>
                <p>
                  Your first crawl will appear here with its status and
                  coverage.
                </p>
              </div>
            )}
          </section>
        </>
      )}
      {tab === "members" && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>Employee access</h2>
            </div>
            <div className="section-body">
              <p className="help-text">
                Create an account and share the initial password securely with
                the employee.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    data = new FormData(form);
                  void action("member", async () => {
                    await request("/api/admin/members", "POST", {
                      email: data.get("email"),
                      password: data.get("password"),
                      role: data.get("role"),
                    });
                    form.reset();
                    setNotice("Account created. No email was sent.");
                  });
                }}
              >
                <div className="field-row">
                  <div>
                    <label htmlFor="member-email" className="field-label">
                      Email
                    </label>
                    <input
                      id="member-email"
                      name="email"
                      type="email"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="member-password" className="field-label">
                      Initial password
                    </label>
                    <input
                      id="member-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={100}
                      required
                    />
                  </div>
                </div>
                <label className="field-label" htmlFor="member-role">
                  Role
                </label>
                <select id="member-role" name="role">
                  <option value="employee">Employee</option>
                  <option value="super_admin">Super admin</option>
                </select>
                <button
                  className="primary-button"
                  style={{ marginTop: 20 }}
                  disabled={!!busy}
                >
                  Create account
                </button>
              </form>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Access</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.email}</td>
                      <td>{m.role.replace("_", " ")}</td>
                      <td>{m.active ? "Active" : "Disabled"}</td>
                      <td>
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() =>
                            action(m.id, async () => {
                              await request("/api/admin/members", "PATCH", {
                                id: m.id,
                                active: !m.active,
                              });
                              setNotice("Employee access updated.");
                            })
                          }
                        >
                          {m.active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
