const startButton = document.querySelector("#start-button");
const endButton = document.querySelector("#end-button");
const statusMessage = document.querySelector("#status-message");
const systemStatus = document.querySelector("#system-status");
const connectionLabel = document.querySelector("#connection-label");
const orbCaption = document.querySelector("#orb-caption");
const orb = document.querySelector("#orb");
const transcript = document.querySelector("#transcript");
const remoteAudio = document.querySelector("#remote-audio");
const historyList = document.querySelector("#history-list");
const conversationTitle = document.querySelector("#conversation-title");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-button");
const newChatButton = document.querySelector("#new-chat-button");
const clearHistoryButton = document.querySelector("#clear-history-button");

const STORAGE_KEY = "atlas-ai.conversations.v1";
const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES = 100;
let peer = null;
let channel = null;
let localStream = null;
let sendingMessage = false;

function loadConversations() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((item) => item && typeof item.id === "string" &&
      typeof item.title === "string" && Array.isArray(item.messages))
      .slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

let conversations = [];
let currentConversationId = conversations[0]?.id || null;

let saveQueue = Promise.resolve();
function persistConversations() {
  conversations = conversations.slice(0, MAX_CONVERSATIONS);
  const snapshot = JSON.stringify({ conversations });
  saveQueue = saveQueue.then(async () => {
    const response = await fetch("/api/conversations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: snapshot
    });
    if (!response.ok) throw new Error("No se pudo guardar el historial en el servidor.");
  }).catch((error) => setStatus(error.message || "No se pudo guardar el historial."));
}

function currentConversation() {
  return conversations.find((item) => item.id === currentConversationId) || null;
}

function createConversation() {
  const conversation = {
    id: crypto.randomUUID(),
    title: "Nueva conversación",
    updatedAt: new Date().toISOString(),
    messages: []
  };
  conversations.unshift(conversation);
  currentConversationId = conversation.id;
  persistConversations();
  renderConversation();
  renderHistory();
  chatInput.focus();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function renderHistory() {
  historyList.replaceChildren();
  if (!conversations.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Tus conversaciones guardadas aparecerán aquí.";
    historyList.append(empty);
    return;
  }
  for (const conversation of conversations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `history-item${conversation.id === currentConversationId ? " active" : ""}`;
    const title = document.createElement("strong");
    title.textContent = conversation.title;
    const date = document.createElement("small");
    date.textContent = formatDate(conversation.updatedAt);
    button.append(title, date);
    button.addEventListener("click", () => {
      currentConversationId = conversation.id;
      renderConversation();
      renderHistory();
    });
    historyList.append(button);
  }
}

function renderConversation() {
  transcript.replaceChildren();
  const conversation = currentConversation();
  conversationTitle.textContent = conversation?.title || "Nueva conversación";
  if (!conversation || !conversation.messages.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aquí aparecerán tus mensajes. Puedes escribir abajo o hablar con ATLAS.";
    transcript.append(empty);
    return;
  }
  for (const message of conversation.messages) renderMessage(message);
  transcript.scrollTop = transcript.scrollHeight;
}

function renderMessage(message) {
  const item = document.createElement("div");
  item.className = `line ${message.role === "user" ? "user" : "atlas"}`;
  const label = document.createElement("strong");
  label.textContent = message.role === "user" ? "TÚ" : "ATLAS";
  const content = document.createElement("span");
  content.textContent = message.content;
  item.append(label, content);
  if (Array.isArray(message.citations)) {
    for (const citation of message.citations.slice(0, 8)) {
      if (!citation || !/^https?:\/\//i.test(citation.url || "")) continue;
      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = citation.title || citation.url;
      item.append(link);
    }
  }
  transcript.append(item);
}

function addMessage(role, content, citations = []) {
  if (!content?.trim()) return;
  if (!currentConversation()) createConversation();
  const conversation = currentConversation();
  const message = { role, content: content.trim(), createdAt: new Date().toISOString() };
  if (citations.length) message.citations = citations;
  conversation.messages.push(message);
  conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
  if (role === "user" && conversation.title === "Nueva conversación") {
    conversation.title = content.trim().replace(/\s+/g, " ").slice(0, 48) || "Nueva conversación";
  }
  conversation.updatedAt = new Date().toISOString();
  conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  persistConversations();
  renderMessage(message);
  conversationTitle.textContent = conversation.title;
  renderHistory();
  transcript.scrollTop = transcript.scrollHeight;
}

function setStatus(message, state = "idle") {
  statusMessage.textContent = message;
  systemStatus.textContent = state === "connected" ? "SISTEMA CONECTADO" : state === "connecting" ? "INICIANDO SISTEMA" : "SISTEMA EN ESPERA";
  connectionLabel.textContent = state === "connected" ? "CONECTADO" : state === "connecting" ? "CONECTANDO" : "DESCONECTADO";
  document.querySelector(".console").classList.toggle("connected", state === "connected");
  orbCaption.textContent = state === "connected" ? "ATLAS ESTÁ ESCUCHANDO" : state === "connecting" ? "ESTABLECIENDO ENLACE" : "ATLAS ESTÁ LISTO";
}

const handledToolCalls = new Set();

async function handleToolCalls(response) {
  const calls = (response?.output || []).filter((item) => item.type === "function_call" && !handledToolCalls.has(item.call_id));
  if (!calls.length || channel?.readyState !== "open") return;
  orbCaption.textContent = "EJECUTANDO HERRAMIENTA";
  for (const call of calls) {
    handledToolCalls.add(call.call_id);
    let result;
    try {
      const toolResponse = await fetch("/api/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: call.name, arguments: JSON.parse(call.arguments || "{}") })
      });
      result = await toolResponse.json();
      if (!toolResponse.ok) result = { ok: false, error: result.error || "No se pudo ejecutar la herramienta." };
    } catch {
      result = { ok: false, error: "No se pudo ejecutar la herramienta." };
    }
    if (channel?.readyState !== "open") return;
    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) }
    }));
  }
  if (channel?.readyState === "open") channel.send(JSON.stringify({ type: "response.create" }));
}

