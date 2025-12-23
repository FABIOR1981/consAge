const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        const body = JSON.parse(event.body);
        const { email, nombre, consultorio, fecha, hora, colorId } = body;

        // Validación de seguridad para evitar que la función se rompa por falta de datos
        if (!email || !consultorio || !fecha || hora === undefined) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Datos incompletos' }) };
        }

        // --- VALIDACIÓN DE DÍAS (Sábados y Domingos) ---
        const fechaObj = new Date(fecha + 'T00:00:00');
        const diaSemana = fechaObj.getDay(); 
        if (diaSemana === 0) return { statusCode: 400, body: JSON.stringify({ error: 'Domingos no permitidos' }) };
        if (diaSemana === 6 && (hora < 8 || hora >= 15)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Sábados solo de 8 a 15hs' }) };
        }

        // --- AUTH GOOGLE ---
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

        // --- CREAR EVENTO ---
        const startStr = `${fecha}T${hora.toString().padStart(2, '0')}:00:00`;
        const endStr = `${fecha}T${(parseInt(hora) + 1).toString().padStart(2, '0')}:00:00`;

        await calendar.events.insert({
            calendarId,
            resource: {
                summary: `Consultorio ${consultorio}: ${nombre}`,
                description: `Reserva: ${email}`,
                start: { dateTime: new Date(startStr).toISOString(), timeZone: 'America/Montevideo' },
                end: { dateTime: new Date(endStr).toISOString(), timeZone: 'America/Montevideo' },
                // IMPORTANTE: colorId debe ser String y existir en Google Calendar (del 1 al 11)
                colorId: colorId ? colorId.toString() : "1"
            }
        });

        return { statusCode: 200, body: JSON.stringify({ message: 'OK' }) };

    } catch (error) {
        console.error("ERROR EN RESERVAR:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};