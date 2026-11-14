import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");

test("request limits are bounded and scoped to each route", () => {
  assert.match(server, /createRateLimiter\(\)/);
  assert.match(server, /req\.route\?\.path/);
  assert.match(server, /requestLimiter\.isAllowed\(key, maxRequests, windowMs\)/);
});

test("OpenAI requests use account-scoped opaque safety identifiers", () => {
  assert.match(server, /OpenAI-Safety-Identifier": createSafetyIdentifier\(req\.user\.id\)/);
  assert.match(server, /safety_identifier: safetyId/);
  assert.match(server, /createSafetyIdentifier\(req\.user\.id\)/);
});

test("Responses requests do not retain remote conversation state", () => {
  assert.match(server, /store: false/);
});