function handleEvent(event) {
  if (event.type === "input_audio_buffer.speech_started") {
    orbCaption.textContent = "TE ESTÁ ESCUCHANDO";
    orb.classList.add("speaking");
  }
  if (event.type === "input_audio_buffer.speech_stopped") {
    orbCaption.textContent = "PROCESANDO";
    orb.classList.remove("speaking");
  }
  if (event.type === "response.output_audio.delta") {
    orbCaption.textContent = "ATLAS ESTÁ HABLANDO";
    orb.classList.add("speaking");
  }
  if (event.type === "response.done") {
    orbCaption.textContent = "ATLAS ESTÁ ESCUCHANDO";
    orb.classList.remove("speaking");
    handleToolCalls(event.response);
  }
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    addMessage("user", event.transcript);
  }
  if (event.type === "response.output_audio_transcript.done") {
    addMessage("assistant", event.transcript);
  }
  if (event.type === "error") {
    setStatus(event.error?.message || "Ocurrió un error en la conversación.", "connected");
  }
}

async function startConversation() {
  startButton.disabled = true;
  setStatus("Solicitando acceso al micrófono y preparando una conexión segura…", "connecting");
  try {
    const tokenResponse = await fetch("/api/session", { method: "POST" });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error || "No se pudo crear la sesión.");

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peer = new RTCPeerConnection();
    peer.ontrack = (event) => { remoteAudio.srcObject = event.streams[0]; };
    peer.onconnectionstatechange = () => {
      if (peer?.connectionState === "connected") setStatus("Conexión establecida. Puedes hablar con ATLAS.", "connected");
      if (peer?.connectionState === "failed" || peer?.connectionState === "disconnected") {
        setStatus("La conexión se interrumpió. Intenta iniciar otra vez.");
      }
    };

    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
    channel = peer.createDataChannel("oai-events");
    channel.addEventListener("message", (message) => {
      try { handleEvent(JSON.parse(message.data)); } catch { /* Ignora eventos malformados. */ }
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls?model=gpt-realtime", {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${tokenData.client_secret}`,
        "Content-Type": "application/sdp"
      }
    });
    if (!answerResponse.ok) throw new Error("OpenAI no pudo establecer la conexión de voz.");
    const answerSdp = await answerResponse.text();
    await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    endButton.disabled = false;
  } catch (error) {
    console.error(error);
    await endConversation(false);
    setStatus(error.message || "No se pudo iniciar la conversación.");
  } finally {
    startButton.disabled = false;
  }
}

