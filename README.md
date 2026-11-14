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
│   ├── request-limiter.mjs
│   ├── safety-identifier.mjs
│   └── user-context.mjs
├── test/
│   ├── atlas-tools.test.mjs
│   ├── auth-store.test.mjs
│   ├── conversation-validation.test.mjs
│   ├── frontend-history.test.mjs
│   ├── request-limiter.test.mjs
│   ├── safety-identifier.test.mjs
│   ├── server-contract.test.mjs
│   ├── server-http.test.mjs
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

## Estado y siguientes hitos

La verificación de correo y la recuperación de contraseña ya están implementadas; requieren configurar y probar un proveedor SMTP real. La memoria explícita, las preferencias por cuenta y la búsqueda privada del historial también están implementadas.

La rama de mantenimiento v0.8.1 añade identificadores de seguridad seudonimizados para las solicitudes de cada cuenta, desactiva el almacenamiento de respuestas en la API cuando el flujo no necesita estado remoto y limita el crecimiento del registro local de rate limiting. Esto no sustituye límites distribuidos en producción.

Antes de un lanzamiento público, los siguientes hitos siguen pendientes:

1. Ejecutar y revisar CI en Node.js 22 y 24.
2. Probar registro, verificación SMTP, recuperación, chat y voz con credenciales de un entorno de prueba.
3. Completar una revisión de seguridad independiente; ya se añade una prueba HTTP automatizada de aislamiento entre dos cuentas.
4. Incorporar MFA, eliminación/exportación de cuenta, monitoreo y límites distribuidos.
5. Migrar a PostgreSQL antes de operar con varias instancias.
6. Agregar nuevas integraciones solo con permisos granulares, confirmación explícita y auditoría.

No se considera validada una integración externa hasta que una prueba real confirme su comportamiento. La voz requiere HTTPS (o localhost), permiso de micrófono, crédito y acceso habilitado a Realtime API.


## Desarrollo con presupuesto cero

ATLAS-AI no necesita contratar hosting para seguir desarrollándose. Mientras no exista presupuesto, la decisión recomendada es **mantenerlo como proyecto privado de ejecución local y validación continua**, sin publicarlo como servicio para usuarios externos.

- El repositorio público y GitHub Actions sirven para conservar el código y ejecutar las pruebas automatizadas. La ejecución verde de CI no implica que exista un servidor público funcionando.
- Para probarlo, usa una computadora propia con Node.js 22.13 o posterior y ejecuta `npm install`, `npm test` y después `npm run dev`. La aplicación queda disponible en `http://localhost:3000`.
- El chat con modelos de OpenAI y la voz Realtime requieren una API key y pueden generar cargos por uso. Si no hay presupuesto, no habilites esas llamadas ni compartas una clave prestada.
- El registro normal exige verificación por correo. Sin SMTP configurado, no se puede completar el flujo de alta de una cuenta; no se debe desactivar esa protección para aparentar que el registro funciona.
- No recomiendo por ahora un hosting gratuito con disco efímero: ATLAS guarda cuentas, sesiones, historial, recuerdos y preferencias en SQLite. Si el proveedor borra el disco al reiniciar, se perderían esos datos.
- No abras el servidor de desarrollo a Internet ni publiques el archivo `.env`, la base de datos o credenciales.

### Ruta de trabajo sin gastar

1. Mantener las pruebas automatizadas y corregir regresiones.
2. Mejorar interfaz, accesibilidad, documentación y pruebas con datos ficticios sin llamadas de pago.
3. Preparar exportación y respaldo local de SQLite antes de cualquier despliegue.
4. Cuando exista presupuesto o un equipo de pruebas, evaluar un servidor con almacenamiento persistente, HTTPS, SMTP y límites de gasto de API.

**Decisión de despliegue:** no contratar ni desplegar públicamente por ahora. Esta es la opción más segura y honesta con los recursos disponibles; evita costos inesperados y pérdida de datos.
