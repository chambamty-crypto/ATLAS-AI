import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

const requestBuckets = new Map();
function rateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const recent = (requestBuckets.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= maxRequests) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." });
    }
    recent.push(now);
    requestBuckets.set(key, recent);
    next();
  };
}

const assistantInstructions = [
  "Eres ATLAS-AI, un asistente personal avanzado.",
  "Habla en español latinoamericano, salvo que el usuario solicite otro idioma.",
  "Tu personalidad es serena, inteligente, precisa, cordial y profesional.",
  "No imites voces, personajes ni actores existentes.",
  "Responde de forma natural, útil y clara. Si una pregunta depende de información reciente, usa la búsqueda web disponible y distingue hechos confirmados de incertidumbre.",
  "No inventes que has ejecutado acciones ni que tienes acceso a datos privados que no te han proporcionado."
].join(" ");

app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, name: "ATLAS-AI", configured: Boolean(apiKey) });
});

app.post("/api/session", rateLimit(8, 60_000), async (_req, res) => {
  if (!apiKey) {
    return res.status(503).json({ error: "Falta configurar OPENAI_API_KEY en el servidor." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: "gpt-realtime",
          instructions: assistantInstructions,
          audio: { output: { voice: "ash" } }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI Realtime error:", { status: response.status, request_id: response.headers.get("x-request-id") });
      return res.status(502).json({ error: "No se pudo iniciar la sesión de voz." });
    }

    res.set("Cache-Control", "no-store");
    res.json({ client_secret: data.value, expires_at: data.expires_at });
  } catch (error) {
    console.error("Session creation failed:", error.message);
    res.status(500).json({ error: "Error interno al preparar la sesión de voz." });
  }
});

app.post("/api/assistant", rateLimit(20, 60_000), async (req, res) => {
  if (!apiKey) {
    return res.status(503).json({ error: "Falta configurar OPENAI_API_KEY en el servidor." });
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) {
    return res.status(400).json({ error: "Envía entre 1 y 12 mensajes recientes." });
  }

  const safeMessages = [];
  for (const message of messages) {
    if (!message || !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" || !message.content.trim() ||
        message.content.length > 8_000) {
      return res.status(400).json({ error: "El formato de la conversación no es válido." });
    }
    safeMessages.push({ role: message.role, content: message.content.trim() });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        instructions: assistantInstructions,
        input: safeMessages,
        tools: [{ type: "web_search" }],
        max_output_tokens: 900
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI Responses error:", { status: response.status, request_id: response.headers.get("x-request-id") });
      return res.status(502).json({ error: "ATLAS no pudo completar la consulta. Intenta de nuevo." });
    }

    const outputText = (data.output || [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text || "")
      .join("\n")
      .trim();

    const citations = (data.output || [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === "output_text")
      .flatMap((part) => part.annotations || [])
      .filter((annotation) => annotation.type === "url_citation" && /^https?:\/\//i.test(annotation.url || ""))
      .map((annotation) => ({ title: annotation.title || annotation.url, url: annotation.url }))
      .slice(0, 8);

    res.set("Cache-Control", "no-store");
    res.json({ text: outputText || "No pude generar una respuesta. ¿Puedes reformular tu pregunta?", citations });
  } catch (error) {
    console.error("Assistant request failed:", error.message);
    res.status(500).json({ error: "Error interno al procesar tu consulta." });
  }
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`ATLAS-AI listo en http://localhost:${port}`);
});
