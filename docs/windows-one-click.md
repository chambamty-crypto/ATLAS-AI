# ATLAS-AI para Windows: servidor con conexión al celular

Esta modalidad está pensada para una persona que no programa. El paquete de la carpeta `windows/` inicia el servidor Node.js en la computadora y crea una URL HTTPS temporal mediante Cloudflare Quick Tunnel.

## Requisitos y comportamiento

- Windows 10/11 de 64 bits.
- Conexión a internet en la computadora.
- El instalador detecta Node.js 22.13 o posterior; si falta y Windows Package Manager está disponible, intenta instalarlo.
- Descarga ATLAS-AI desde la rama `feature/windows-one-click-server`, instala dependencias y conserva el archivo `.env` y la base de datos local al volver a ejecutarse.
- Descarga `cloudflared` desde los lanzamientos oficiales de Cloudflare.
- No necesita abrir puertos del router, IP pública, dominio ni cuenta de Cloudflare.
- La dirección `trycloudflare.com` es temporal y cambia al reiniciar. El servidor y el túnel deben permanecer activos para usar ATLAS desde el celular.

## Inicio

1. Descomprime el paquete Windows.
2. Haz doble clic en `Instalar-y-ejecutar-ATLAS.bat`.
3. Si se solicita una clave de OpenAI, puedes introducirla o pulsar ENTER para continuar sin ella. Sin clave funcionan la interfaz y el flujo de cuenta, pero chat y voz no estarán disponibles. Las llamadas a la API pueden generar cargos.
4. Espera a que aparezca la URL HTTPS y se abra el navegador.
5. En Android, pega esa URL en el contenedor APK de ATLAS-AI. Si no tienes la APK, abre la misma URL en Chrome del celular.

## Crear cuenta en la demo

`DEV_EMAIL_MODE=console` se configura únicamente para pruebas locales. Al registrar un correo, el servidor imprime un enlace de verificación en su ventana de consola. Ábrelo desde la computadora y establece tu contraseña; luego inicia sesión desde Android. Este modo no debe usarse en producción.

## Apagar

Haz doble clic en `Detener-ATLAS.bat`. También puedes cerrar las ventanas del servidor y usar el acceso para detener el túnel. La URL temporal deja de funcionar al detener `cloudflared`.

## Seguridad

Quick Tunnels son para desarrollo y pruebas, no para producción. Cualquier persona que conozca la URL puede llegar a la pantalla de acceso. No compartas la URL ni almacenes información sensible durante esta prueba. La autenticación de ATLAS protege las cuentas, pero esta modalidad no incorpora una capa adicional de acceso restringido delante de la aplicación. La clave de OpenAI permanece en `.env` en la computadora; no compartas ese archivo. No desactives el Firewall ni configures redirección de puertos en el router.

Documentación de Cloudflare: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
