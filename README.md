# ATLAS-AI

Asistente personal inteligente con interfaz web, conversación por voz en tiempo real, chat de texto y herramientas controladas del lado del servidor.

## Estado

**Versión 0.4.0.** Incluye historial local, voz WebRTC con herramientas, chat con Responses API, búsqueda web y cuatro herramientas propias con validación estricta.

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

- **Conversación por voz:** WebRTC con OpenAI Realtime y credenciales temporales emitidas por el servidor. La sesión recibe las funciones permitidas y el navegador remite sus llamadas a `/api/tool`; la lógica se ejecuta en el servidor.
- **Chat inteligente:** Responses API, modelo configurable mediante `OPENAI_MODEL` (predeterminado: `gpt-5.4`), con búsqueda web.
- **Historial local:** las conversaciones se guardan en el almacenamiento local del navegador. No se sincronizan entre dispositivos ni se guardan en una base de datos.
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
- El historial se almacena en el navegador del usuario. Borrar los datos del sitio o usar otro navegador/perfil puede eliminar o separar ese historial.
- Los endpoints tienen límites básicos por dirección IP en memoria. No sustituyen autenticación ni protección contra abuso en producción.
- Aunque las herramientas actuales son de solo cálculo/lectura, `/api/tool` no sustituye autenticación. No expongas el servidor públicamente sin autenticación, HTTPS, límites distribuidos, monitoreo y controles de costos.
- Antes de incorporar acciones con efectos reales, exige permisos por usuario, confirmación explícita y registro de auditoría.

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
- [Realtime con herramientas](https://developers.openai.com/api/docs/guides/realtime-mcp)
- [Conversaciones Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations)
- [WebRTC para voz](https://developers.openai.com/api/docs/guides/voice-webrtc)

## Próximas etapas

- Autenticación y sincronización segura del historial.
- Recordatorios persistentes con confirmación del usuario.
- Integraciones externas con permisos granulares.
- Herramientas para archivos y calendario con control de acceso.
- Pruebas de integración y despliegue seguro.
