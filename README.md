# ATLAS-AI

Asistente personal inteligente con interfaz web, conversación por voz en tiempo real e interacción por texto.

## Estado

**Versión 0.2.0.** Incluye interfaz de voz WebRTC, historial local de conversaciones, chat de texto y un endpoint de servidor para respuestas inteligentes con búsqueda web.

## Requisitos

- Node.js 22.6 o posterior.
- Una API key de OpenAI con acceso a Responses API y Realtime API.
- Navegador moderno con permiso de micrófono para la función de voz.

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
7. Abre [http://localhost:3000](http://localhost:3000).

## Funciones disponibles

- **Conversación por voz:** WebRTC con OpenAI Realtime y credenciales temporales emitidas por el servidor.
- **Chat de texto:** el servidor llama a Responses API usando el modelo `gpt-5.4` y la herramienta integrada `web_search`.
- **Historial local:** las conversaciones se guardan en el almacenamiento local del navegador. No se sincronizan entre dispositivos ni se guardan en una base de datos.
- **Citas web:** cuando Responses devuelve anotaciones de fuentes, la interfaz las muestra como enlaces.

## Seguridad y límites

- La API key principal solo se utiliza en el servidor; el frontend recibe un client secret temporal exclusivamente para iniciar Realtime.
- Nunca publiques el archivo `.env` ni compartas tu clave en chats o capturas.
- El historial se almacena en el navegador del usuario. Borrar los datos del sitio o usar otro navegador/perfil puede eliminar o separar ese historial.
- Los endpoints tienen límites básicos por dirección IP en memoria. No sustituyen autenticación ni protección contra abuso en producción.
- Antes de desplegar públicamente, agrega autenticación, límites distribuidos, HTTPS, monitoreo y controles de costos. No expongas el servidor sin esas medidas.

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

## Documentación oficial

- [Realtime API](https://developers.openai.com/api/docs/guides/realtime)
- [WebRTC para voz](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [Responses API](https://developers.openai.com/api/reference/responses/overview)
- [Herramienta de búsqueda web](https://developers.openai.com/api/docs/guides/tools-web-search)

## Próximas etapas

- Autenticación y sincronización segura del historial.
- Herramientas propias con permisos y confirmación para acciones sensibles.
- Ajustes de voz y preferencias de usuario.
- Pruebas automatizadas y despliegue seguro.
