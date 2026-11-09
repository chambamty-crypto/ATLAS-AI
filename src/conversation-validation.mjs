export function normalizeConversation(item) {
  if (!item || typeof item.id !== "string" || !/^[a-f0-9-]{16,64}$/i.test(item.id) ||
      typeof item.title !== "string" || !item.title.trim() || item.title.length > 100 ||
      typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt)) ||
      !Array.isArray(item.messages) || item.messages.length > 100) {
    throw new Error("Una conversación contiene datos no válidos.");
  }

  const messages = [];
  for (const message of item.messages) {
    if (!message || !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" || !message.content.trim() || message.content.length > 8000) {
      throw new Error("Un mensaje del historial no es válido.");
    }

    const clean = { role: message.role, content: message.content.trim() };
    if (Array.isArray(message.citations)) {
      clean.citations = message.citations.slice(0, 8)
        .filter((citation) => citation && typeof citation.url === "string" && /^https?:\\/\\//i.test(citation.url))
        .map((citation) => ({
          url: citation.url.slice(0, 2048),
          title: typeof citation.title === "string" ? citation.title.slice(0, 300) : citation.url.slice(0, 300)
        }));
    }
    messages.push(clean);
  }

  return {
    id: item.id,
    title: item.title.trim(),
    updatedAt: item.updatedAt,
    messages
  };
}
