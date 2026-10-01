"use client";
import { useState } from "react";
import type { ReviewImage } from "@/lib/vision";
export function ImageReview({
  id,
  hash,
  onReviewed,
}: {
  id: string;
  hash: string;
  onReviewed: (checked: boolean) => void;
}) {
  const [images, setImages] = useState<ReviewImage[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="notice">
      <h3>SOP images and flowcharts</h3>
      <p>
        Compare every original image with the extracted guidance. Check numbers,
        exceptions, and the direction and conditions of each arrow.
      </p>
      {!images && (
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const response = await fetch(
                `/api/admin/reviews?id=${encodeURIComponent(id)}`,
              );
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              if (data.hash !== hash)
                throw new Error("Source changed. Refresh the review queue.");
              setImages(data.images);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not load images.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Loading images…" : "Review original images"}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {images?.map((image, index) => (
        <details key={image.sha256 + index} open>
          <summary>
            Image {index + 1}: {image.analysis.title} ({image.analysis.kind})
          </summary>
          <img
            src={image.data_url}
            alt={`Original SOP image ${index + 1}: ${image.analysis.title}`}
            style={{
              maxWidth: "100%",
              height: "auto",
              display: "block",
              margin: "16px 0",
            }}
          />
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {image.analysis.text}
            {"\n"}
            {image.analysis.nodes.map((n) => `${n.id}: ${n.text}`).join("\n")}
            {"\n"}
            {image.analysis.edges
              .map(
                (e) =>
                  `${e.from} → ${e.to} [${e.condition || "Unconditional"}]`,
              )
              .join("\n")}
          </pre>
        </details>
      ))}
      {images && (
        <label>
          <input
            type="checkbox"
            onChange={(e) => onReviewed(e.target.checked)}
          />{" "}
          I checked all original images against the extracted text, steps, and
          decision branches.
        </label>
      )}
    </section>
  );
}
