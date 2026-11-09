import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

const databasePath = path.join(tmpdir(), `atlas-memory-${randomUUID()}.sqlite`);
process.env.ATLAS_DB_PATH = databasePath;
const store = await import("../src/auth-store.mjs");
const context = await import("../src/user-context.mjs");

test("memories and preferences remain isolated per account", () => {
  const first = store.createUserRecord("memory-one@example.test", "hash");
  const second = store.createUserRecord("memory-two@example.test", "hash");
  const memory = context.addMemory(first.id, "preferences", "Prefiere respuestas directas.");
  context.savePreferences(first.id, { response_tone: "direct", memory_enabled: true });
  assert.equal(context.listMemories(first.id).length, 1);
  assert.equal(context.listMemories(second.id).length, 0);
  assert.equal(context.getPreferences(first.id).response_tone, "direct");
  assert.equal(context.getPreferences(second.id).response_tone, "professional");
  assert.equal(context.deleteMemory(second.id, memory.id), false);
  assert.equal(context.deleteMemory(first.id, memory.id), true);
});

test("memory can be disabled without deleting saved entries", () => {
  const user = store.createUserRecord("memory-toggle@example.test", "hash");
  context.addMemory(user.id, "work", "Trabaja en un proyecto personal.");
  context.savePreferences(user.id, { memory_enabled: false });
  assert.equal(context.buildUserContext(user.id).memories.length, 0);
  assert.equal(context.listMemories(user.id).length, 1);
});

test("history search only returns conversations owned by the current user", () => {
  const first = store.createUserRecord("search-one@example.test", "hash");
  const second = store.createUserRecord("search-two@example.test", "hash");
  const conversation = {
    id: randomUUID(),
    title: "Proyecto privado",
    updatedAt: new Date().toISOString(),
    messages: [{ role: "user", content: "Mi proyecto secreto se llama ATLAS." }]
  };
  store.replaceConversations(first.id, [conversation]);
  assert.equal(context.searchUserHistory(first.id, "ATLAS").matches.length, 1);
  assert.equal(context.searchUserHistory(second.id, "ATLAS").matches.length, 0);
  assert.throws(() => context.searchUserHistory(first.id, "x"));
});

test.after(() => {
  store.db.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    try { rmSync(databasePath + suffix); } catch {}
  }
});
