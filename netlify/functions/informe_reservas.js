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
        // Si solicitan sólo la lista de usuarios, extraer nombre y email desde las descripciones
        if (params.listUsers) {
            const usersMap = new Map();
            eventos.forEach(ev => {
                if (!ev.description) return;
                // 1. Formato: Reserva realizada por: NOMBRE <email>
                let match = ev.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                if (match) {
                    const nombre = match[1].trim();
                    const email = match[2].trim();
                    if (!usersMap.has(email)) usersMap.set(email, { nombre, email });
                    return;
                }
                // 2. Formato: Reserva realizada por: email
                match = ev.description.match(/Reserva realizada por: ([^\n@]+@[^\n]+)/);
                if (match) {
                    const email = match[1].trim();
                    if (!usersMap.has(email)) usersMap.set(email, { nombre: email, email });
                    return;
                }
                // 3. Formato: Reserva realizada por: Nombre (sin email)
                match = ev.description.match(/Reserva realizada por: ([^\n]+)/);
                if (match) {
                    const nombre = match[1].trim();
                    if (!usersMap.has(nombre)) usersMap.set(nombre, { nombre, email: nombre });
                }
            });
            const users = Array.from(usersMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
                // console.log('Usuarios encontrados para combo:', users);
            return { statusCode: 200, body: JSON.stringify({ users }) };
        }
        // Filtrar por usuario si se indica
        if (usuario) {
            // Buscar por email, nombre completo o usuario (coincidencia exacta o parcial)
            const busqueda = usuario.trim().toLowerCase();
            eventos = eventos.filter(ev => {
                if (!ev.description) return false;
                // Buscar por email
                const match = ev.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                if (match) {
                    const nombre = match[1].trim().toLowerCase();
                    const email = match[2].trim().toLowerCase();
                    if (email.includes(busqueda) || nombre.includes(busqueda)) return true;
                } else {
                    // Buscar por email simple
                    const matchEmail = ev.description.match(/Reserva realizada por: ([^\n@]+@[^\n]+)/);
                    if (matchEmail) {
                        const email = matchEmail[1].trim().toLowerCase();
                        if (email.includes(busqueda)) return true;
                    }
                    // Buscar por nombre simple
                    const matchNombre = ev.description.match(/Reserva realizada por: ([^\n]+)/);
                    if (matchNombre) {
                        const nombre = matchNombre[1].trim().toLowerCase();
                        if (nombre.includes(busqueda)) return true;
                    }
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
            // console.error('Error informe_reservas:', error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};
