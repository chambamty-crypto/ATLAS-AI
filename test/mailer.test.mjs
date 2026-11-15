import test from "node:test";
import assert from "node:assert/strict";
import { emailDeliveryConfigured, sendAccountEmail } from "../src/mailer.mjs";

test("development console mode prints verification links without SMTP", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.DEV_EMAIL_MODE;
  const logs = [];
  const originalLog = console.log;
  process.env.NODE_ENV = "development";
  process.env.DEV_EMAIL_MODE = "console";
  console.log = (...args) => logs.push(args);
  try {
    assert.equal(emailDeliveryConfigured(), true);
    const result = await sendAccountEmail({
      to: "tester@example.com",
      subject: "ATLAS verification",
      text: "http://192.168.1.20:3000/?verify=one-time-token",
      html: "<p>verification</p>"
    });
    assert.deepEqual(result, { sent: false, configured: true, developmentConsole: true });
    assert.equal(logs.length, 1);
    assert.match(logs[0][1].text, /one-time-token/);
  } finally {
    console.log = originalLog;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousMode === undefined) delete process.env.DEV_EMAIL_MODE;
    else process.env.DEV_EMAIL_MODE = previousMode;
  }
});

test("development console mode is disabled in production", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousMode = process.env.DEV_EMAIL_MODE;
  process.env.NODE_ENV = "production";
  process.env.DEV_EMAIL_MODE = "console";
  try {
    assert.equal(emailDeliveryConfigured(), false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousMode === undefined) delete process.env.DEV_EMAIL_MODE;
    else process.env.DEV_EMAIL_MODE = previousMode;
  }
});
