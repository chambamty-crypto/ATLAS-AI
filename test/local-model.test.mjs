import test from "node:test";
import assert from "node:assert/strict";
import { callLocalModel } from "../src/local-model.mjs";

test("sends chat messages to the local Ollama API without credentials", async () => {
  let request;
  const result = await callLocalModel({
    model: "qwen3:4b",
    messages: [{ role: "user", content: "Hola" }],
    fetchImpl: async (url, options) => {
      request = { url: String(url), options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ message: { content: "Hola, estoy aquí." } }), { status: 200 });
    }
  });

  assert.equal(result, "Hola, estoy aquí.");
  assert.equal(request.url, "http://127.0.0.1:11434/api/chat");
  assert.equal(request.body.model, "qwen3:4b");
  assert.equal(request.body.stream, false);
  assert.deepEqual(request.body.messages, [{ role: "user", content: "Hola" }]);
  assert.equal("Authorization" in request.options.headers, false);
});

test("explains when the selected model has not been downloaded", async () => {
  await assert.rejects(
    callLocalModel({
      model: "qwen3:4b",
      messages: [{ role: "user", content: "Hola" }],
      fetchImpl: async () => new Response(JSON.stringify({ error: "model not found" }), { status: 404 })
    }),
    /ollama pull qwen3:4b/
  );
});

test("returns a useful message when Ollama is not running", async () => {
  await assert.rejects(
    callLocalModel({
      messages: [{ role: "user", content: "Hola" }],
      fetchImpl: async () => { throw new Error("ECONNREFUSED"); }
    }),
    /Comprueba que esté instalado y abierto/
  );
});
