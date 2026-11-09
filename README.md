# ATLAS-AI

Asistente personal inteligente con interfaz web y conversación por voz en tiempo real.

## Estado

**Versión inicial: 0.1.0.** Incluye interfaz visual, servidor Node.js y conexión de voz preparada con OpenAI Realtime API.

## Requisitos

- Node.js 22.6 o posterior.
- Una API key de OpenAI con acceso a Realtime API.
- Navegador moderno con permiso de micrófono.

## Instalación local

1. Clona el repositorio:
   `git clone https://github.com/chambamty-crypto/ATLAS-AI.git`
2. Entra a la carpeta:
   `cd ATLAS-AI`
3. Instala dependencias:
   `npm install`
4. Copia `.env.example` como `.env`.
5. Abre `.env` y agrega tu clave en `OPENAI_API_KEY`.
6. Inicia el servidor:
   `npm run dev`
7. Abre [http://localhost:3000](http://localhost:3000) y presiona **Iniciar conversación**.

## Seguridad

- La API key principal se utiliza únicamente en el servidor.
- El navegador recibe un client secret temporal para iniciar la sesión Realtime.
- Nunca publiques el archivo `.env` ni compartas tu clave en chats o capturas.
- El endpoint de sesión incluye un límite básico de solicitudes para desarrollo. Antes de exponer la aplicación públicamente, agrega autenticación, autorización, límites robustos, HTTPS y controles de abuso.

## Estructura

```
ATLAS-AI/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.mjs
```

## Tecnología

- Node.js y Express
- WebRTC en el navegador
- OpenAI Realtime API

La conexión de voz sigue el flujo documentado de credenciales efímeras: el servidor crea el client secret y el navegador lo usa para negociar WebRTC. Consulta la [guía oficial de Realtime](https://developers.openai.com/api/docs/guides/realtime) y la [guía oficial de WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc).

## Próximas etapas

- Historial de conversaciones.
- Herramientas para búsquedas, cálculos y tareas.
- Autenticación de usuario y controles de acceso.
- Preferencias de voz y configuración.
- Despliegue seguro.
