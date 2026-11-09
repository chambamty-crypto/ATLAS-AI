import { DatabaseSync } from "node:sqlite";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const scrypt = promisify(scryptCallback);
const dbPath = path.resolve(process.env.ATLAS_DB_PATH || "./data/atlas.sqlite");
process.umask(0o077);
fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(dbPath);
try { fs.chmodSync(dbPath, 0o600); } catch { /* Some mounted filesystems do not support chmod. */ }
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS account_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS account_tokens_user_purpose_idx ON account_tokens(user_id,purpose);
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

const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
if (!userColumns.includes("email_verified")) db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");

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
  return { id, email, createdAt, emailVerified: false };
}

export function findUserByEmail(email) {
  return db.prepare("SELECT id,email,password_hash,created_at,email_verified FROM users WHERE email = ?").get(email);
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

export function saveConversation(userId, conversation) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO conversations (id,user_id,title,messages_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, messages_json=excluded.messages_json, updated_at=excluded.updated_at WHERE conversations.user_id=excluded.user_id")
      .run(conversation.id, userId, conversation.title, JSON.stringify(conversation.messages), conversation.updatedAt);

    const owned = db.prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?").get(conversation.id, userId);
    if (!owned) throw new Error("La conversación no pertenece a esta cuenta.");

    db.prepare("DELETE FROM conversations WHERE user_id = ? AND id NOT IN (SELECT id FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 40)")
      .run(userId, userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const row = db.prepare("SELECT id,title,messages_json,updated_at AS updatedAt FROM conversations WHERE id = ? AND user_id = ?")
    .get(conversation.id, userId);
  return row ? { id: row.id, title: row.title, updatedAt: row.updatedAt, messages: JSON.parse(row.messages_json) } : null;
}

export function deleteConversation(userId, conversationId) {
  return db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").run(conversationId, userId).changes > 0;
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


export function createAccountToken(userId, purpose, ttlMs) {
  if (!["verify_email", "reset_password"].includes(purpose)) throw new Error("Token purpose not allowed.");
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare("DELETE FROM account_tokens WHERE user_id = ? AND purpose = ?").run(userId, purpose);
  db.prepare("INSERT INTO account_tokens (token_hash,user_id,purpose,expires_at,created_at) VALUES (?,?,?,?,?)")
    .run(tokenDigest(token), userId, purpose, now + ttlMs, now);
  db.prepare("DELETE FROM account_tokens WHERE expires_at <= ?").run(now);
  return token;
}

export function consumeAccountToken(token, purpose) {
  if (typeof token !== "string" || token.length < 20 || token.length > 128) return null;
  const digest = tokenDigest(token);
  const row = db.prepare("SELECT users.id,users.email FROM account_tokens JOIN users ON users.id=account_tokens.user_id WHERE account_tokens.token_hash=? AND account_tokens.purpose=? AND account_tokens.expires_at>?")
    .get(digest, purpose, Date.now());
  if (!row) return null;
  db.prepare("DELETE FROM account_tokens WHERE token_hash=?").run(digest);
  if (purpose === "verify_email") db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(row.id);
  return row;
}

export function updatePasswordAndRevokeSessions(userId, passwordHash) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(passwordHash, userId);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM account_tokens WHERE user_id=?").run(userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
