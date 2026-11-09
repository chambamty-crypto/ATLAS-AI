import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

const databasePath = path.join(tmpdir(), `atlas-auth-${randomUUID()}.sqlite`);
process.env.ATLAS_DB_PATH = databasePath;
const store = await import("../src/auth-store.mjs");

test("passwords are stored as salted scrypt hashes and verified safely", async () => {
  const encoded = await store.hashPassword("una contraseña larga y segura");
  assert.match(encoded, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.equal(await store.verifyPassword("una contraseña larga y segura", encoded), true);
  assert.equal(await store.verifyPassword("otra contraseña", encoded), false);
});

test("sessions are opaque and resolve only to their account", () => {
  const first = store.createUserRecord("one@example.test", "test-hash");
  const second = store.createUserRecord("two@example.test", "test-hash");
  const session = store.createSession(first.id);
  assert.equal(store.findSessionUser(session.token).id, first.id);
  assert.equal(store.findSessionUser("not-a-session"), null);
  store.revokeSession(session.token);
  assert.equal(store.findSessionUser(session.token), null);
  assert.equal(store.findUserByEmail(second.email).id, second.id);
});

test("conversation history is isolated by account", () => {
  const first = store.createUserRecord("history-one@example.test", "test-hash");
  const second = store.createUserRecord("history-two@example.test", "test-hash");
  const conversation = {
    id: randomUUID(),
    title: "Privada",
    updatedAt: new Date().toISOString(),
    messages: [{ role: "user", content: "Mensaje privado" }]
  };
  store.replaceConversations(first.id, [conversation]);
  assert.equal(store.listConversations(first.id).length, 1);
  assert.equal(store.listConversations(second.id).length, 0);
  store.clearConversations(first.id);
  assert.equal(store.listConversations(first.id).length, 0);
});

test.after(() => {
  store.db.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    try { rmSync(databasePath + suffix); } catch {}
  }
});
