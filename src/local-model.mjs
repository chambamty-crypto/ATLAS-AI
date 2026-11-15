export async function callLocalModel({
  baseUrl = "http://127.0.0.1:11434",
  model = "qwen3:4b",
  messages,
  fetchImpl = fetch
}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("No hay mensajes para enviar al modelo local.");
  }

  let response;
  try {
    response = await fetchImpl(new URL("/api/chat", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        think: false,
        options: { num_ctx: 4096, num_predict: 1000, temperature: 0.7 }
      }),
      signal: AbortSignal.timeout(120_000)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("Ollama tardó demasiado en responder. Intenta de nuevo.");
    }
    throw new Error("No se pudo conectar con Ollama. Comprueba que esté instalado y abierto en esta computadora.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No se encontró el modelo local "${model}". Abre PowerShell y ejecuta: ollama pull ${model}`);
    }
    throw new Error("Ollama rechazó la solicitud. Comprueba que el modelo esté instalado y actualizado.");
  }

  const content = data?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("El modelo local no devolvió una respuesta de texto.");
  }
  return content.trim();
}
