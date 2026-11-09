import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ATLAS_FUNCTION_TOOLS, executeAtlasTool } from "./src/atlas-tools.mjs";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-5.4";
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
  "Puedes usar herramientas autorizadas para cálculos, conversiones de unidades, consultar la hora de Monterrey y organizar listas de tareas.",
  "Cuando uses una herramienta, explica brevemente el resultado. Nunca afirmes que guardaste, agendaste o ejecutaste algo externo si la herramienta no lo hizo.",
  "La lista de verificación se devuelve al usuario, pero no queda guardada ni programada.",
  "Para información reciente, puedes usar la búsqueda web y distinguir hechos confirmados de incertidumbre.",
  "No inventes acceso a datos privados. No solicites ni reveles claves, contraseñas o secretos."
].join(" ");

async function callResponsesAPI(input, tools) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions: assistantInstructions,
      input,
      tools,
      tool_choice: "auto",
      max_output_tokens: 1000
    })
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("OpenAI Responses error:", {
      status: response.status,
      request_id: response.headers.get("x-request-id")
    });
    const error = new Error("OpenAI no pudo completar la solicitud.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function getResponseText(data) {
  return (data.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

function getResponseCitations(data) {
  return (data.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text")
    .flatMap((part) => part.annotations || [])
    .filter((annotation) => annotation.type === "url_citation")
    .map((annotation) => annotation.url_citation || annotation)
    .filter((citation) => /^https?:\/\//i.test(citation.url || ""))
    .map((citation) => ({ title: citation.title || citation.url, url: citation.url }))
    .slice(0, 8);
}

app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, name: "ATLAS-AI", configured: Boolean(apiKey), tools: ["calculate", "get_local_datetime", "make_checklist", "convert_units"] });
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
          audio: {
            input: { transcription: { model: "gpt-live-transcribe", languages: ["es"] } },
            output: { voice: "ash" }
          }
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
    const tools = [{ type: "web_search" }, ...ATLAS_FUNCTION_TOOLS];
    let input = safeMessages;
    let data = await callResponsesAPI(input, tools);

    // Maximum of two tool rounds per request to limit loops and API usage.
    for (let round = 0; round < 2; round += 1) {
      const calls = (data.output || []).filter((item) => item.type === "function_call");
      if (!calls.length) break;

      // Preserve the complete model output (including reasoning items) before tool results.
      input = [...input, ...data.output];
      for (const call of calls) {
        let output;
        try {
          const args = JSON.parse(call.arguments || "{}");
          output = executeAtlasTool(call.name, args);
        } catch (error) {
          output = { ok: false, error: error.message || "No se pudo ejecutar la herramienta." };
        }
        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output)
        });
      }
      data = await callResponsesAPI(input, tools);
    }

    const text = getResponseText(data);
    res.set("Cache-Control", "no-store");
    res.json({
      text: text || "No pude completar la respuesta. Intenta reformular tu solicitud.",
      citations: getResponseCitations(data)
    });
  } catch (error) {
    console.error("Assistant request failed:", error.message);
    res.status(502).json({ error: "ATLAS no pudo completar la consulta. Intenta de nuevo." });
  }
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`ATLAS-AI listo en http://localhost:${port}`);
});
