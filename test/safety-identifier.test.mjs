import test from "node:test";
import assert from "node:assert/strict";
import { createSafetyIdentifier } from "../src/safety-identifier.mjs";

test("creates a stable opaque safety identifier for an account", () => {
  const first = createSafetyIdentifier("account-123");
  assert.equal(first, createSafetyIdentifier("account-123"));
  assert.notEqual(first, createSafetyIdentifier("account-456"));
  assert.match(first, /^atlas_[a-f0-9]{32}$/);
  assert.equal(first.includes("account-123"), false);
});

test("rejects missing account identifiers", () => {
  assert.throws(() => createSafetyIdentifier(""), /required/);
  assert.throws(() => createSafetyIdentifier(null), /required/);
});
