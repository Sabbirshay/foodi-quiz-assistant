import test from "node:test";
import assert from "node:assert/strict";
import { validateImages, renderImage } from "../src/lib/vision";
import { allowedImageUrl, downloadImage } from "../worker/src/images";
const analysis = {
  index: 0,
  kind: "flowchart",
  title: "Refund SOP",
  text: "Check payment",
  nodes: [
    { id: "A", text: "Paid?" },
    { id: "B", text: "Refund" },
  ],
  edges: [{ from: "A", to: "B", condition: "Yes" }],
  coverage_notes: [],
};
test("vision preserves flowchart branches and rejects invented node references or omitted images", () => {
  const [parsed] = validateImages([analysis], 1);
  const text = renderImage({
    source_url: "https://lh3.googleusercontent.com/chart",
    data_url: "",
    sha256: "fingerprint",
    analysis: parsed,
  });
  assert.match(text, /A → B \[Yes\]/);
  assert.throws(
    () =>
      validateImages(
        [
          {
            ...analysis,
            edges: [{ from: "A", to: "missing", condition: "Yes" }],
          },
        ],
        1,
      ),
    /connections/,
  );
  assert.throws(() => validateImages([analysis], 2), /Incomplete/);
  assert.throws(() => validateImages([analysis, analysis], 2), /Incomplete/);
});
test("image downloads restrict hosts, redirects, formats and size", async () => {
  assert.equal(
    allowedImageUrl("https://lh3.googleusercontent.com/chart"),
    true,
  );
  for (const url of [
    "http://lh3.googleusercontent.com/chart",
    "https://lh3.googleusercontent.com.evil.test/x",
    "https://127.0.0.1/x",
    "https://user:pass@lh3.googleusercontent.com/x",
  ])
    assert.equal(allowedImageUrl(url), false);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.redirect, "error");
      return new Response("unsafe", {
        headers: { "content-type": "image/svg+xml" },
      });
    };
    await assert.rejects(
      downloadImage("https://lh3.googleusercontent.com/x"),
      /Unsupported/,
    );
    globalThis.fetch = async () =>
      new Response(new Uint8Array(2_000_001), {
        headers: { "content-type": "image/png" },
      });
    await assert.rejects(
      downloadImage("https://lh3.googleusercontent.com/x"),
      /exceeds/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
