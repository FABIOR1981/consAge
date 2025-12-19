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
                // Ponemos el email del usuario en la descripción y como attendee para que reciba invitación
                description: `Reserva para: ${email}\nConsultorio: ${consultorio}\nFecha: ${fecha}\nHora: ${horaInicio}:00 hs.`,
                start: {
                    dateTime: `${fecha}T${horaInicio}:00:00-03:00`,
                    timeZone: 'America/Montevideo'
                },
                end: {
                    dateTime: `${fecha}T${horaFin}:00:00-03:00`,
                    timeZone: 'America/Montevideo'
                },
                attendees: [{ email }]
            }
        };
        if (sendUpdates) insertOpts.sendUpdates = 'all';

        // Intentamos crear el evento con attendees (envío de invitaciones si es posible).
        try {
            const eventRes = await calendar.events.insert(insertOpts);
            console.log('Created event:', eventRes.data && eventRes.data.id);
            return { statusCode: 200, body: JSON.stringify({ message: 'OK', eventId: eventRes.data.id, invitationSent: !!sendUpdates }) };
        } catch (err) {
            console.warn('Error creating event with attendees:', err && (err.message || err));

            // Caso común: "Service accounts cannot invite attendees without Domain-Wide Delegation of Authority." 
            // En ese caso hacemos fallback creando el evento SIN attendees ni sendUpdates para garantizar la reserva.
            const fallbackMessage = (err && err.message && err.message.includes('Service accounts cannot invite attendees')) || (err && err.errors && err.errors.some(e => (e.message || '').includes('Service accounts cannot invite attendees')));
            if (fallbackMessage) {
                try {
                    const fallbackOpts = JSON.parse(JSON.stringify(insertOpts));
                    delete fallbackOpts.resource.attendees;
                    delete fallbackOpts.sendUpdates;
                    const fallbackRes = await calendar.events.insert(fallbackOpts);
                    console.log('Created event (fallback, no attendees):', fallbackRes.data && fallbackRes.data.id);
                    return { statusCode: 200, body: JSON.stringify({ message: 'OK (no invitations sent)', eventId: fallbackRes.data.id, invitationSent: false }) };
                } catch (err2) {
                    console.error('Fallback event creation failed:', err2 && (err2.message || err2));
                    return { statusCode: 500, body: JSON.stringify({ error: 'Error creating event', details: (err2 && err2.message) || String(err2) }) };
                }
            }

            // Si no es el caso específico, devolvemos el error original
            console.error('Event creation error:', err && (err.message || err));
            return { statusCode: 500, body: JSON.stringify({ error: 'Error creating event', details: (err && err.message) || String(err) }) };
        }
    } catch (error) {
        console.error("Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};