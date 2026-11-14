import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/request-limiter.mjs";

test("allows requests up to the configured limit and rejects the next one", () => {
  let time = 1_000;
  const limiter = createRateLimiter({ now: () => time });
  assert.equal(limiter.isAllowed("user-a", 2, 60_000), true);
  assert.equal(limiter.isAllowed("user-a", 2, 60_000), true);
  assert.equal(limiter.isAllowed("user-a", 2, 60_000), false);
  time += 60_001;
  assert.equal(limiter.isAllowed("user-a", 2, 60_000), true);
});

test("bounds memory when clients present many distinct keys", () => {
  const limiter = createRateLimiter({ maxKeys: 3, cleanupEvery: 100 });
  for (let index = 0; index < 10; index += 1) {
    assert.equal(limiter.isAllowed(`client-${index}`, 5, 60_000), true);
  }
  assert.equal(limiter.size, 3);
});

test("rejects invalid limiter configuration and calls", () => {
  assert.throws(() => createRateLimiter({ maxKeys: 0 }), /maxKeys/);
  const limiter = createRateLimiter();
  assert.throws(() => limiter.isAllowed("", 1, 1000), /parameters/);
  assert.throws(() => limiter.isAllowed("client", 0, 1000), /parameters/);
});
