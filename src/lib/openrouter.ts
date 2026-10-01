import type { Model } from "./contracts";
import { database, must } from "./db";
const BASE = "https://openrouter.ai/api/v1";
let catalog: { at: number; models: Model[] } | undefined;
export async function listModels(): Promise<Model[]> {
  if (catalog && Date.now() - catalog.at < 300000) return catalog.models;
  const response = await fetch(`${BASE}/models`, {
    headers: process.env.OPENROUTER_API_KEY
      ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }
      : {},
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("Could not load the OpenRouter model catalog.");
  const json = await response.json();
  if (!Array.isArray(json.data)) throw new Error("Invalid model catalog.");
  const models = (json.data as Model[]).filter(
    (m) =>
      m.id &&
      m.supported_parameters?.includes("structured_outputs") &&
      m.architecture?.input_modalities?.includes("text") &&
      m.architecture?.output_modalities?.includes("text"),
  );
  catalog = { at: Date.now(), models };
  return models;
}
export async function generateJSON({
  modelId,
  system,
  payload,
  schema,
  name,
  userId,
  purpose,
  maxTokens = 1800,
}: {
  modelId: string;
  system: string;
  payload: unknown;
  schema: object;
  name: string;
  userId: string | null;
  purpose: "quiz" | "crawl";
  maxTokens?: number;
}): Promise<unknown> {
  if (!process.env.OPENROUTER_API_KEY)
    throw new Error("OpenRouter is not connected.");
  const model = (await listModels()).find((m) => m.id === modelId);
  if (!model) throw new Error("Choose an available structured-output model.");
  const serialized = JSON.stringify(payload);
  // Bytes deliberately overestimate input tokens, including non-Latin scripts.
  const bound =
    Buffer.byteLength(system + serialized + JSON.stringify(schema)) + 1024;
  if (bound + maxTokens > model.context_length)
    throw new Error("Evidence exceeds the selected model context.");
  const prompt = Number(model.pricing.prompt),
    completion = Number(model.pricing.completion),
    request = Number(model.pricing.request ?? 0);
  if ([prompt, completion, request].some((n) => !Number.isFinite(n) || n < 0))
    throw new Error("Model pricing is unavailable.");
  const reservation = must(
    await database().rpc("reserve_usage", {
      p_user: userId,
      p_model: modelId,
      p_purpose: purpose,
      p_amount: (bound * prompt + maxTokens * completion + request) * 1.1,
    }),
  );
  const response = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-OpenRouter-Title": "Foodi Quiz Assistant",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: serialized },
      ],
      max_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name, strict: true, schema },
      },
      provider: {
        require_parameters: true,
        data_collection: "deny",
        allow_fallbacks: false,
      },
    }),
  });
  if (!response.ok)
    throw new Error("The AI provider could not complete this request.");
  const result = await response.json();
  const cost = result.usage?.cost;
  if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0)
    must(
      await database()
        .from("usage_events")
        .update({ actual_usd: cost, status: "completed" })
        .eq("id", reservation),
    );
  // On uncertain outcomes the reservation stays charged; no automatic paid retry.
  if (result.error || result.choices?.[0]?.finish_reason !== "stop")
    throw new Error("The model did not return a complete answer.");
  const content = result.choices[0].message?.content;
  if (typeof content !== "string")
    throw new Error("Missing structured response.");
  return JSON.parse(content);
}
