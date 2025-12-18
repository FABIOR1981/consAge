// netlify/functions/reservar.js
const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        const { email, consultorio, fecha, hora, colorId } = JSON.parse(event.body);

        let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }

        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/calendar']
        );

        const calendar = google.calendar({ version: 'v3', auth });

        const horaInicio = hora.toString().padStart(2, '0');
        const horaFin = (parseInt(hora) + 1).toString().padStart(2, '0');

        await calendar.events.insert({
            calendarId: 'demariaconsultorios1334@gmail.com',
            sendUpdates: 'all', // <--- Envía el mail de confirmación
            resource: {
                summary: `C${consultorio}: Reserva`,
                colorId: colorId, // <--- Aplica el color (Girasol, Violeta, etc.)
                description: `Has reservado el Consultorio ${consultorio}.`,
                attendees: [{ email: email }], // <--- Añade el evento al calendario del usuario
                start: { 
                    dateTime: `${fecha}T${horaInicio}:00:00-03:00`, 
                    timeZone: 'America/Montevideo' 
                },
                end: { 
                    dateTime: `${fecha}T${horaFin}:00:00-03:00`, 
                    timeZone: 'America/Montevideo' 
                }
            },
        });

        return { statusCode: 200, body: JSON.stringify({ message: 'OK' }) };
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};