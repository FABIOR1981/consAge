const { google } = require('googleapis');

exports.handler = async (event) => {
    // Solo permitir POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Método no permitido' };
    }

    try {
        const body = JSON.parse(event.body);
        const { email, nombre, consultorio, fecha, hora, colorId } = body;

        // 1. VALIDACIÓN DE DATOS (Evita el error 500 por datos nulos)
        if (!email || !consultorio || !fecha || hora === undefined) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Faltan datos requeridos (email, consultorio, fecha u hora)' }) 
            };
        }

        // 2. VALIDACIÓN DE HORARIOS (Sábados y Domingos)
        const fechaObj = new Date(fecha + 'T00:00:00');
        const diaSemana = fechaObj.getDay(); // 0=Dom, 6=Sab

        if (diaSemana === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No se atiende los domingos.' }) };
        }
        if (diaSemana === 6 && (hora < 8 || hora >= 15)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Sábados solo de 08:00 a 15:00 hs.' }) };
        }

        // 3. CONFIGURACIÓN DE GOOGLE CALENDAR
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        if (!privateKey) throw new Error("Falta GOOGLE_PRIVATE_KEY en las variables de entorno");
        
        privateKey = privateKey.replace(/\\n/g, '\n');
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

        // 4. INSERTAR EVENTO
        const startStr = `${fecha}T${hora.toString().padStart(2, '0')}:00:00`;
        const endStr = `${fecha}T${(parseInt(hora) + 1).toString().padStart(2, '0')}:00:00`;

        await calendar.events.insert({
            calendarId,
            resource: {
                summary: `Consultorio ${consultorio}: ${nombre}`,
                description: `Reserva realizada por: ${nombre} (${email})`,
                start: { dateTime: new Date(startStr).toISOString(), timeZone: 'America/Montevideo' },
                end: { dateTime: new Date(endStr).toISOString(), timeZone: 'America/Montevideo' },
                colorId: (colorId || "1").toString()
            }
        });

        return { 
            statusCode: 200, 
            body: JSON.stringify({ message: 'Reserva confirmada' }) 
        };

    } catch (error) {
        console.error("Error en función reservar:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Error interno del servidor', details: error.message }) 
        };
    }
};