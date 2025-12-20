const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Método no permitido' };
    try {
        const params = event.queryStringParameters || {};
        const { fechaInicio, fechaFin, consultorio, usuario } = params;
        if (!fechaInicio || !fechaFin) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Debe indicar fechaInicio y fechaFin' }) };
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
        const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
        const eventsRes = await calendar.events.list({
            calendarId,
            timeMin: `${fechaInicio}T00:00:00-03:00`,
            timeMax: `${fechaFin}T23:59:59-03:00`,
            timeZone: zonaHoraria,
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
        });
        let eventos = eventsRes.data.items || [];
        // Filtrar por consultorio si se indica
        if (consultorio) {
            const regexConsultorio = new RegExp(`^C${consultorio}:\\s`, 'i');
            eventos = eventos.filter(ev => ev.summary && regexConsultorio.test(ev.summary));
        }
        // Filtrar por usuario si se indica
        if (usuario) {
            // Buscar por email, nombre o apellido (coincidencia exacta, no substring)
            const busqueda = usuario.trim().toLowerCase();
            eventos = eventos.filter(ev => {
                if (!ev.description) return false;
                // Buscar por email exacto en la línea 'Reserva realizada por: ...'
                const match = ev.description.match(/Reserva realizada por: ([^\n]+)/);
                if (match && match[1].trim().toLowerCase() === busqueda) return true;
                // Si la búsqueda parece un email, solo filtrar por coincidencia exacta de email
                if (busqueda.includes('@')) return false;
                // Buscar por nombre/apellido en user_metadata si existiera (coincidencia exacta en palabras)
                if (ev.user_metadata && ev.user_metadata.name) {
                    const nombre = ev.user_metadata.name.trim().toLowerCase();
                    if (nombre.split(/\s+/).includes(busqueda)) return true;
                }
                // Buscar en summary por si se guarda allí (coincidencia exacta en palabras)
                if (ev.summary) {
                    const palabras = ev.summary.toLowerCase().split(/\s+/);
                    if (palabras.includes(busqueda)) return true;
                }
                return false;
            });
        }
        // Mapear a formato simple
        const resultado = eventos.map(ev => ({
            summary: ev.summary,
            start: ev.start && ev.start.dateTime,
            end: ev.end && ev.end.dateTime,
            description: ev.description,
            id: ev.id
        }));

        // Calcular suma total de horas reservadas
        let totalHoras = 0;
        resultado.forEach(ev => {
            if (ev.start && ev.end) {
                const inicio = new Date(ev.start);
                const fin = new Date(ev.end);
                const diffMs = fin - inicio;
                const diffHoras = diffMs / (1000 * 60 * 60);
                totalHoras += diffHoras;
            }
        });

        return { statusCode: 200, body: JSON.stringify({ reservas: resultado, totalHoras }) };
    } catch (error) {
        console.error('Error informe_reservas:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};
