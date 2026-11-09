import { randomUUID } from "node:crypto";
import { db } from "./auth-store.mjs";

db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'es-MX',
    response_tone TEXT NOT NULL DEFAULT 'professional',
    response_length TEXT NOT NULL DEFAULT 'balanced',
    timezone TEXT NOT NULL DEFAULT 'America/Monterrey',
    memory_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS user_memories_user_updated_idx ON user_memories(user_id, updated_at DESC);
`);

const DEFAULT_PREFERENCES = {
  language: "es-MX",
  response_tone: "professional",
  response_length: "balanced",
  timezone: "America/Monterrey",
  memory_enabled: true
};

export function getPreferences(userId) {
  const row = db.prepare("SELECT language,response_tone,response_length,timezone,memory_enabled,updated_at AS updatedAt FROM user_preferences WHERE user_id = ?").get(userId);
  if (!row) return { ...DEFAULT_PREFERENCES };
  return { ...row, memory_enabled: Boolean(row.memory_enabled) };
}

export function savePreferences(userId, values) {
  const current = getPreferences(userId);
  const next = { ...current, ...values };
  db.prepare(`
    INSERT INTO user_preferences (user_id,language,response_tone,response_length,timezone,memory_enabled,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      language=excluded.language,response_tone=excluded.response_tone,
      response_length=excluded.response_length,timezone=excluded.timezone,
      memory_enabled=excluded.memory_enabled,updated_at=excluded.updated_at
  `).run(userId,next.language,next.response_tone,next.response_length,next.timezone,next.memory_enabled ? 1 : 0,new Date().toISOString());
  return getPreferences(userId);
}

export function listMemories(userId) {
  return db.prepare("SELECT id,category,content,created_at AS createdAt,updated_at AS updatedAt FROM user_memories WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50")
    .all(userId);
}

export function addMemory(userId, category, content) {
  if (!["personal","work","interests","goals","preferences","other"].includes(category)) throw new Error("Categoría de memoria no válida.");
  if (typeof content !== "string" || !content.trim() || content.trim().length > 500) throw new Error("La memoria debe contener entre 1 y 500 caracteres.");
  if (db.prepare("SELECT COUNT(*) AS total FROM user_memories WHERE user_id = ?").get(userId).total >= 50) throw new Error("Has alcanzado el límite de 50 recuerdos. Elimina alguno antes de agregar otro.");
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO user_memories (id,user_id,category,content,created_at,updated_at) VALUES (?,?,?,?,?,?)")
    .run(id,userId,category,content.trim(),now,now);
  return db.prepare("SELECT id,category,content,created_at AS createdAt,updated_at AS updatedAt FROM user_memories WHERE id = ? AND user_id = ?").get(id,userId);
}

export function deleteMemory(userId, memoryId) {
  return db.prepare("DELETE FROM user_memories WHERE id = ? AND user_id = ?").run(memoryId,userId).changes > 0;
}

export function buildUserContext(userId) {
  const preferences = getPreferences(userId);
  const memories = preferences.memory_enabled ? listMemories(userId).slice(0, 20) : [];
  return { preferences, memories };
}

export function searchUserHistory(userId, query) {
  if (typeof query !== "string" || query.trim().length < 2 || query.trim().length > 100) {
    throw new Error("La búsqueda debe tener entre 2 y 100 caracteres.");
  }
  const needle = query.trim().toLocaleLowerCase();
  const conversations = db.prepare("SELECT id,title,updated_at AS updatedAt,messages_json AS messagesJson FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20").all(userId);
  const matches = [];
  for (const conversation of conversations) {
    let messages;
    try { messages = JSON.parse(conversation.messagesJson); } catch { continue; }
    for (const message of messages) {
      if (typeof message.content !== "string" || !message.content.toLocaleLowerCase().includes(needle)) continue;
      matches.push({
        conversation_id: conversation.id,
        title: conversation.title,
        updated_at: conversation.updatedAt,
        role: message.role,
        excerpt: message.content.slice(0, 500)
      });
      if (matches.length >= 5) return { ok: true, query: query.trim(), matches };
    }
  }
  return { ok: true, query: query.trim(), matches };
}

export const USER_HISTORY_TOOL = {
  type: "function",
  name: "search_my_history",
  description: "Busca en el historial privado de conversaciones de la cuenta actualmente autenticada. Úsala cuando el usuario haga referencia a algo que dijo o pidió antes. Nunca busca datos de otras cuentas.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Término o frase breve para buscar en las conversaciones anteriores." }
    },
    required: ["query"],
    additionalProperties: false
  }
};

export function executeUserTool(name, args, userId) {
  if (name !== "search_my_history") throw new Error("Herramienta personal no autorizada.");
  return searchUserHistory(userId,args.query);
}
