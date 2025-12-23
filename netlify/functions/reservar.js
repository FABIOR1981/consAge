const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        const body = JSON.parse(event.body);
        const { email, nombre, consultorio, fecha, hora, colorId } = body;

        // Validaciones estrictas para evitar error 500
        if (!email || !consultorio || !fecha || (hora !== 0 && !hora)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos en la solicitud' }) };
        }

        // --- RESTRICCIÓN SÁBADOS/DOMINGOS ---
        const fechaObj = new Date(fecha + 'T00:00:00');
        const dia = fechaObj.getDay(); 
        if (dia === 0) return { statusCode: 400, body: JSON.stringify({ error: 'Domingos cerrado' }) };
        if (dia === 6 && hora >= 15) return { statusCode: 400, body: JSON.stringify({ error: 'Sábados solo hasta las 15:00 hs' }) };

        // --- GOOGLE AUTH ---
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

        const startStr = `${fecha}T${hora.toString().padStart(2, '0')}:00:00`;
        const endStr = `${fecha}T${(parseInt(hora) + 1).toString().padStart(2, '0')}:00:00`;

        await calendar.events.insert({
            calendarId,
            resource: {
                summary: `Consultorio ${consultorio}: ${nombre}`,
                description: `Reserva realizada por: ${nombre} (${email})`,
                start: { dateTime: new Date(startStr).toISOString(), timeZone: 'America/Montevideo' },
                end: { dateTime: new Date(endStr).toISOString(), timeZone: 'America/Montevideo' },
                colorId: colorId ? colorId.toString() : "1"
            }
        });

        return { statusCode: 200, body: JSON.stringify({ message: 'Reserva creada con éxito' }) };
    } catch (error) {
        console.error("Error en reservar.js:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error interno de Google Calendar', details: error.message }) };
    }
};