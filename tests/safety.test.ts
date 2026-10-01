import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalPortalUrl,
  nextRun,
  validateAnswer,
  searchTerms,
  redactPII,
} from "../src/lib/safety";
import { quizSchema } from "../src/lib/contracts";
import { demoQuestion, demoAnswer } from "../src/lib/demo";
test("crawler restricts origins, path boundaries, redirect destinations and credentials", () => {
  assert.equal(
    canonicalPortalUrl(
      "https://sites.google.com/view/foodi-service-guidelines/home?authuser=0#main",
    ),
    "https://sites.google.com/view/foodi-service-guidelines/home",
  );
  for (const bad of [
    "http://sites.google.com/view/foodi-service-guidelines/home",
    "https://sites.google.com.evil.test/view/foodi-service-guidelines/home",
    "https://sites.google.com/view/foodi-service-guidelines-evil/home",
    "https://user@sites.google.com/view/foodi-service-guidelines/home",
    "https://sites.google.com/view/foodi-service-guidelines/%2e%2e/home",
    "https://127.0.0.1/view/foodi-service-guidelines/home",
    "https://sites.google.com/view/other/home",
  ])
    assert.equal(canonicalPortalUrl(bad), null, bad);
});
test("cron honors Dhaka time and rejects overly frequent or malformed schedules", () => {
  assert.equal(
    nextRun("0 */12 * * *", "Asia/Dhaka", new Date("2026-10-01T00:00:00Z")),
    "2026-10-01T06:00:00.000Z",
  );
  assert.throws(() => nextRun("* * * * *", "Asia/Dhaka"));
  assert.throws(() => nextRun("* * * * * *", "Asia/Dhaka"));
  assert.throws(() => nextRun("0 0 * * *", "Invalid/Zone"));
});
test("quiz rejects duplicate options, hidden settings, and incomplete questions", () => {
  assert.equal(quizSchema.safeParse(demoQuestion).success, true);
  assert.equal(
    quizSchema.safeParse({ ...demoQuestion, options: ["Same", "same"] })
      .success,
    false,
  );
  assert.equal(
    quizSchema.safeParse({ ...demoQuestion, model: "injected" }).success,
    false,
  );
  assert.equal(
    quizSchema.safeParse({ ...demoQuestion, question: "?" }).success,
    false,
  );
});
const valid = () => ({
  status: demoAnswer.status,
  selected: demoAnswer.selected,
  explanation: demoAnswer.explanation,
  evidence: demoAnswer.evidence,
});
test("evidence validates exact quotes and rejects fabricated references or amounts", () => {
  assert.equal(
    validateAnswer(valid(), demoQuestion, demoAnswer.sources).status,
    "answered",
  );
  assert.throws(() =>
    validateAnswer(
      { ...valid(), evidence: [{ source_id: "invented", quote: "not real" }] },
      demoQuestion,
      demoAnswer.sources,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      {
        ...valid(),
        evidence: [
          { source_id: "training-example", quote: "Refund everyone 500 taka." },
        ],
      },
      demoQuestion,
      demoAnswer.sources,
    ),
  );
});
test("answer cardinality and selected indices enforce question type", () => {
  assert.throws(() =>
    validateAnswer(
      { ...valid(), selected: [0, 1] },
      demoQuestion,
      demoAnswer.sources,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      { ...valid(), selected: [7] },
      demoQuestion,
      demoAnswer.sources,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      { ...valid(), status: "insufficient_evidence" },
      demoQuestion,
      demoAnswer.sources,
    ),
  );
  assert.throws(() =>
    validateAnswer(
      { ...valid(), selected: [1, 1] },
      { ...demoQuestion, multiple: true },
      demoAnswer.sources,
    ),
  );
});
test("Bangla and Banglish retrieval tokens retain meaningful words", () => {
  const terms = searchTerms("রিফান্ড কখন পাওয়া যাবে refund kobe");
  assert.ok(terms.includes("রিফান্ড"));
  assert.ok(terms.includes("পাওয়া"));
  assert.ok(terms.includes("refund"));
  assert.ok(terms.includes("kobe"));
});
test("redaction removes common identifiers before provider payloads", () => {
  assert.equal(
    redactPII("Contact me at test@example.com or 01712345678"),
    "Contact me at [email] or [phone]",
  );
});
test("Bengali numeric quotes support matching translated amounts but reject changed numbers", () => {
  const source = { ...demoAnswer.sources[0], content: "সর্বোচ্চ ৫০ টাকা।" };
  const raw = {
    ...valid(),
    explanation: "Maximum 50 taka.",
    evidence: [{ source_id: source.id, quote: source.content }],
  };
  assert.equal(validateAnswer(raw, demoQuestion, [source]).status, "answered");
  assert.throws(
    () =>
      validateAnswer(
        { ...raw, explanation: "Maximum 500 taka." },
        demoQuestion,
        [source],
      ),
    /unsupported numeric/,
  );
});
test("irregular cron expressions cannot hide a rapid adjacent run", () => {
  assert.throws(
    () => nextRun("0,20,21 * * * *", "UTC", new Date("2026-10-01T00:00:01Z")),
    /15 minutes/,
  );
});
