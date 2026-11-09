# ATLAS-AI

Asistente personal inteligente con interfaz web, conversación por voz en tiempo real, chat de texto y herramientas controladas del lado del servidor.

## Estado

**Versión 0.3.0.** Incluye historial local, voz WebRTC, chat con Responses API, búsqueda web y function calling con herramientas propias y limitadas.

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

## Capacidades

- **Conversación por voz:** WebRTC con OpenAI Realtime y credenciales temporales emitidas por el servidor.
- **Chat inteligente:** Responses API, modelo configurable mediante `OPENAI_MODEL` (predeterminado: `gpt-5.4`), con búsqueda web.
- **Historial local:** las conversaciones se guardan en el almacenamiento local del navegador. No se sincronizan entre dispositivos ni se guardan en una base de datos.
- **Cálculos:** herramienta de aritmética con analizador propio; no utiliza `eval` ni ejecuta código del usuario.
- **Fecha y hora:** consulta la hora local de Monterrey, Nuevo León.
- **Listas de tareas:** convierte instrucciones del usuario en listas de verificación. Esta primera versión no las agenda ni las persiste.
- **Citas web:** muestra enlaces de fuentes cuando Responses API devuelve anotaciones.

## Arquitectura de herramientas

El modelo solo puede solicitar las funciones declaradas en `src/atlas-tools.mjs`. El servidor valida los argumentos, ejecuta una función de la lista permitida y devuelve el resultado a Responses API. Se limita el ciclo a dos rondas de herramientas por petición.

No hay acceso a shell, sistema de archivos, correo, pagos, cuentas o servicios externos de escritura. Para añadir una acción con efectos reales se requerirá autenticación, permisos por usuario, confirmación explícita y registro de auditoría.

## Pruebas

Ejecuta las pruebas unitarias de las herramientas:

```bash
npm test
```

Estas pruebas no sustituyen una prueba de integración con una API key real.

## Seguridad y límites

- La API key principal solo se utiliza en el servidor; el frontend recibe un client secret temporal exclusivamente para iniciar Realtime.
- Nunca publiques el archivo `.env` ni compartas tu clave en chats o capturas.
- El historial se almacena en el navegador del usuario. Borrar los datos del sitio o usar otro navegador/perfil puede eliminar o separar ese historial.
- Los endpoints tienen límites básicos por dirección IP en memoria. No sustituyen autenticación ni protección contra abuso en producción.
- Antes de desplegar públicamente, agrega autenticación, límites distribuidos, HTTPS, monitoreo, controles de costos y almacenamiento seguro por usuario. No expongas el servidor sin esas medidas.

## Estructura

```
ATLAS-AI/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   └── atlas-tools.mjs
├── test/
│   └── atlas-tools.test.mjs
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.mjs
```

## Documentación oficial

- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Responses API y herramientas](https://developers.openai.com/api/docs/guides/tools)
- [Búsqueda web](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Realtime API](https://developers.openai.com/api/docs/guides/realtime)
- [WebRTC para voz](https://developers.openai.com/api/docs/guides/realtime-webrtc)

## Próximas etapas

- Autenticación y sincronización segura del historial.
- Recordatorios persistentes con confirmación del usuario.
- Integraciones externas con permisos granulares.
- Herramientas para archivos y calendario con control de acceso.
- Pruebas de integración y despliegue seguro.
