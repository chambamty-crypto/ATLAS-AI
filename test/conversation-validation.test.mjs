import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConversation } from "../src/conversation-validation.mjs";

const validConversation = () => ({
  id: "123e4567-e89b-12d3-a456-426614174000",
  title: "  Mi conversación  ",
  updatedAt: "2026-11-09T10:00:00.000Z",
  messages: [
    { role: "user", content: "  Hola  " },
    {
      role: "assistant",
      content: "Respuesta",
      citations: [
        { url: "https://example.com", title: "Ejemplo" },
        { url: "javascript:alert(1)", title: "No permitido" }
      ]
    }
  ]
});

test("normaliza y conserva únicamente los campos permitidos", () => {
  const normalized = normalizeConversation({ ...validConversation(), ignored: "no guardar" });
  assert.equal(normalized.title, "Mi conversación");
  assert.equal(normalized.messages[0].content, "Hola");
  assert.equal(normalized.ignored, undefined);
  assert.deepEqual(normalized.messages[1].citations, [{ url: "https://example.com", title: "Ejemplo" }]);
});

test("rechaza identificadores, fechas y títulos no válidos", () => {
  assert.throws(() => normalizeConversation({ ...validConversation(), id: "bad" }));
  assert.throws(() => normalizeConversation({ ...validConversation(), updatedAt: "fecha" }));
  assert.throws(() => normalizeConversation({ ...validConversation(), title: " ".repeat(3) }));
});

test("rechaza mensajes inválidos y límites excedidos", () => {
  assert.throws(() => normalizeConversation({ ...validConversation(), messages: [{ role: "system", content: "x" }] }));
  assert.throws(() => normalizeConversation({ ...validConversation(), messages: [{ role: "user", content: " " }] }));
  assert.throws(() => normalizeConversation({ ...validConversation(), messages: Array(101).fill({ role: "user", content: "x" }) }));
});
