const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        // Simple auth check: require Authorization header (Bearer token issued by Netlify Identity)
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const { email, consultorio, fecha, hora, colorId } = JSON.parse(event.body || '{}');

        // If NETLIFY_SITE_URL is set, verify token by calling Netlify Identity user endpoint
        const netlifySite = process.env.NETLIFY_SITE_URL;
        if (netlifySite) {
            try {
                const verifyRes = await fetch(`${netlifySite.replace(/\/$/, '')}/.netlify/identity/user`, { headers: { Authorization: authHeader } });
                if (!verifyRes.ok) {
                    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
                }
                const userInfo = await verifyRes.json();
                if (userInfo && userInfo.email && email && userInfo.email !== email) {
                    return { statusCode: 403, body: JSON.stringify({ error: 'Token user mismatch' }) };
                }
            } catch (err) {
                console.warn('Error verifying token with Netlify Identity:', err.message || err);
                return { statusCode: 500, body: JSON.stringify({ error: 'Error verifying token' }) };
            }
        } else {
            // Fallback: we only check presence of Authorization header. Recommend setting NETLIFY_SITE_URL in production.
            console.warn('NETLIFY_SITE_URL not set: skipping remote token verification. Consider setting NETLIFY_SITE_URL env var.');
        }

        // Basic validation
        if (!email || !consultorio || !fecha || (hora === undefined || hora === null)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid date format' }) };
        }
        const horaInt = parseInt(hora, 10);
        if (Number.isNaN(horaInt) || horaInt < 0 || horaInt > 23) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid hour' }) };
        }

        let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';
        if (!privateKey) throw new Error('Missing GOOGLE_PRIVATE_KEY env var');

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

        const calendarId = process.env.CALENDAR_ID || 'demariaconsultorios1334@gmail.com';

        const horaInicio = horaInt.toString().padStart(2, '0');
        const horaFin = (horaInt + 1).toString().padStart(2, '0');

        const timeMin = `${fecha}T${horaInicio}:00:00-03:00`;
        const timeMax = `${fecha}T${horaFin}:00:00-03:00`;

        // Check for conflicting events
        const existing = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            singleEvents: true,
            maxResults: 1
        });

        if (existing.data && existing.data.items && existing.data.items.length > 0) {
            return { statusCode: 409, body: JSON.stringify({ error: 'Conflicting appointment' }) };
        }

        // Insert event (optionally send updates/invitations)
        const sendUpdates = process.env.SEND_UPDATES === 'true';
        const insertOpts = {
            calendarId,
            resource: {
                summary: `C${consultorio}: Reserva confirmada`,
                colorId: colorId,
                description: `Reserva para: ${email}\nConsultorio: ${consultorio}\nFecha: ${fecha}\nHora: ${horaInicio}:00 hs.`,
                start: {
                    dateTime: timeMin,
                    timeZone: 'America/Montevideo'
                },
                end: {
                    dateTime: timeMax,
                    timeZone: 'America/Montevideo'
                },
                attendees: [{ email }]
            }
        };
        if (sendUpdates) insertOpts.sendUpdates = 'all';

        const eventRes = await calendar.events.insert(insertOpts);

        return { statusCode: 200, body: JSON.stringify({ message: 'OK', eventId: eventRes.data.id }) };
    } catch (error) {
        console.error("Error:", error.message || error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message || String(error) }) };
    }
};