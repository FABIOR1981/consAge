# consAge

Pequeña aplicación para gestionar turnos con Google Calendar y Netlify Identity.

Variables de entorno necesarias (en Netlify):

- GOOGLE_SERVICE_ACCOUNT_EMAIL: correo del service account.
- GOOGLE_PRIVATE_KEY: clave privada (asegúrate de reemplazar saltos de línea `\n`).
- CALENDAR_ID: id del calendario (opcional; por defecto `demariaconsultorios1334@gmail.com`).
- NETLIFY_SITE_URL: URL pública de tu sitio (ej: https://mi-sitio.netlify.app). Si está seteada, la función verificará el token llamando a `/.netlify/identity/user`.
- SEND_UPDATES: `true` o `false` (opcional). Si `true`, la función enviará invitaciones a los asistentes (`sendUpdates: 'all'`).

Notas:
- La verificación remota del token mejora seguridad y evita que tokens falsos sean aceptados; en entornos de prueba puedes dejar `NETLIFY_SITE_URL` vacío (la función aceptará la presencia del header Authorization, pero es menos segura).
- Para que las invitaciones lleguen correctamente, el calendario y la cuenta de servicio deben tener permisos adecuados.

Cambios aplicados:

- Validación de `Authorization` en la función serverless (`netlify/functions/reservar.js`).
- Comprobación de solapamientos antes de insertar eventos.
- Mejor manejo de errores y respuestas HTTP (401, 400, 409).
- Frontend envía token JWT de Netlify Identity en header `Authorization: Bearer <token>`.

Instrucciones de prueba:

1. Desplegar con las variables de entorno.
2. Iniciar sesión con Netlify Identity en la app.
3. Agendar una cita desde el panel y verificar comportamiento en horarios ocupados y autorizaciones.
