// netlify/functions/reservar.js
const { google } = require('googleapis');

exports.handler = async (event) => {
    // 1. Solo permitir peticiones POST desde el dashboard
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Método no permitido' }) 
        };
    }

    try {
        // 2. Extraer los datos enviados por el usuario
        const { email, consultorio, fecha, hora } = JSON.parse(event.body);

        // 3. Autenticación con Google usando las Variables de Entorno de Netlify
        // El .replace(/\\n/g, '\n') es vital para que la clave privada se lea correctamente
        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/calendar']
        );

        const calendar = google.calendar({ version: 'v3', auth });

        // 4. Configurar el evento (Ajustado a la zona horaria de Argentina/Uruguay -03:00)
        const eventResource = {
            summary: `C${consultorio}: ${email}`,
            description: `Reserva realizada desde el Panel Web para el Consultorio ${consultorio}.`,
            start: {
                dateTime: `${fecha}T${hora}:00:00-03:00`,
                timeZone: 'America/Argentina/Buenos_Aires',
            },
            end: {
                dateTime: `${fecha}T${(parseInt(hora) + 1).toString().padStart(2, '0')}:00:00-03:00`,
                timeZone: 'America/Argentina/Buenos_Aires',
            },
        };

        // 5. Insertar el evento en el calendario específico
        const response = await calendar.events.insert({
            calendarId: 'demariaconsultorios1334@gmail.com',
            resource: eventResource,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Turno agendado con éxito', 
                id: response.data.id 
            }),
        };

    } catch (error) {
        console.error('Error en la función de reserva:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'No se pudo conectar con Google Calendar',
                details: error.message 
            }),
        };
    }
};