import { createHash } from "node:crypto";
export function allowedImageUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      /^(lh[3-6]\.googleusercontent\.com|sites\.google\.com)$/.test(u.hostname)
    );
  } catch {
    return false;
  }
}
export async function downloadImage(url: string) {
  if (!allowedImageUrl(url)) throw new Error("Image host is not allowed.");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const type = response.headers.get("content-type")?.split(";")[0];
  if (
    !response.ok ||
    !["image/png", "image/jpeg", "image/webp"].includes(type ?? "")
  )
    throw new Error("Unsupported or unavailable image.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty image.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 2_000_000) {
      await reader.cancel();
      throw new Error("Image exceeds 2 MB.");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  if (!bytes.length) throw new Error("Empty image.");
  return {
    source_url: url,
    data_url: `data:${type};base64,${bytes.toString("base64")}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
