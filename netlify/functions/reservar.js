const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod === 'POST') {
        try {
            const { email, consultorio, fecha, hora, colorId } = JSON.parse(event.body);

            let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                privateKey = privateKey.substring(1, privateKey.length - 1);
            }

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

            // Verificar disponibilidad antes de crear el evento
            const busySlots = await calendar.events.list({
                calendarId,
                timeMin: `${fecha}T${horaInicio}:00:00-03:00`,
                timeMax: `${fecha}T${horaFin}:00:00-03:00`,
                timeZone: 'America/Montevideo',
            });
            if (busySlots.data.items && busySlots.data.items.length > 0) {
                return { statusCode: 400, body: JSON.stringify({ error: 'El horario ya está ocupado.' }) };
            }

            // Crear el evento
            const eventRes = await calendar.events.insert(insertOpts);
            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva creada correctamente', eventId: eventRes.data.id }) };
        } catch (error) {
            console.error("Error:", error.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    // GET: Listar eventos del usuario (horas libres y ocupadas)
    if (event.httpMethod === 'GET') {
        try {
            const { email, fecha } = event.queryStringParameters;
            let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                privateKey = privateKey.substring(1, privateKey.length - 1);
            }
            const subject = process.env.GOOGLE_IMPERSONATE_EMAIL || null;
            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                privateKey,
                ['https://www.googleapis.com/auth/calendar'],
                subject
            );
            const calendar = google.calendar({ version: 'v3', auth });
            const calendarId = process.env.CALENDAR_ID || 'demariaconsultorios1334@gmail.com';
            const busySlots = await calendar.events.list({
                calendarId,
                timeMin: `${fecha}T00:00:00-03:00`,
                timeMax: `${fecha}T23:59:59-03:00`,
                timeZone: 'America/Montevideo',
            });
            const userEvents = busySlots.data.items.filter(event => {
                const isUserEvent = event.description && event.description.includes(`Reserva realizada por: ${email}`);
                return isUserEvent;
            });
            return { statusCode: 200, body: JSON.stringify({ events: busySlots.data.items, userEvents }) };
        } catch (error) {
            console.error("Error:", error.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    // DELETE: Cancelar reserva (solo si faltan más de 24 horas)
    if (event.httpMethod === 'DELETE') {
        try {
            const { eventId, email } = JSON.parse(event.body);
            let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                privateKey = privateKey.substring(1, privateKey.length - 1);
            }
            const subject = process.env.GOOGLE_IMPERSONATE_EMAIL || null;
            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                privateKey,
                ['https://www.googleapis.com/auth/calendar'],
                subject
            );
            const calendar = google.calendar({ version: 'v3', auth });
            const calendarId = process.env.CALENDAR_ID || 'demariaconsultorios1334@gmail.com';
            const eventRes = await calendar.events.get({ calendarId, eventId });
            const eventStart = new Date(eventRes.data.start.dateTime);
            const now = new Date();
            const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);
            if (hoursUntilEvent <= 24) {
                return { statusCode: 400, body: JSON.stringify({ error: 'No puedes cancelar reservas dentro de las 24 horas antes del evento.' }) };
            }
            // Solo permite cancelar si el email coincide
            if (!eventRes.data.description || !eventRes.data.description.includes(email)) {
                return { statusCode: 403, body: JSON.stringify({ error: 'No autorizado para cancelar esta reserva.' }) };
            }
            await calendar.events.delete({ calendarId, eventId });
            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva cancelada correctamente.' }) };
        } catch (error) {
            console.error("Error:", error.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    return { statusCode: 405, body: 'Método no permitido' };
};