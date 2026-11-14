import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

const databasePath = path.join(tmpdir(), `atlas-http-${randomUUID()}.sqlite`);
process.env.ATLAS_DB_PATH = databasePath;
const store = await import("../src/auth-store.mjs");
const serverPath = fileURLToPath(new URL("../server.mjs", import.meta.url));
let child;
let baseUrl;
let firstCookie;
let secondCookie;
let conversationId;

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error("ATLAS server exited before becoming ready");
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch { /* The server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("ATLAS server did not become ready in time");
}

before(async () => {
  const first = store.createUserRecord("http-first@example.test", "test-hash");
  const second = store.createUserRecord("http-second@example.test", "test-hash");
  store.db.prepare("UPDATE users SET email_verified = 1 WHERE id IN (?, ?)").run(first.id, second.id);
  firstCookie = `atlas_session=${store.createSession(first.id).token}`;
  secondCookie = `atlas_session=${store.createSession(second.id).token}`;

  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: { ...process.env, PORT: String(port), NODE_ENV: "test", OPENAI_API_KEY: "" },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    await waitUntilReady();
  } catch (error) {
    child.kill();
    throw new Error(`${error.message}: ${stderr}`);
  }
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 2_000))]);
  }
  store.db.close();
  for (const suffix of ["", "-shm", "-wal"]) {
    try { rmSync(databasePath + suffix); } catch { /* Already removed. */ }
  }
});

test("HTTP history and history tools remain isolated between authenticated accounts", { timeout: 15_000 }, async () => {
  conversationId = randomUUID();
  const conversation = {
    id: conversationId,
    title: "Historial privado",
    updatedAt: new Date().toISOString(),
    messages: [{ role: "user", content: "Este dato pertenece únicamente a la primera cuenta." }]
  };

  const saved = await fetch(`${baseUrl}/api/conversations/${conversationId}`, {
    method: "PUT",
    headers: { cookie: firstCookie, "content-type": "application/json" },
    body: JSON.stringify({ conversation })
  });
  assert.equal(saved.status, 200);

  const firstHistory = await fetch(`${baseUrl}/api/conversations`, { headers: { cookie: firstCookie } });
  const secondHistory = await fetch(`${baseUrl}/api/conversations`, { headers: { cookie: secondCookie } });
  assert.equal((await firstHistory.json()).conversations.length, 1);
  assert.equal((await secondHistory.json()).conversations.length, 0);

  const firstSearch = await fetch(`${baseUrl}/api/tool`, {
    method: "POST",
    headers: { cookie: firstCookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "search_my_history", arguments: { query: "únicamente" } })
  });
  const secondSearch = await fetch(`${baseUrl}/api/tool`, {
    method: "POST",
    headers: { cookie: secondCookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "search_my_history", arguments: { query: "únicamente" } })
  });
  assert.equal((await firstSearch.json()).matches.length, 1);
  assert.equal((await secondSearch.json()).matches.length, 0);

  const crossAccountDelete = await fetch(`${baseUrl}/api/conversations/${conversationId}`, {
    method: "DELETE",
    headers: { cookie: secondCookie }
  });
  assert.equal(crossAccountDelete.status, 404);

  const crossOriginWrite = await fetch(`${baseUrl}/api/conversations/${conversationId}`, {
    method: "DELETE",
    headers: { cookie: firstCookie, origin: "https://attacker.example" }
  });
  assert.equal(crossOriginWrite.status, 403);

  const unauthenticated = await fetch(`${baseUrl}/api/conversations`);
  assert.equal(unauthenticated.status, 401);
});
