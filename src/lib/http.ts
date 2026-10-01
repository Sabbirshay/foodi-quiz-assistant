import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./auth";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      { error: error.issues[0]?.message ?? "Check your input." },
      400,
    );
  return json(
    {
      error:
        "The request could not be completed. Please try again or contact your administrator.",
    },
    503,
  );
}
export async function body(request: Request) {
  const expected = process.env.APP_ORIGIN;
  if (!expected || request.headers.get("origin") !== new URL(expected).origin)
    throw new AppError("Request origin is not allowed.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("JSON is required.", 415);
  if (Number(request.headers.get("content-length")) > 20000)
    throw new AppError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 20000) {
      await reader.cancel();
      throw new AppError("Request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("Invalid JSON.");
  }
}
