const startButton = document.querySelector("#start-button");
const endButton = document.querySelector("#end-button");
const statusMessage = document.querySelector("#status-message");
const systemStatus = document.querySelector("#system-status");
const connectionLabel = document.querySelector("#connection-label");
const orbCaption = document.querySelector("#orb-caption");
const orb = document.querySelector("#orb");
const transcript = document.querySelector("#transcript");
const remoteAudio = document.querySelector("#remote-audio");

let peer = null;
let channel = null;
let localStream = null;

function setStatus(message, state = "idle") {
  statusMessage.textContent = message;
  systemStatus.textContent = state === "connected" ? "SISTEMA CONECTADO" : state === "connecting" ? "INICIANDO SISTEMA" : "SISTEMA EN ESPERA";
  connectionLabel.textContent = state === "connected" ? "CONECTADO" : state === "connecting" ? "CONECTANDO" : "DESCONECTADO";
  document.querySelector(".console").classList.toggle("connected", state === "connected");
  orbCaption.textContent = state === "connected" ? "ATLAS ESTÁ ESCUCHANDO" : state === "connecting" ? "ESTABLECIENDO ENLACE" : "ATLAS ESTÁ LISTO";
}

function addTranscript(role, text) {
  if (!text?.trim()) return;
  const empty = transcript.querySelector(".empty-state");
  if (empty) empty.remove();
  const item = document.createElement("div");
  item.className = `line ${role === "TÚ" ? "user" : "atlas"}`;
  const label = document.createElement("strong");
  label.textContent = role;
  const content = document.createElement("span");
  content.textContent = text;
  item.append(label, content);
  transcript.append(item);
  transcript.scrollTop = transcript.scrollHeight;
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
  }
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    addTranscript("TÚ", event.transcript);
  }
  if (event.type === "response.output_audio_transcript.done") {
    addTranscript("ATLAS", event.transcript);
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
      try { handleEvent(JSON.parse(message.data)); } catch { /* Ignore malformed events. */ }
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
  channel = null;
  peer = null;
  localStream = null;
  remoteAudio.srcObject = null;
  orb.classList.remove("speaking");
  endButton.disabled = true;
  if (updateStatus) setStatus("La conversación ha finalizado.");
}

startButton.addEventListener("click", startConversation);
endButton.addEventListener("click", () => endConversation());
