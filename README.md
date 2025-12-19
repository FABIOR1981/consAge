# consAge

Notas sobre invitaciones y visibilidad en Google Calendar

- Para que los usuarios reciban invitaciones y la reserva aparezca en su calendario:
  1. La llamada que crea el evento debe incluir `attendees: [{ email } ]` (ya está añadido en la función `reservar`).
  2. Si quieres que Google envíe las notificaciones al crear/actualizar/borrar eventos, configura la variable de entorno `SEND_UPDATES=true` en Netlify; la función usará `sendUpdates: 'all'`.
  3. Asegúrate de que el calendario (por ejemplo `demariaconsultorios1334@gmail.com`) esté compartido con la cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) con permisos «Hacer cambios en los eventos» para que la cuenta de servicio pueda crear eventos y enviar invitaciones.
  4. Verifica que los correos de invitación no estén llegando a la carpeta SPAM y que el usuario acepte la invitación si su configuración de calendario lo requiere.

Pruebas sugeridas:

- Crear una reserva y comprobar en la respuesta que `eventId` existe. Luego, en la interfaz web de Google Calendar del usuario (o en su correo), ver si hay invitación.
- Si no llegan invitaciones, verifica permisos del calendario y activa `SEND_UPDATES=true`.

Si quieres, implemento además la comprobación de conflictos y la interfaz "Mis Reservas" para poder ver y cancelar eventos desde la aplicación.
