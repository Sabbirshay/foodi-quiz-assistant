import test from "node:test";
import assert from "node:assert/strict";
import { generateJSON, listModels } from "../src/lib/openrouter";
const model = {
  id: "fixture/model",
  name: "Fixture model",
  context_length: 128000,
  pricing: { prompt: "0.000001", completion: "0.000002" },
  supported_parameters: ["structured_outputs"],
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
};
test("OpenRouter uses owner-selected model, strict JSON, server secrets, and budget reservation", async () => {
  const oldFetch = globalThis.fetch;
  const original = { ...process.env };
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "fixture-server-secret";
  process.env.OPENROUTER_API_KEY = "fixture-router-key";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url, body });
    if (url.endsWith("/models"))
      return Response.json({
        data: [model, { ...model, id: "no-schema", supported_parameters: [] }],
      });
    if (url.includes("/rpc/reserve_usage"))
      return Response.json("11111111-1111-1111-1111-111111111111");
    if (url.includes("/usage_events"))
      return new Response(null, { status: 204 });
    if (url.endsWith("/chat/completions")) {
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer fixture-router-key",
      );
      return Response.json({
        choices: [
          { finish_reason: "stop", message: { content: '{"ok":true}' } },
        ],
        usage: { cost: 0.001 },
      });
    }
    throw new Error("Unexpected request: " + url);
  };
  try {
    assert.equal((await listModels()).length, 1);
    const result = await generateJSON({
      modelId: model.id,
      system: "Fixture instruction",
      payload: { question: "Synthetic only" },
      schema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
        additionalProperties: false,
      },
      name: "fixture",
      userId: null,
      purpose: "quiz",
    });
    assert.deepEqual(result, { ok: true });
    const reserve = calls.findIndex((c) => c.url.includes("/reserve_usage"));
    const generation = calls.findIndex((c) =>
      c.url.endsWith("/chat/completions"),
    );
    assert.ok(reserve < generation);
    const request = calls[generation].body;
    assert.equal(request.model, model.id);
    assert.deepEqual(request.provider, {
      require_parameters: true,
      data_collection: "deny",
      allow_fallbacks: false,
    });
    assert.equal(
      (request.response_format as { type: string }).type,
      "json_schema",
    );
    await assert.rejects(
      generateJSON({
        modelId: "employee-injected-model",
        system: "x",
        payload: {},
        schema: {},
        name: "x",
        userId: null,
        purpose: "quiz",
      }),
      /available structured-output model/,
    );
  } finally {
    globalThis.fetch = oldFetch;
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "OPENROUTER_API_KEY",
    ]) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
