const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Método no permitido' };
    }

    try {
        const { email, consultorio, fecha, hora } = JSON.parse(event.body);

        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            ['https://www.googleapis.com/auth/calendar']
        );

        const calendar = google.calendar({ version: 'v3', auth });

        const eventResource = {
            summary: `C${consultorio}: ${email}`,
            description: `Reserva automática.`,
            start: {
                dateTime: `${fecha}T${hora}:00:00-03:00`,
                timeZone: 'America/Argentina/Buenos_Aires',
            },
            end: {
                dateTime: `${fecha}T${(parseInt(hora) + 1).toString().padStart(2, '0')}:00:00-03:00`,
                timeZone: 'America/Argentina/Buenos_Aires',
            },
        };

        await calendar.events.insert({
            calendarId: 'demariaconsultorios1334@gmail.com',
            resource: eventResource,
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'OK' }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error de Google', details: error.message }),
        };
    }
};