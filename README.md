# ATLAS-AI

Asistente personal inteligente con interfaz web, conversación por voz en tiempo real, chat de texto y herramientas controladas del lado del servidor.

## Estado

**Versión 0.8.0.** Incorpora verificación obligatoria de correo y recuperación de contraseña por enlaces de un solo uso, además de memoria personal administrable, preferencias por cuenta, búsqueda privada del historial, voz WebRTC, chat con Responses API, búsqueda web y herramientas propias.

## Requisitos

- Node.js 22.13 o posterior (incluye `node:sqlite`; en Node 22 esta API sigue marcada como experimental).
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
6. Configura `APP_URL` con el origen público de ATLAS y completa las variables SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) para enviar verificación y recuperación. En producción, `APP_URL` debe usar HTTPS.
7. Asegúrate de que `ATLAS_DB_PATH` apunte a una carpeta persistente y escribible. Por defecto se crea `./data/atlas.sqlite`.
8. Inicia el servidor:
   `npm run dev`
9. Abre [http://localhost:3000](http://localhost:3000) y crea una cuenta.

## Capacidades

- **Conversación por voz:** WebRTC con OpenAI Realtime y credenciales temporales emitidas por el servidor. La sesión recibe las funciones permitidas y el navegador remite sus llamadas a `/api/tool`; la lógica se ejecuta en el servidor.
- **Chat inteligente:** Responses API, modelo configurable mediante `OPENAI_MODEL` (predeterminado: `gpt-5.4`), con búsqueda web.
- **Cuentas:** registro e inicio de sesión con correo y contraseña (mínimo 12 caracteres). Las contraseñas se derivan con scrypt y salt individual; nunca se guardan en texto plano.
- **Verificación de correo:** enlaces aleatorios de un solo uso, almacenados como hash y con vencimiento de 24 horas. El acceso queda bloqueado hasta verificar. Los enlaces se envían por SMTP configurable.
- **Recuperación de contraseña:** enlaces de un solo uso con vencimiento de una hora. Al cambiar la contraseña se revocan todas las sesiones activas. Las respuestas de solicitud no revelan si un correo está registrado.
- **Sesiones:** token aleatorio opaco en cookie `HttpOnly`, `SameSite=Strict`, con `Secure` en producción y expiración de siete días. El servidor conserva únicamente el hash SHA-256 del token.
- **Historial privado y persistente:** conversaciones guardadas en SQLite por cuenta, disponibles al volver a iniciar sesión. El panel permite buscar por título o contenido, abrir una conversación, eliminar una individual o borrar todo el historial. Cada conversación se guarda de forma independiente para evitar que una pestaña sobrescriba el historial completo de otra; máximo 40 conversaciones y 100 mensajes por conversación.
- **Memoria personal:** el usuario agrega y elimina recuerdos explícitamente; máximo 50 recuerdos por cuenta. Puede desactivar su uso sin borrar lo guardado.
- **Preferencias individuales:** idioma, tono y nivel de detalle se guardan por cuenta y personalizan chat y voz.
- **Búsqueda en el historial:** `search_my_history` encuentra coincidencias únicamente en las conversaciones de la cuenta autenticada. Es una herramienta de lectura; no modifica mensajes ni comparte datos entre usuarios.
- **Cálculos:** herramienta de aritmética con analizador propio; no utiliza `eval` ni ejecuta código del usuario.
- **Fecha y hora:** consulta la hora local de Monterrey, Nuevo León.
- **Listas de tareas:** convierte instrucciones del usuario en listas de verificación. Esta versión no las agenda ni las persiste.
- **Conversión de unidades:** longitud (m, km, cm, mi, ft), masa (kg, g, lb, oz), temperatura (°C, °F, K) y volumen (L, mL, galón estadounidense).
- **Citas web:** muestra enlaces de fuentes cuando Responses API devuelve anotaciones.

## Historial de conversaciones

El navegador carga el historial de la cuenta autenticada desde el servidor. Los cambios se guardan por conversación en la ruta /api/conversations/:id; esto reduce el tamaño de cada escritura y evita que guardar una conversación reemplace accidentalmente las demás. El panel muestra el número de conversaciones y permite filtrar por título o por texto de los mensajes, abrir una conversación y eliminarla individualmente. La acción de borrar todo requiere confirmación.

El almacenamiento definitivo está en SQLite, no en localStorage. Para conservarlo entre reinicios o despliegues, monta un volumen persistente en la ruta indicada por ATLAS_DB_PATH. El historial no se comparte entre cuentas. Las operaciones de escritura requieren sesión y validación de origen.

## Arquitectura de herramientas

El modelo solo puede solicitar las funciones declaradas en `src/atlas-tools.mjs` y la herramienta de contexto personal `search_my_history` de `src/user-context.mjs`. El servidor valida y ejecuta cada función con el ID de usuario obtenido de la sesión; para Realtime se omite el indicador `strict`, mientras Responses conserva JSON Schema estricto. El ciclo de Responses se limita a dos rondas por petición.

La ruta `/api/tool` solo permite nombres incluidos en la lista blanca. Las funciones actuales incluyen cálculos, fecha/hora, listas no persistentes, conversiones y búsqueda de solo lectura en el historial privado del usuario autenticado. No realizan cambios externos. No hay acceso a shell, sistema de archivos, correo, pagos, cuentas o servicios externos de escritura.

## Pruebas

Ejecuta las pruebas unitarias:

```bash
npm test
```

El workflow de GitHub Actions ejecuta npm test en los cambios de main y en pull requests. Estas pruebas no sustituyen una prueba de integración con una API key real ni una prueba manual de voz en navegador.

## Seguridad y límites

- La API key principal solo se utiliza en el servidor; el frontend recibe un client secret temporal exclusivamente para iniciar Realtime.
- Nunca publiques el archivo `.env` ni compartas tu clave en chats o capturas.
- Los endpoints sensibles exigen sesión autenticada; las operaciones de escritura comprueban el origen. Se añaden cabeceras de seguridad y límites básicos por IP en memoria.
- SQLite es apropiado para una instancia única con disco persistente. En plataformas con disco efímero o varias réplicas, configura un volumen persistente o migra a PostgreSQL antes de escalar. Conserva copias de seguridad cifradas del archivo de base de datos.
- La autenticación incluye verificación de correo y recuperación por SMTP, pero todavía no incorpora MFA ni eliminación de cuenta. Configura y prueba SMTP antes de producción; sin SMTP, las cuentas nuevas quedan pendientes de verificación y no pueden iniciar sesión. No consideres el servicio listo para un lanzamiento público amplio sin MFA, monitoreo, límites distribuidos y revisión de seguridad.
- En producción sirve ATLAS exclusivamente detrás de HTTPS y define `NODE_ENV=production`; el proxy TLS debe conservar el host original.
- Aunque las herramientas actuales son de solo cálculo/lectura, mantén autenticación, HTTPS, límites distribuidos, monitoreo y controles de costos antes de una exposición pública.
- Antes de incorporar acciones con efectos reales, exige permisos por usuario, confirmación explícita y registro de auditoría.

## Estructura

```
ATLAS-AI/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── atlas-tools.mjs
│   ├── auth-store.mjs
│   ├── conversation-validation.mjs
│   └── user-context.mjs
├── test/
│   ├── atlas-tools.test.mjs
│   ├── auth-store.test.mjs
│   ├── conversation-validation.test.mjs
│   └── user-context.test.mjs
├── .github/workflows/test.yml
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.mjs
```

## Documentación oficial

- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Responses API y herramientas](https://developers.openai.com/api/docs/guides/tools)
- [Realtime con herramientas](https://developers.openai.com/api/docs/guides/realtime-mcp)
- [Conversaciones Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [WebRTC para voz](https://developers.openai.com/api/docs/guides/voice-webrtc)

## Próximas etapas

- Verificación de correo, recuperación de cuenta y MFA.
- Migración a PostgreSQL para despliegues multi-instancia.
- Recordatorios persistentes con confirmación del usuario.
- Integraciones externas con permisos granulares.
- Herramientas para archivos y calendario con control de acceso.
- Pruebas de integración y despliegue seguro.
