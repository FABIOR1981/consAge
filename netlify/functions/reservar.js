const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        const { email, consultorio, fecha, hora, colorId } = JSON.parse(event.body);

        let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }

        // Soporte para impersonation (Domain-Wide Delegation): si seteas GOOGLE_IMPERSONATE_EMAIL
        // la cuenta de servicio actuará como ese usuario y podrá enviar invitaciones si el dominio lo permite.
        const subject = process.env.GOOGLE_IMPERSONATE_EMAIL || null;
        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/calendar'],
            subject
        );

        const calendar = google.calendar({ version: 'v3', auth });

        const horaInicio = hora.toString().padStart(2, '0');
        const horaFin = (parseInt(hora) + 1).toString().padStart(2, '0');

        // Use configured calendar id and optionally send updates/invitations
        const calendarId = process.env.CALENDAR_ID || 'demariaconsultorios1334@gmail.com';
        const sendUpdates = process.env.SEND_UPDATES === 'true';

        const insertOpts = {
            calendarId,
            resource: {
                summary: `C${consultorio}: Reserva confirmada`,
                colorId: colorId,
                description: `Reserva realizada por: ${email}\nConsultorio: ${consultorio}\nFecha: ${fecha}\nHora: ${horaInicio}:00 hs.`,
                start: {
                    dateTime: `${fecha}T${horaInicio}:00:00-03:00`,
                    timeZone: 'America/Montevideo'
                },
                end: {
                    dateTime: `${fecha}T${horaFin}:00:00-03:00`,
                    timeZone: 'America/Montevideo'
                }
                // Eliminamos la propiedad attendees
            }
        };
        if (sendUpdates) insertOpts.sendUpdates = 'all';

        // Verificar disponibilidad del consultorio antes de crear el evento
        const busySlots = await calendar.events.list({
            calendarId,
            timeMin: `${fecha}T${horaInicio}:00:00-03:00`,
            timeMax: `${fecha}T${horaFin}:00:00-03:00`,
            timeZone: 'America/Montevideo',
        });

        if (busySlots.data.items && busySlots.data.items.length > 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'El horario ya está ocupado.' }) };
        }

        // Intentamos crear el evento con attendees (sin envío de confirmaciones)
        try {
            const eventRes = await calendar.events.insert(insertOpts);
            console.log('Created event:', eventRes.data && eventRes.data.id);

            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva creada correctamente', eventId: eventRes.data.id }) };
        } catch (err) {
            console.error('Error creating event:', err && (err.message || err));
            return { statusCode: 500, body: JSON.stringify({ error: 'Error creando el evento', details: (err && err.message) || String(err) }) };
        }
    } catch (error) {
        console.error("Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};