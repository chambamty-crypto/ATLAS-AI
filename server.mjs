import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

let recentRequests = new Map();
function sessionRateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const recent = (recentRequests.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 8) {
    return res.status(429).json({ error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." });
  }
  recent.push(now);
  recentRequests.set(key, recent);
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "ATLAS-AI", configured: Boolean(apiKey) });
});

app.post("/api/session", sessionRateLimit, async (_req, res) => {
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
        session: {
          type: "realtime",
          model: "gpt-realtime",
          instructions: [
            "Eres ATLAS-AI, un asistente personal avanzado.",
            "Habla siempre en español latinoamericano, salvo que el usuario solicite otro idioma.",
            "Tu personalidad es serena, inteligente, precisa, cordial y profesional.",
            "Tu voz debe transmitir calma, seguridad y sofisticación, sin imitar a personajes ni actores existentes.",
            "Responde de forma natural y concisa; amplía cuando sea útil."
          ].join(" "),
          audio: {
            output: { voice: "ash" }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI Realtime error:", data);
      return res.status(response.status).json({ error: "No se pudo iniciar la sesión de voz." });
    }

    res.set("Cache-Control", "no-store");
    res.json({ client_secret: data.value, expires_at: data.expires_at });
  } catch (error) {
    console.error("Session creation failed:", error);
    res.status(500).json({ error: "Error interno al preparar la sesión de voz." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`ATLAS-AI listo en http://localhost:${port}`);
});
