# consAge

Notas sobre invitaciones y visibilidad en Google Calendar

- Para que los usuarios reciban invitaciones y la reserva aparezca en su calendario:
  1. La llamada que crea el evento debe incluir `attendees: [{ email } ]` (ya está añadido en la función `reservar`).
  2. Si quieres que Google envíe las notificaciones al crear/actualizar/borrar eventos, configura la variable de entorno `SEND_UPDATES=true` en Netlify; la función usará `sendUpdates: 'all'`.
  3. Asegúrate de que el calendario (por ejemplo `demariaconsultorios1334@gmail.com`) esté compartido con la cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) con permisos «Hacer cambios en los eventos» para que la cuenta de servicio pueda crear eventos y enviar invitaciones.
  4. **Si usas G Suite / Google Workspace** es posible configurar **Domain-Wide Delegation (DWD)** y proporcionar un `GOOGLE_IMPERSONATE_EMAIL` (email del usuario a impersonar, por ejemplo el propietario del calendario). Con DWD el servicio podrá crear eventos en nombre del usuario y enviar invitaciones.
  5. Si no tienes DWD y recibes el error "Service accounts cannot invite attendees without Domain-Wide Delegation of Authority", la función aplicará un **fallback**: creará la reserva en el calendario **sin** enviar invitaciones (se devolverá `invitationSent: false` en la respuesta). Como alternativa, puedes:
     - habilitar DWD y establecer `GOOGLE_IMPERSONATE_EMAIL`, o
     - configurar un servicio de envío de emails (SMTP, SendGrid) para notificar al usuario por correo cuando la reserva se crea. Si eliges SendGrid, añade las env vars `SENDGRID_API_KEY` y `SENDGRID_FROM`.


  6. Verifica que los correos de invitación no estén llegando a la carpeta SPAM y que el usuario acepte la invitación si su configuración de calendario lo requiere.

Pruebas sugeridas:

- Crear una reserva y comprobar en la respuesta que `eventId` existe. Si la función no pudo enviar invitaciones, recibiras `invitationSent: false`.
- Si no llegan invitaciones, verifica permisos del calendario, activa `SEND_UPDATES=true`, o configura DWD / `GOOGLE_IMPERSONATE_EMAIL`.

Si quieres, implemento además la comprobación de conflictos y la interfaz "Mis Reservas" para poder ver y cancelar eventos desde la aplicación.