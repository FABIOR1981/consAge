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
                summary: `C${consultorio}: Reserva confirmada (${email})`,
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
            }
        };
        if (sendUpdates) insertOpts.sendUpdates = 'all';

        // Verificar disponibilidad del consultorio antes de crear el evento
        const busySlots = await calendar.events.list({
            calendarId,
            timeMin: `${fecha}T00:00:00-03:00`,
            timeMax: `${fecha}T23:59:59-03:00`,
            timeZone: 'America/Montevideo',
        });

        const userEvents = busySlots.data.items.filter(event => {
            const isUserEvent = event.description && event.description.includes(`Reserva realizada por: ${email}`);
            return isUserEvent || !event.start || !event.end; // Mostrar eventos del usuario o espacios libres
        });

        // Permitir cancelación de reservas si están fuera del rango de 24 horas antes del evento
        const cancelReservation = async (eventId) => {
            const event = await calendar.events.get({ calendarId, eventId });
            const eventStart = new Date(event.data.start.dateTime);
            const now = new Date();

            const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);
            if (hoursUntilEvent <= 24) {
                return { statusCode: 400, body: JSON.stringify({ error: 'No puedes cancelar reservas dentro de las 24 horas antes del evento.' }) };
            }

            await calendar.events.delete({ calendarId, eventId });
            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva cancelada correctamente.' }) };
        };

        // Intentamos crear el evento después de verificar la disponibilidad
        if (userEvents.some(event => event.start && event.end)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'El horario ya está ocupado.' }) };
        }

        try {
            const eventRes = await calendar.events.insert(insertOpts);
            console.log('Created event:', eventRes.data && eventRes.data.id);
            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva creada correctamente', eventId: eventRes.data.id }) };
        } catch (err) {
            console.error('Error creating event:', err && (err.message || err));
            return { statusCode: 500, body: JSON.stringify({ error: 'Error creando el evento', details: (err && err.message) || String(err) }) };
        }

        return { statusCode: 200, body: JSON.stringify({ events: userEvents }) };
    } catch (error) {
        console.error("Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};