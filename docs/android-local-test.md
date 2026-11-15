# ATLAS-AI Android: prueba local

Esta APK es un contenedor Android de la aplicación web existente. No incorpora una clave de OpenAI ni sustituye al servidor Node.js.

## 1. Compilar y arrancar el servidor en Windows

Requisitos: Node.js 22.13 o posterior y una computadora con Windows.

1. Clona la rama `feature/android-local-apk` del repositorio y entra a la carpeta.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env` y configura `OPENAI_API_KEY` si vas a probar chat inteligente. Configura SMTP si necesitas registrar una cuenta nueva y verificar el correo.
4. En `.env`, agrega `HOST=0.0.0.0` y `PORT=3000`.
5. Ejecuta `npm start`.
6. Permite Node.js en el Firewall de Windows para redes privadas. No abras el puerto al internet público.

Para saber la IP local de la computadora, abre CMD y ejecuta `ipconfig`. Usa la dirección IPv4 del adaptador Wi-Fi, por ejemplo `192.168.1.100`.

## 2. Instalar la APK

Descarga el artefacto `atlas-ai-android-debug` desde la ejecución de GitHub Actions de esta rama. Descomprime el ZIP y copia `app-debug.apk` al teléfono. Android puede pedir permiso para instalar aplicaciones desde esa fuente.

Abre ATLAS-AI y escribe la dirección local de tu computadora, por ejemplo `http://192.168.1.100:3000`. El teléfono y la computadora deben estar en la misma red Wi-Fi. La dirección puede cambiar cuando el router reasigne IP.

## 3. Qué se puede probar

- Interfaz web real de ATLAS-AI dentro de la APK.
- Inicio de sesión y sesión persistente mediante cookies del WebView.
- Chat de texto con Responses API, si el servidor tiene una clave válida.
- Historial, memoria y preferencias guardadas en SQLite del servidor.
- Herramientas disponibles desde el backend.

## 4. Límites de esta primera APK

- El alta de cuentas requiere correo SMTP para verificar el buzón. Sin SMTP, usa una cuenta ya verificada.
- El chat inteligente requiere `OPENAI_API_KEY` configurada en el servidor y puede generar consumo de API.
- La voz requiere HTTPS y permiso de micrófono. Esta prueba por HTTP en una IP privada no habilita micrófono; no se concede permiso de audio en conexiones HTTP.
- No es una APK firmada para distribución pública ni una versión de Play Store. Es una compilación debug para pruebas personales.
- No expongas el servidor local a redes públicas ni compartas el archivo `.env`.

## 5. Seguridad de la prueba

La APK solo guarda la dirección del servidor. La clave de OpenAI permanece en el archivo `.env` de la computadora. Usa la APK en una red Wi-Fi de confianza y detén el servidor cuando termines.
