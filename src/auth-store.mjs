import { DatabaseSync } from "node:sqlite";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const scrypt = promisify(scryptCallback);
const dbPath = path.resolve(process.env.ATLAS_DB_PATH || "./data/atlas.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    messages_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS conversations_user_updated_idx ON conversations(user_id, updated_at DESC);
`);

const SCRYPT_OPTIONS = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const tokenDigest = (token) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt:${salt.toString("hex")}:${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, saltHex, hashHex] = String(stored || "").split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(saltHex || "") || !/^[a-f0-9]{128}$/.test(hashHex || "")) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT_OPTIONS));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createUserRecord(email, passwordHash) {
  const id = randomBytes(16).toString("hex");
  const createdAt = new Date().toISOString();
  db.prepare("INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)").run(id, email, passwordHash, createdAt);
  return { id, email, createdAt };
}

export function findUserByEmail(email) {
  return db.prepare("SELECT id,email,password_hash,created_at FROM users WHERE email = ?").get(email);
}

export function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)")
    .run(tokenDigest(token), userId, now + SESSION_TTL_MS, now);
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  return { token, expiresAt: now + SESSION_TTL_MS };
}

export function findSessionUser(token) {
  if (!token || typeof token !== "string" || token.length > 128) return null;
  const row = db.prepare(`
    SELECT users.id, users.email, users.created_at AS createdAt, sessions.expires_at AS expiresAt
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenDigest(token), Date.now());
  return row || null;
}

export function revokeSession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenDigest(token));
}

export function listConversations(userId) {
  return db.prepare("SELECT id,title,messages_json,updated_at AS updatedAt FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 40")
    .all(userId).map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt, messages: JSON.parse(row.messages_json) }));
}

export function replaceConversations(userId, conversations) {
  const insert = db.prepare(`
    INSERT INTO conversations (id,user_id,title,messages_json,updated_at) VALUES (?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, messages_json=excluded.messages_json, updated_at=excluded.updated_at
    WHERE conversations.user_id=excluded.user_id
  `);
  db.exec("BEGIN IMMEDIATE");
  try {
    const ids = [];
    for (const item of conversations) {
      insert.run(item.id, userId, item.title, JSON.stringify(item.messages), item.updatedAt);
      ids.push(item.id);
    }
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      db.prepare(`DELETE FROM conversations WHERE user_id = ? AND id NOT IN (${placeholders})`).run(userId, ...ids);
    } else {
      db.prepare("DELETE FROM conversations WHERE user_id = ?").run(userId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listConversations(userId);
}

export function clearConversations(userId) {
  db.prepare("DELETE FROM conversations WHERE user_id = ?").run(userId);
}
