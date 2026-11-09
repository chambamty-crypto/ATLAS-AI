import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");

test("history panel exposes search, count, list and clear controls", () => {
  for (const id of ["history-search", "history-count", "history-list", "clear-history-button"]) {
    assert.ok(html.includes('id="' + id + '"'), "Missing history control: " + id);
    assert.ok(app.includes('document.querySelector("#' + id + '")'), "Frontend does not bind: " + id);
  }
});

test("history is saved one conversation at a time", () => {
  assert.match(app, /function persistConversation\(conversation\)/);
  assert.match(app, /fetch\("\/api\/conversations\/" \+ encodeURIComponent\(conversation\.id\)/);
  assert.doesNotMatch(app, /function persistConversations\(/);
  assert.match(server, /app\.put\("\/api\/conversations\/:id", csrfGuard, requireAuth/);
});

test("text replies are attached to the conversation that initiated the request", () => {
  assert.match(app, /const conversationId = currentConversationId/);
  assert.match(app, /addMessage\("assistant", data\.text, data\.citations \|\| \[\], conversationId\)/);
});

test("individual deletion is account-protected on the server", () => {
  assert.match(app, /fetch\("\/api\/conversations\/" \+ encodeURIComponent\(id\), \{ method: "DELETE" \}\)/);
  assert.match(server, /app\.delete\("\/api\/conversations\/:id", csrfGuard, requireAuth/);
});