async function endConversation(updateStatus = true) {
  if (channel) channel.close();
  if (peer) peer.close();
  if (localStream) localStream.getTracks().forEach((track) => track.stop());
  handledToolCalls.clear();
  channel = null;
  peer = null;
  localStream = null;
  remoteAudio.srcObject = null;
  orb.classList.remove("speaking");
  endButton.disabled = true;
  if (updateStatus) setStatus("La conversación ha finalizado.");
}

async function sendChatMessage(event) {
  event.preventDefault();
  const content = chatInput.value.trim();
  if (!content || sendingMessage) return;
  if (!currentConversation()) createConversation();
  addMessage("user", content);
  chatInput.value = "";
  sendingMessage = true;
  sendButton.disabled = true;
  chatInput.disabled = true;
  setStatus("ATLAS está preparando una respuesta…", "connecting");
  try {
    const messages = currentConversation().messages
      .filter((message) => ["user", "assistant"].includes(message.role))
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo completar la consulta.");
    addMessage("assistant", data.text, data.citations || []);
    setStatus("Respuesta recibida. ATLAS está listo.");
  } catch (error) {
    setStatus(error.message || "No se pudo contactar con ATLAS.");
  } finally {
    sendingMessage = false;
    sendButton.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

startButton.addEventListener("click", startConversation);
endButton.addEventListener("click", () => endConversation());
chatForm.addEventListener("submit", sendChatMessage);
newChatButton.addEventListener("click", createConversation);
clearHistoryButton.addEventListener("click", () => {
  if (!conversations.length || !window.confirm("¿Quieres borrar todas las conversaciones de tu cuenta?")) return;
  fetch("/api/conversations", { method: "DELETE" }).then((response) => {
    if (!response.ok) throw new Error("No se pudo borrar el historial.");
    conversations = [];
    currentConversationId = null;
    renderConversation();
    renderHistory();
  }).catch((error) => setStatus(error.message));
});

const authPanel = document.querySelector("#auth-panel");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const authToggle = document.querySelector("#auth-toggle");
const authStatus = document.querySelector("#auth-status");
const accountEmail = document.querySelector("#account-email");
let showingRegister = false;

function showAuth(message = "") {
  authPanel.hidden = false;
  appShell.hidden = true;
  authStatus.textContent = message;
  accountEmail.textContent = "";
}
async function enterAccount(user) {
  accountEmail.textContent = user.email;
  authPanel.hidden = true;
  appShell.hidden = false;
  const response = await fetch("/api/conversations");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo cargar el historial.");
  conversations = Array.isArray(data.conversations) ? data.conversations : [];
  currentConversationId = conversations[0]?.id || null;
  if (!currentConversation()) createConversation();
  else { renderConversation(); renderHistory(); }
}
async function submitAuth(event, mode) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.querySelector('input[type="email"]').value.trim();
  const password = form.querySelector('input[type="password"]').value;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  authStatus.textContent = "Verificando acceso…";
  try {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo validar la cuenta.");
    await enterAccount(data.user);
  } catch (error) {
    authStatus.textContent = error.message || "No se pudo completar el acceso.";
  } finally {
    submit.disabled = false;
  }
}
loginForm.addEventListener("submit", (event) => submitAuth(event, "login"));
registerForm.addEventListener("submit", (event) => submitAuth(event, "register"));
authToggle.addEventListener("click", () => {
  showingRegister = !showingRegister;
  loginForm.hidden = showingRegister;
  registerForm.hidden = !showingRegister;
  document.querySelector("#auth-title").textContent = showingRegister ? "Crea tu cuenta ATLAS." : "Tu espacio de inteligencia.";
  authToggle.textContent = showingRegister ? "¿Ya tienes cuenta? Iniciar sesión" : "¿No tienes cuenta? Crear una";
  authStatus.textContent = "";
});
document.querySelector("#logout-button").addEventListener("click", async () => {
  await endConversation(false);
  await fetch("/api/auth/logout", { method: "POST" });
  conversations = [];
  currentConversationId = null;
  showAuth("Has cerrado sesión.");
});
async function initializeAuth() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) return showAuth();
    const data = await response.json();
    await enterAccount(data.user);
  } catch {
    showAuth("No se pudo conectar con el servidor.");
  }
}
initializeAuth();
