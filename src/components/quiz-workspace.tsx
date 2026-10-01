"use client";
import { useState } from "react";
import {
  Sparkles,
  Plus,
  X,
  ArrowUpRight,
  Copy,
  Check,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { QuizAnswer, QuizInput } from "@/lib/contracts";
import { demoAnswer, demoQuestion } from "@/lib/demo";
const letters = "ABCDEFGH";
export function QuizWorkspace({
  connected,
  signedIn,
  sourceCount,
}: {
  connected: boolean;
  signedIn: boolean;
  sourceCount: number;
}) {
  const [question, setQuestion] = useState(""),
    [options, setOptions] = useState(["", "", "", ""]),
    [multiple, setMultiple] = useState(false),
    [language, setLanguage] = useState("en"),
    [answer, setAnswer] = useState<QuizAnswer | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState<QuizInput | null>(null);
  function invalidate() {
    setAnswer(null);
    setSubmitted(null);
    setError("");
  }
  function clear() {
    setQuestion("");
    setOptions(["", "", "", ""]);
    setAnswer(null);
    setSubmitted(null);
    setError("");
  }
  function example() {
    setQuestion(demoQuestion.question);
    setOptions(demoQuestion.options);
    setMultiple(false);
    setLanguage("en");
    setAnswer(demoAnswer);
    setSubmitted(demoQuestion);
    setError("");
  }
  async function solve(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAnswer(null);
    if (!connected) {
      setError(
        "Your workspace is not connected yet. The super admin needs to finish setup.",
      );
      return;
    }
    if (!signedIn) {
      location.href = "/login";
      return;
    }
    setBusy(true);
    const input = { question, options, multiple, language } as QuizInput;
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnswer(data);
      setSubmitted(input);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not check this question.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${answer?.selected.map((i) => `${letters[i]}. ${submitted?.options[i]}`).join("\n")}\n\n${answer?.explanation}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        "Copy is unavailable in this browser. Select and copy the answer text.",
      );
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
          <h1>Your next answer, backed by knowledge.</h1>
          <p>
            Add your quiz question and options. We’ll find the guidance behind
            the answer.
          </p>
        </div>
        <span className="heading-icon">
          <GraduationIcon />
        </span>
      </div>
      <div className="quiz-grid">
        <section className="panel question-panel">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div>
              <h2>Ask a quiz question</h2>
              <p>Bring the question. We’ll connect the dots.</p>
            </div>
            <button
              className="text-button reset"
              onClick={clear}
              disabled={busy}
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
          <form onSubmit={solve}>
            <fieldset disabled={busy} className="quiz-fields">
              <label className="field-label" htmlFor="question">
                Quiz question <span>Required</span>
              </label>
              <textarea
                id="question"
                required
                minLength={8}
                maxLength={4000}
                value={question}
                onChange={(e) => {
                  invalidate();
                  setQuestion(e.target.value);
                }}
                placeholder="Paste your question here, in English or Bangla…"
                rows={5}
              />
              <div className="options-heading">
                <label className="field-label">Answer options</label>
                <span>{options.length} options</span>
              </div>
              <div className="options-list">
                {options.map((value, i) => (
                  <div className="option-input" key={i}>
                    <span>{letters[i]}</span>
                    <input
                      aria-label={`Option ${letters[i]}`}
                      required
                      maxLength={1000}
                      value={value}
                      onChange={(e) => {
                        invalidate();
                        setOptions(
                          options.map((v, j) => (j === i ? e.target.value : v)),
                        );
                      }}
                      placeholder={`Enter option ${letters[i]}`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remove option ${letters[i]}`}
                        onClick={() => (
                          invalidate(),
                          setOptions(options.filter((_, j) => j !== i))
                        )}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="option-actions">
                <button
                  type="button"
                  className="text-button"
                  disabled={options.length >= 8}
                  onClick={() => {
                    invalidate();
                    setOptions([...options, ""]);
                  }}
                >
                  <Plus size={15} /> Add option
                </button>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={multiple}
                    onChange={(e) => {
                      invalidate();
                      setMultiple(e.target.checked);
                    }}
                  />{" "}
                  Multiple correct answers
                </label>
              </div>
              <div className="form-bottom">
                <div>
                  <label htmlFor="language" className="field-label">
                    Answer language
                  </label>
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => {
                      invalidate();
                      setLanguage(e.target.value);
                    }}
                  >
                    <option value="en">English</option>
                    <option value="bn">বাংলা</option>
                  </select>
                </div>
                <button className="primary-button" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Sparkles size={18} />
                  )}{" "}
                  {busy ? "Checking the knowledge base…" : "Find the answer"}
                </button>
              </div>
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              <div className="privacy-note">
                <ShieldCheck size={14} /> Share quiz content only. Leave out
                customer details.
              </div>
            </fieldset>
          </form>
        </section>
        <section
          className="panel answer-panel"
          aria-live="polite"
          aria-busy={busy}
        >
          <div className="panel-heading">
            <span className="step-number green">02</span>
            <div>
              <h2>Your answer</h2>
              <p>Evidence first. Guesswork never.</p>
            </div>
            {answer?.status === "answered" && (
              <span className="badge green">Supported</span>
            )}
          </div>
          {busy ? (
            <div className="answer-empty">
              <span className="answer-symbol">
                <LoaderCircle size={32} className="spin" />
              </span>
              <h3>Looking for supporting guidance</h3>
              <p>Checking your options against approved sources.</p>
            </div>
          ) : answer ? (
            <div className="answer-content">
              {answer.demo && (
                <div className="demo-label">
                  SYNTHETIC EXAMPLE · NOT FOODI POLICY
                </div>
              )}
              {answer.status === "answered" ? (
                <>
                  <div className="result-label">
                    <CheckCircle2 size={16} /> Recommended answer
                  </div>
                  {answer.selected.map((i) => (
                    <div className="selected-answer" key={i}>
                      <span>{letters[i]}</span>
                      <strong>{submitted?.options[i]}</strong>
                      <Check size={19} />
                    </div>
                  ))}
                </>
              ) : (
                <div className="uncertain">
                  <CircleHelp size={22} />
                  <h3>{answer.status.replaceAll("_", " ")}</h3>
                </div>
              )}
              <h3 className="section-title">Why this answer?</h3>
              <p className="explanation">{answer.explanation}</p>
              <div className="evidence-heading">
                <BookOpen size={16} />
                <h3>Supporting evidence</h3>
                <span>{answer.evidence.length}</span>
              </div>
              {answer.evidence.map((e, i) => {
                const source = answer.sources.find((s) => s.id === e.source_id);
                return (
                  <div className="evidence-card" key={i}>
                    <strong>{source?.title}</strong>
                    <blockquote>“{e.quote}”</blockquote>
                    {source?.url && (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        View source <ArrowUpRight size={14} />
                      </a>
                    )}
                    {source?.checked_at && (
                      <small>
                        Source checked{" "}
                        {new Date(source.checked_at).toLocaleDateString()}
                      </small>
                    )}
                  </div>
                );
              })}
              <div className="answer-footer">
                <small>{answer.model}</small>
                <button className="secondary-button" onClick={copy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                  {copied ? "Copied" : "Copy answer"}
                </button>
              </div>
            </div>
          ) : (
            <div className="answer-empty">
              <span className="answer-symbol">
                <Sparkles size={32} />
              </span>
              <h3>A well-supported answer starts here.</h3>
              <p>
                Add a question and its options to see the recommended answer, a
                clear explanation, and the sources behind it.
              </p>
              <div className="empty-steps">
                <span>
                  <CheckCircle2 size={14} /> Selected option
                </span>
                <span>
                  <BookOpen size={14} /> Source evidence
                </span>
              </div>
              <button className="text-button example-button" onClick={example}>
                Try a training example <ArrowRight size={15} />
              </button>
            </div>
          )}
        </section>
      </div>
      <div className="bottom-cards">
        <div>
          <span className="mini-icon">
            <BookOpen size={20} />
          </span>
          <div>
            <h3>One trusted knowledge base</h3>
            <p>
              {sourceCount
                ? `${sourceCount} approved source pages ready to reference.`
                : "Answers will use reviewed CE Portal guidance."}
            </p>
          </div>
        </div>
        <div>
          <span className="mini-icon">
            <CircleHelp size={20} />
          </span>
          <div>
            <h3>Clarity when sources fall short</h3>
            <p>Missing or conflicting evidence is flagged, never filled in.</p>
          </div>
        </div>
        <div>
          <span className="mini-icon">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h3>You make the final choice</h3>
            <p>Review the reasoning before submitting your quiz.</p>
          </div>
        </div>
      </div>
    </>
  );
}
function GraduationIcon() {
  return <Sparkles size={27} />;
}
