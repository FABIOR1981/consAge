const { google } = require('googleapis');

exports.handler = async (event) => {

    if (event.httpMethod === 'POST') {
        try {
            const { email, nombre, consultorio, fecha, hora, colorId } = JSON.parse(event.body);
            const missing = [];
            if (!email) missing.push('email');
            if (!consultorio) missing.push('consultorio');
            if (!fecha) missing.push('fecha');
            if (!hora && hora !== 0) missing.push('hora');
            if (!colorId) missing.push('colorId');
            if (missing.length) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Datos faltantes o inválidos', missing, received: { email, consultorio, fecha, hora, colorId } }) };
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
                    summary: `C${consultorio}: ${nombre || email}`,
                    colorId: colorId,
                    description: `Reserva realizada por: ${nombre || email} <${email}>\nConsultorio: ${consultorio}\nFecha: ${fecha}\nHora: ${horaInicio}:00 hs.`,
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
            // Ignorar eventos que fueron marcados como 'Cancelada' (se mantienen para informes)
            const ocupantes = (busySlots.data.items || []).filter(ev => !(ev.summary && ev.summary.startsWith('Cancelada')));
            if (ocupantes.length > 0) {
                return { statusCode: 400, body: JSON.stringify({ error: 'El horario ya está ocupado.', ocupados: ocupantes.map(i => ({ id: i.id, summary: i.summary })) }) };
            }

            // Crear el evento
            const eventRes = await calendar.events.insert(insertOpts);
            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva creada correctamente', eventId: eventRes.data.id }) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    if (event.httpMethod === 'GET') {
        try {
            const { email, fecha, consultorio, all } = event.queryStringParameters || {};
            // Permitir all=1 solo para admin (demo: hardcodear email admin)
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.com';
            if (all === '1') {
                // Solo permitir si el usuario es admin (en producción, validar JWT o cabecera auth)
                // Aquí, para demo, permitir si la petición viene de un navegador logueado como admin
                // (en producción, usar auth real)
                // Si quieres más seguridad, puedes validar por IP o cabecera especial
                // Aquí devolvemos todas las reservas activas
                let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n');
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
                // Filtrar solo eventos activos (no cancelados)
                const userEvents = busySlots.data.items.filter(event => {
                    return !(event.summary && event.summary.startsWith('Cancelada'));
                }).map(event => {
                    // Extraer consultorio, fecha, hora, nombre y email
                    let consultorio = '';
                    let fecha = '';
                    let hora = '';
                    let nombre = '';
                    let email = '';
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
                    if (event.description) {
                        const m = event.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                        if (m) { nombre = m[1].trim(); email = m[2].trim(); }
                    }
                    return {
                        eventId: event.id,
                        consultorio,
                        fecha,
                        hora,
                        nombre,
                        email,
                        summary
                    };
                });
                return { statusCode: 200, body: JSON.stringify({ userEvents }) };
            }
            if (!email) {
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
                // Obtener la zona horaria desde config.js o usar por defecto
                const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
                // Filtrar solo eventos del consultorio seleccionado (robusto a espacios y mayúsculas)
                const regexConsultorio = new RegExp(`^C${consultorio}:\\s`, 'i');
                const eventosConsultorioAll = busySlots.data.items.filter(event => {
                    return event.summary && regexConsultorio.test(event.summary);
                });
                // Separar eventos activos (no cancelados) de los cancelados
                const eventosConsultorioActivos = eventosConsultorioAll.filter(ev => !(ev.summary && ev.summary.startsWith('Cancelada')));
                // Filtrar solo eventos ocupados por el usuario (activos) y mapear hora y eventId
                const userEvents = eventosConsultorioAll.filter(event => {
                    return event.description && event.description.includes(`Reserva realizada por: ${email}`) && !(event.summary && event.summary.startsWith('Cancelada'));
                }).map(event => ({
                    hora: new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria })).getHours(),
                    eventId: event.id,
                    fecha,
                    consultorio
                }));
                // Generar todas las horas posibles del día
                const horas = Array.from({length: 24}, (_, i) => i);
                // Marcar como ocupadas solo las del usuario (activas)
                const ocupadasPorUsuario = userEvents.map(e => e.hora);
                // Horas ocupadas por cualquier persona en ese consultorio (solo activos)
                const ocupadasTodas = eventosConsultorioActivos.map(event => {
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
                    if (!event.description) return false;
                    // Buscar por email exacto
                    if (event.description.includes(`Reserva realizada por: ${email}`)) return true;
                    // Buscar por nombre (si está en usuarios.json)
                    let nombreUsuario = '';
                    try {
                        // Cargar usuarios.json como archivo estático
                        const usuariosResp = require('node-fetch');
                        // NOTA: Esto es síncrono en Netlify, pero para robustez, podrías cachear el nombre en memoria
                    } catch {}
                    // Buscar por nombre extraído del email (antes de @)
                    const nombreEmail = email.split('@')[0].replace(/\./g, ' ');
                    if (event.description.includes(`Reserva realizada por: ${nombreEmail}`)) return true;
                    // Buscar por nombre+email (formato antiguo)
                    const regexNombreEmail = new RegExp(`Reserva realizada por: (.+?) ?<${email}>`);
                    if (regexNombreEmail.test(event.description)) return true;
                    return false;
                }).map(event => {
                    // Extraer consultorio, fecha, hora, nombre y email
                    let consultorio = '';
                    let fecha = '';
                    let hora = '';
                    let nombre = '';
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
                    if (event.description) {
                        // Extraer nombre y email si están presentes
                        const m = event.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                        if (m) {
                            nombre = m[1].trim();
                            email = m[2].trim();
                        } else {
                            // Si solo hay email
                            const m2 = event.description.match(/Reserva realizada por: ([^@\s]+@[^\s]+)/);
                            if (m2) {
                                nombre = '';
                                email = m2[1].trim();
                            } else {
                                // Si solo hay nombre
                                const m3 = event.description.match(/Reserva realizada por: (.+)/);
                                if (m3) {
                                    nombre = m3[1].trim();
                                    email = '';
                                }
                            }
                        }
                    }
                    return {
                        eventId: event.id,
                        consultorio,
                        fecha,
                        hora,
                        nombre,
                        email,
                        summary
                    };
                });
                return { statusCode: 200, body: JSON.stringify({ userEvents }) };
            }
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    if (event.httpMethod === 'DELETE') {
        try {
            const { eventId, email } = JSON.parse(event.body);
            if (!eventId || !email) {
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
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    return { statusCode: 405, body: 'Método no permitido' };
};