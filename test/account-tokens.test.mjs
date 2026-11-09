import test from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

const databasePath = path.join(tmpdir(), `atlas-account-tokens-${randomUUID()}.sqlite`);
process.env.ATLAS_DB_PATH = databasePath;
const store = await import("../src/auth-store.mjs");

test("verification tokens are hashed, single-use, and expire", () => {
  const user = store.createUserRecord("verify@example.test", "hash");
  const token = store.createAccountToken(user.id, "verify_email", 60_000);
  assert.equal(store.findUserByEmail(user.email).email_verified, 0);
  assert.equal(store.consumeAccountToken("not-the-token", "verify_email"), null);
  assert.equal(store.consumeAccountToken(token, "reset_password"), null);
  assert.equal(store.consumeAccountToken(token, "verify_email").id, user.id);
  assert.equal(store.findUserByEmail(user.email).email_verified, 1);
  assert.equal(store.consumeAccountToken(token, "verify_email"), null);
});

test("password reset tokens revoke all active sessions after password change", () => {
  const user = store.createUserRecord("reset@example.test", "old-hash");
  const session = store.createSession(user.id);
  const token = store.createAccountToken(user.id, "reset_password", 60_000);
  const verified = store.consumeAccountToken(token, "reset_password");
  assert.equal(verified.id, user.id);
  store.updatePasswordAndRevokeSessions(user.id, "new-hash");
  assert.equal(store.findSessionUser(session.token), null);
  assert.equal(store.findUserByEmail(user.email).password_hash, "new-hash");
  assert.equal(store.consumeAccountToken(token, "reset_password"), null);
});

test("a new token invalidates the previous token for the same purpose", () => {
  const user = store.createUserRecord("rotate@example.test", "hash");
  const oldToken = store.createAccountToken(user.id, "verify_email", 60_000);
  const newToken = store.createAccountToken(user.id, "verify_email", 60_000);
  assert.equal(store.consumeAccountToken(oldToken, "verify_email"), null);
  assert.equal(store.consumeAccountToken(newToken, "verify_email").id, user.id);
});

test.after(() => {
  store.db.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    try { rmSync(databasePath + suffix); } catch {}
  }
});
