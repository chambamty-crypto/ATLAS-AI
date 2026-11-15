import test from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "../src/rate-limit.mjs";

function invoke(middleware, ip) {
  let statusCode = 200;
  let payload;
  let continued = false;
  const response = {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; }
  };
  middleware({ ip }, response, () => { continued = true; });
  return { statusCode, payload, continued };
}

test("rate limits are isolated per IP and middleware instance", () => {
  let now = 1_000;
  const loginLimit = rateLimit(2, 60_000, { now: () => now });
  const historyLimit = rateLimit(5, 60_000, { now: () => now });

  assert.equal(invoke(loginLimit, "192.0.2.1").continued, true);
  assert.equal(invoke(loginLimit, "192.0.2.1").continued, true);
  assert.equal(invoke(loginLimit, "192.0.2.1").statusCode, 429);
  assert.equal(invoke(loginLimit, "192.0.2.2").continued, true);
  assert.equal(invoke(historyLimit, "192.0.2.1").continued, true);
  now += 60_001;
  assert.equal(invoke(loginLimit, "192.0.2.1").continued, true);
});

test("a route with a shorter window does not erase another route's longer window", () => {
  let now = 5_000;
  const longWindow = rateLimit(2, 120_000, { now: () => now });
  const shortWindow = rateLimit(1, 1_000, { now: () => now });

  assert.equal(invoke(longWindow, "198.51.100.7").continued, true);
  assert.equal(invoke(shortWindow, "198.51.100.7").continued, true);
  now += 1_001;
  assert.equal(invoke(shortWindow, "198.51.100.7").continued, true);
  assert.equal(invoke(longWindow, "198.51.100.7").continued, true);
  assert.equal(invoke(longWindow, "198.51.100.7").statusCode, 429);
});
