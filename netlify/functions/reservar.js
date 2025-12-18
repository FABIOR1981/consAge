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
            // Quitamos 'sendUpdates' porque sin attendees puede dar error en algunas cuentas
            resource: {
                summary: `C${consultorio}: Reserva confirmada`,
                colorId: colorId, 
                // Ponemos el email del usuario en la descripción para que tú sepas quién es
                description: `Reserva para: ${email}\nConsultorio: ${consultorio}\nFecha: ${fecha}\nHora: ${horaInicio}:00 hs.`,
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
        console.error("Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};