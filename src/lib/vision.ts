import { z } from "zod";
export const imageAnalysisSchema = z
  .object({
    index: z.number().int().min(0).max(7),
    kind: z.enum(["flowchart", "text", "decorative", "unreadable"]),
    title: z.string().max(300),
    text: z.string().max(12000),
    nodes: z
      .array(
        z
          .object({
            id: z.string().min(1).max(40),
            text: z.string().min(1).max(1500),
          })
          .strict(),
      )
      .max(80),
    edges: z
      .array(
        z
          .object({
            from: z.string().min(1).max(40),
            to: z.string().min(1).max(40),
            condition: z.string().max(1000),
          })
          .strict(),
      )
      .max(120),
    coverage_notes: z.array(z.string().max(500)).max(20),
  })
  .strict();
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;
export type ReviewImage = {
  source_url: string;
  data_url: string;
  sha256: string;
  analysis: ImageAnalysis;
};
export function validateImages(raw: unknown, count: number): ImageAnalysis[] {
  const images = z.array(imageAnalysisSchema).max(8).parse(raw);
  if (
    images.length !== count ||
    new Set(images.map((i) => i.index)).size !== count ||
    images.some((i) => i.index >= count)
  )
    throw new Error("Incomplete image analysis.");
  for (const image of images) {
    const ids = new Set(image.nodes.map((n) => n.id));
    if (
      ids.size !== image.nodes.length ||
      image.edges.some((e) => !ids.has(e.from) || !ids.has(e.to))
    )
      throw new Error("Invalid flowchart connections.");
    if (
      image.kind === "flowchart" &&
      (!image.nodes.length || !image.edges.length)
    )
      throw new Error("Flowchart is missing steps or connections.");
    if (image.kind === "text" && !image.text.trim())
      throw new Error("Missing image transcription.");
  }
  return images.sort((a, b) => a.index - b.index);
}
export function renderImage(image: ReviewImage) {
  const a = image.analysis;
  return `\n\n[Image ${a.index + 1}: ${a.title}]\nSource image: ${image.source_url}\nImage fingerprint: ${image.sha256}\n${a.text}\n${a.nodes.map((n) => `Step ${n.id}: ${n.text}`).join("\n")}\n${a.edges.map((e) => `${e.from} → ${e.to}${e.condition ? ` [${e.condition}]` : ""}`).join("\n")}`;
}
