const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        const { email, consultorio, fecha, hora } = JSON.parse(event.body);

        // Limpieza de clave para evitar el error de DECODER
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        privateKey = privateKey.replace(/\\n/g, '\n');
        
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

        // Formateo de horas
        const horaInicio = hora.toString().padStart(2, '0');
        const horaFin = (parseInt(hora) + 1).toString().padStart(2, '0');

        await calendar.events.insert({
            calendarId: 'demariaconsultorios1334@gmail.com',
            resource: {
                summary: `C${consultorio}: ${email}`,
                description: "Reserva realizada desde el sistema web.",
                start: { 
                    // Se usa -03:00 que es la zona horaria de Uruguay
                    dateTime: `${fecha}T${horaInicio}:00:00-03:00`, 
                    timeZone: 'America/Montevideo' 
                },
                end: { 
                    dateTime: `${fecha}T${horaFin}:00:00-03:00`, 
                    timeZone: 'America/Montevideo' 
                }
            },
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'OK' }),
        };
    } catch (error) {
        console.error("Error en Montevideo Calendar:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error de Google', details: error.message }),
        };
    }
};