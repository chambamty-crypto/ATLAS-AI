# ATLAS-AI

Asistente personal inteligente con interfaz web, conversación por voz en tiempo real, chat de texto y herramientas controladas del lado del servidor.

## Estado

**Versión 0.5.0 (en preparación).** Añade cuentas con contraseña, sesiones seguras y almacenamiento SQLite del historial por usuario, además de voz WebRTC, chat con Responses API, búsqueda web y cuatro herramientas propias.

## Requisitos

- Node.js 22.13 o posterior (incluye `node:sqlite`).
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
6. Asegúrate de que `ATLAS_DB_PATH` apunte a una carpeta persistente y escribible. Por defecto se crea `./data/atlas.sqlite`.
7. Inicia el servidor:
   `npm run dev`
8. Abre [http://localhost:3000](http://localhost:3000) y crea una cuenta.

## Capacidades

- **Conversación por voz:** WebRTC con OpenAI Realtime y credenciales temporales emitidas por el servidor. La sesión recibe las funciones permitidas y el navegador remite sus llamadas a `/api/tool`; la lógica se ejecuta en el servidor.
- **Chat inteligente:** Responses API, modelo configurable mediante `OPENAI_MODEL` (predeterminado: `gpt-5.4`), con búsqueda web.
- **Cuentas:** registro e inicio de sesión con correo y contraseña (mínimo 12 caracteres). Las contraseñas se derivan con scrypt y salt individual; nunca se guardan en texto plano.
- **Sesiones:** token aleatorio opaco en cookie `HttpOnly`, `SameSite=Strict`, con `Secure` en producción y expiración de siete días. El servidor conserva únicamente el hash SHA-256 del token.
- **Historial privado:** conversaciones persistidas en SQLite y vinculadas al ID de usuario. Las consultas y escrituras se limitan al usuario autenticado; máximo 40 conversaciones y 100 mensajes por conversación.
- **Cálculos:** herramienta de aritmética con analizador propio; no utiliza `eval` ni ejecuta código del usuario.
- **Fecha y hora:** consulta la hora local de Monterrey, Nuevo León.
- **Listas de tareas:** convierte instrucciones del usuario en listas de verificación. Esta versión no las agenda ni las persiste.
- **Conversión de unidades:** longitud (m, km, cm, mi, ft), masa (kg, g, lb, oz), temperatura (°C, °F, K) y volumen (L, mL, galón estadounidense).
- **Citas web:** muestra enlaces de fuentes cuando Responses API devuelve anotaciones.

## Arquitectura de herramientas

El modelo solo puede solicitar las funciones declaradas en `src/atlas-tools.mjs`. Responses API y Realtime comparten la misma lista permitida; para Realtime se omite el indicador `strict`, mientras Responses conserva JSON Schema estricto. El servidor valida y ejecuta cada función. El ciclo de Responses se limita a dos rondas por petición.

La ruta `/api/tool` solo permite nombres incluidos en la lista blanca. Las funciones actuales son cálculos, fecha/hora, listas no persistentes y conversiones: no realizan cambios externos. No hay acceso a shell, sistema de archivos, correo, pagos, cuentas o servicios externos de escritura.

## Pruebas

Ejecuta las pruebas unitarias:

```bash
npm test
```

Estas pruebas no sustituyen una prueba de integración con una API key real ni una prueba manual de voz en navegador.

## Seguridad y límites

- La API key principal solo se utiliza en el servidor; el frontend recibe un client secret temporal exclusivamente para iniciar Realtime.
- Nunca publiques el archivo `.env` ni compartas tu clave en chats o capturas.
- Los endpoints sensibles exigen sesión autenticada; las operaciones de escritura comprueban el origen. Se añaden cabeceras de seguridad y límites básicos por IP en memoria.
- SQLite es apropiado para una instancia única con disco persistente. En plataformas con disco efímero o varias réplicas, configura un volumen persistente o migra a PostgreSQL antes de escalar. Conserva copias de seguridad cifradas del archivo de base de datos.
- La autenticación local no incluye verificación de correo, recuperación de contraseña, MFA ni eliminación de cuenta. No la consideres lista para un lanzamiento público amplio sin esos controles, monitoreo, límites distribuidos y revisión de seguridad.
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
│   └── auth-store.mjs
├── test/
│   ├── atlas-tools.test.mjs
│   └── auth-store.test.mjs
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
