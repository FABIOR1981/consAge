const { google } = require('googleapis');

exports.handler = async (event) => {
    console.log('Método:', event.httpMethod);
    console.log('Body:', event.body);
    console.log('Query:', event.queryStringParameters);

    if (event.httpMethod === 'POST') {
        try {
            const { email, consultorio, fecha, hora, colorId } = JSON.parse(event.body);
            if (!email || !consultorio || !fecha || !hora || !colorId) {
                console.error('Datos faltantes:', { email, consultorio, fecha, hora, colorId });
                return { statusCode: 400, body: JSON.stringify({ error: 'Datos faltantes o inválidos' }) };
            }

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

    if (event.httpMethod === 'GET') {
        try {
            const { email, fecha, consultorio } = event.queryStringParameters || {};
            if (!email) {
                console.error('Falta email en GET:', { email });
                return { statusCode: 400, body: JSON.stringify({ error: 'Debes indicar el email' }) };
            }
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
            // Si se pasa fecha y consultorio, mantener lógica anterior
            if (fecha && consultorio) {
                const busySlots = await calendar.events.list({
                    calendarId,
                    timeMin: `${fecha}T00:00:00-03:00`,
                    timeMax: `${fecha}T23:59:59-03:00`,
                    timeZone: 'America/Montevideo',
                });
                // Log de todos los eventos recuperados para el día
                console.log('Eventos recuperados:', busySlots.data.items.map(ev => ({ summary: ev.summary, start: ev.start && ev.start.dateTime })));
                // Obtener la zona horaria desde config.js o usar por defecto
                const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
                // Filtrar solo eventos del consultorio seleccionado (robusto a espacios y mayúsculas)
                const regexConsultorio = new RegExp(`^C${consultorio}:\\s`, 'i');
                const eventosConsultorio = busySlots.data.items.filter(event => {
                    return event.summary && regexConsultorio.test(event.summary);
                });
                // Filtrar solo eventos ocupados por el usuario y mapear hora y eventId
                const userEvents = eventosConsultorio.filter(event => {
                    return event.description && event.description.includes(`Reserva realizada por: ${email}`);
                }).map(event => ({
                    hora: new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria })).getHours(),
                    eventId: event.id,
                    fecha,
                    consultorio
                }));
                // Generar todas las horas posibles del día
                const horas = Array.from({length: 24}, (_, i) => i);
                // Marcar como ocupadas solo las del usuario
                const ocupadasPorUsuario = userEvents.map(e => e.hora);
                // Horas ocupadas por cualquier persona en ese consultorio
                const ocupadasTodas = eventosConsultorio.map(event => {
                    if (event.start && event.start.dateTime) {
                        return new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria })).getHours();
                    }
                    return null;
                }).filter(h => h !== null);
                const libres = horas.filter(h => !ocupadasTodas.includes(h));
                // Respuesta: solo horas libres o tomadas por el usuario
                const resultado = horas.filter(h => libres.includes(h) || ocupadasPorUsuario.includes(h));
                return { statusCode: 200, body: JSON.stringify({ horasDisponibles: resultado, ocupadasPorUsuario, userEvents }) };
            } else {
                // Si solo se pasa email, devolver todas las reservas activas del usuario
                const now = new Date();
                const busySlots = await calendar.events.list({
                    calendarId,
                    timeMin: now.toISOString(),
                    maxResults: 2500,
                    singleEvents: true,
                    orderBy: 'startTime',
                    timeZone: 'America/Montevideo',
                });
                const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
                // Filtrar eventos del usuario
                const userEvents = busySlots.data.items.filter(event => {
                    return event.description && event.description.includes(`Reserva realizada por: ${email}`);
                }).map(event => {
                    // Extraer consultorio, fecha y hora
                    let consultorio = '';
                    let fecha = '';
                    let hora = '';
                    let summary = event.summary || '';
                    if (event.summary) {
                        const match = event.summary.match(/^C(\d+):/);
                        if (match) consultorio = match[1];
                    }
                    if (event.start && event.start.dateTime) {
                        const dt = new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria }));
                        fecha = dt.toISOString().slice(0,10);
                        hora = dt.getHours();
                    }
                    return {
                        eventId: event.id,
                        consultorio,
                        fecha,
                        hora,
                        summary
                    };
                });
                return { statusCode: 200, body: JSON.stringify({ userEvents }) };
            }
        } catch (error) {
            console.error("Error:", error.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    if (event.httpMethod === 'DELETE') {
        try {
            const { eventId, email } = JSON.parse(event.body);
            if (!eventId || !email) {
                console.error('Datos faltantes en DELETE:', { eventId, email });
                return { statusCode: 400, body: JSON.stringify({ error: 'Datos faltantes o inválidos' }) };
            }

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
            // Actualizar el evento: anteponer 'Cancelada' y cambiar color a gris (colorId: 8)
            const nuevoTitulo = eventRes.data.summary.startsWith('Cancelada') ? eventRes.data.summary : `Cancelada - ${eventRes.data.summary}`;
            await calendar.events.patch({
                calendarId,
                eventId,
                resource: {
                    summary: nuevoTitulo,
                    colorId: '8', // gris
                }
            });
            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva marcada como cancelada.' }) };
        } catch (error) {
            console.error("Error:", error.message);
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    return { statusCode: 405, body: 'Método no permitido' };
};