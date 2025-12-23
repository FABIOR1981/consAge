const { google } = require('googleapis');

exports.handler = async (event) => {
    // Solo permitimos POST para crear reservas
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Método no permitido' };
    }

    try {
        const { email, nombre, consultorio, fecha, hora, colorId } = JSON.parse(event.body);

        // --- VALIDACIONES DE NEGOCIO ---
        const fechaObj = new Date(fecha + 'T00:00:00');
        const diaSemana = fechaObj.getDay();

        if (diaSemana === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No se atiende los domingos.' }) };
        }
        if (diaSemana === 6 && (hora < 8 || hora >= 15)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Sábados solo de 08:00 a 15:00 hs.' }) };
        }
        if (hora < 8 || hora >= 21) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Horario fuera de rango permitido.' }) };
        }

        // --- GOOGLE CALENDAR AUTH ---
        let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }

        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/calendar'],
            process.env.GOOGLE_IMPERSONATE_EMAIL || null
        );

        const calendar = google.calendar({ version: 'v3', auth });
        const calendarId = process.env.CALENDAR_ID;

        // --- VERIFICAR DISPONIBILIDAD ---
        const startStr = `${fecha}T${hora.toString().padStart(2, '0')}:00:00`;
        const endStr = `${fecha}T${(parseInt(hora) + 1).toString().padStart(2, '0')}:00:00`;

        const check = await calendar.events.list({
            calendarId,
            timeMin: new Date(startStr).toISOString(),
            timeMax: new Date(endStr).toISOString(),
            singleEvents: true
        });

        // Filtrar si ya existe un evento para ese consultorio que no sea una cancelación
        const ocupado = check.data.items.some(ev => 
            ev.summary.includes(`Consultorio ${consultorio}:`) && !ev.summary.startsWith('Cancelada')
        );

        if (ocupado) {
            return { statusCode: 400, body: JSON.stringify({ error: 'El consultorio ya está ocupado en esa hora.' }) };
        }

        // --- INSERTAR EN CALENDAR ---
        await calendar.events.insert({
            calendarId,
            resource: {
                summary: `Consultorio ${consultorio}: ${nombre}`,
                description: `Reserva realizada por: ${nombre} (${email})`,
                start: { 
                    dateTime: new Date(startStr).toISOString(), 
                    timeZone: 'America/Montevideo' 
                },
                end: { 
                    dateTime: new Date(endStr).toISOString(), 
                    timeZone: 'America/Montevideo' 
                },
                colorId: colorId ? colorId.toString() : "1"
            }
        });

        return { statusCode: 200, body: JSON.stringify({ message: 'Reserva confirmada con éxito.' }) };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Error interno', details: error.message }) };
    }
};