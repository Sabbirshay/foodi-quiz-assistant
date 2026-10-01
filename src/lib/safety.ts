import { CronExpressionParser } from "cron-parser";
import { modelAnswerSchema, type QuizInput, type Source } from "./contracts";
export function canonicalPortalUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.hostname !== "sites.google.com" ||
      u.port ||
      u.username ||
      u.password
    )
      return null;
    if (/%2f|%5c|%2e|\\/i.test(value)) return null;
    if (!u.pathname.startsWith("/view/foodi-service-guidelines/")) return null;
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname.replace(/\/$/, "");
    return u.toString();
  } catch {
    return null;
  }
}
export function nextRun(
  cron: string,
  timezone: string,
  now = new Date(),
): string {
  if (cron.trim().split(/\s+/).length !== 5)
    throw new Error("Use a five-field cron expression.");
  new Intl.DateTimeFormat("en", { timeZone: timezone }).format(now);
  const interval = CronExpressionParser.parse(cron, {
    tz: timezone,
    currentDate: now,
  });
  const first = interval.next().toDate();
  let previous = first;
  for (let i = 0; i < 100; i++) {
    const following = interval.next().toDate();
    if (following.getTime() - previous.getTime() < 15 * 60 * 1000)
      throw new Error("Leave at least 15 minutes between crawls.");
    previous = following;
  }
  return first.toISOString();
}
const normalize = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
export function validateAnswer(
  raw: unknown,
  input: QuizInput,
  sources: Source[],
) {
  const a = modelAnswerSchema.parse(raw);
  if (
    new Set(a.selected).size !== a.selected.length ||
    a.selected.some((i) => i >= input.options.length)
  )
    throw new Error("Invalid selected options.");
  if (
    a.status === "answered" &&
    (!a.selected.length ||
      (!input.multiple && a.selected.length !== 1) ||
      !a.evidence.length)
  )
    throw new Error("Answer requires valid selection and evidence.");
  if (a.status !== "answered" && a.selected.length)
    throw new Error("Uncertain answers cannot select options.");
  for (const e of a.evidence) {
    const s = sources.find((s) => s.id === e.source_id);
    if (!s || !normalize(s.content).includes(normalize(e.quote)))
      throw new Error("Evidence could not be verified.");
  }
  const numbers = (text: string) =>
    text
      .replace(/[০-৯]/g, (c) => String("০১২৩৪৫৬৭৮৯".indexOf(c)))
      .match(/\d+(?:[.,]\d+)*/g) ?? [];
  const allowed = new Set(numbers(a.evidence.map((e) => e.quote).join(" ")));
  if (
    a.status === "answered" &&
    numbers(a.explanation).some((n) => !allowed.has(n))
  )
    throw new Error("An explanation contains an unsupported numeric claim.");
  return a;
}
export function redactPII(s: string) {
  return s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?88)?01[3-9]\d{8}\b/g, "[phone]")
    .replace(
      /\b(?:order|payment|transaction)[\s_-]*(?:id|number|no)?[\s:#-]*[A-Z0-9-]{6,}\b/gi,
      "[reference]",
    );
}
export function searchTerms(text: string) {
  return [...new Set(text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [])]
    .filter(
      (w) =>
        w.length > 1 &&
        ![
          "the",
          "what",
          "which",
          "when",
          "does",
          "with",
          "from",
          "this",
          "that",
          "and",
          "for",
          "are",
          "can",
          "how",
          "should",
        ].includes(w),
    )
    .slice(0, 40);
}
