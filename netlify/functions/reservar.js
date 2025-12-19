const { google } = require('googleapis');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

    try {
        const { email, consultorio, fecha, hora, colorId } = JSON.parse(event.body);

        let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }

        // Soporte para impersonation (Domain-Wide Delegation): si seteas GOOGLE_IMPERSONATE_EMAIL
        // la cuenta de servicio actuará como ese usuario y podrá enviar invitaciones si el dominio lo permite.
        const subject = process.env.GOOGLE_IMPERSONATE_EMAIL || null;
        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/calendar'],
            subject
        );

        const calendar = google.calendar({ version: 'v3', auth });

        // Helper: send email via SendGrid if configured
        const sendConfirmationEmail = async (to, subject, htmlBody, textBody) => {
            const apiKey = process.env.SENDGRID_API_KEY;
            const from = process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
            if (!apiKey || !from) {
                console.warn('SendGrid not configured (missing SENDGRID_API_KEY or SENDGRID_FROM). Skipping email.');
                return false;
            }

            const payload = {
                personalizations: [{ to: [{ email: to }] }],
                from: { email: from },
                subject: subject,
                content: [
                    { type: 'text/plain', value: textBody || '' },
                    { type: 'text/html', value: htmlBody || '' }
                ]
            };

            try {
                if (typeof fetch !== 'undefined') {
                    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) {
                        const txt = await res.text();
                        console.warn('SendGrid response not ok:', res.status, txt);
                        return false;
                    }
                    return true;
                } else {
                    // Fallback using native https
                    const https = require('https');
                    const opts = {
                        hostname: 'api.sendgrid.com',
                        path: '/v3/mail/send',
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        }
                    };
                    await new Promise((resolve, reject) => {
                        const req = https.request(opts, (res) => {
                            let data = '';
                            res.on('data', (chunk) => data += chunk);
                            res.on('end', () => {
                                if (res.statusCode >= 200 && res.statusCode < 300) resolve();
                                else reject(new Error(`SendGrid error ${res.statusCode}: ${data}`));
                            });
                        });
                        req.on('error', reject);
                        req.write(JSON.stringify(payload));
                        req.end();
                    });
                    return true;
                }
            } catch (err) {
                console.error('SendGrid send failed:', err && (err.message || err));
                return false;
            }
        };

        const horaInicio = hora.toString().padStart(2, '0');
        const horaFin = (parseInt(hora) + 1).toString().padStart(2, '0');

        // Use configured calendar id and optionally send updates/invitations
        const calendarId = process.env.CALENDAR_ID || 'demariaconsultorios1334@gmail.com';
        const sendUpdates = process.env.SEND_UPDATES === 'true';

        const insertOpts = {
            calendarId,
            resource: {
                summary: `C${consultorio}: Reserva confirmada`,
                colorId: colorId,
                // Ponemos el email del usuario en la descripción y como attendee para que reciba invitación
                description: `Reserva para: ${email}\nConsultorio: ${consultorio}\nFecha: ${fecha}\nHora: ${horaInicio}:00 hs.`,
                start: {
                    dateTime: `${fecha}T${horaInicio}:00:00-03:00`,
                    timeZone: 'America/Montevideo'
                },
                end: {
                    dateTime: `${fecha}T${horaFin}:00:00-03:00`,
                    timeZone: 'America/Montevideo'
                },
                attendees: [{ email }]
            }
        };
        if (sendUpdates) insertOpts.sendUpdates = 'all';

        // Intentamos crear el evento con attendees (envío de invitaciones si es posible).
        try {
            const eventRes = await calendar.events.insert(insertOpts);
            console.log('Created event:', eventRes.data && eventRes.data.id);

                    const invitationSent = !!sendUpdates;
                    // If invitations were NOT sent by Google, try SendGrid (if configured)
                    if (!invitationSent) {
                        const htmlLink = eventRes.data && eventRes.data.htmlLink;
                        const subject = `Reserva confirmada - Consultorio ${consultorio} - ${fecha} ${horaInicio}:00`;
                        const htmlBody = `<p>Tu reserva fue confirmada.</p><p><strong>Consultorio:</strong> ${consultorio}<br><strong>Fecha:</strong> ${fecha} ${horaInicio}:00<br><a href="${htmlLink}">Ver en Google Calendar</a></p>`;
                        const textBody = `Tu reserva fue confirmada. Consultorio: ${consultorio}\nFecha: ${fecha} ${horaInicio}:00\nEnlace: ${htmlLink || '—'}`;
                        try {
                            const sent = await sendConfirmationEmail(email, subject, htmlBody, textBody);
                            console.log('Fallback email sent:', sent);
                        } catch (e) {
                            console.warn('Fallback email failed:', e && (e.message || e));
                        }
                    }

                } catch (err) {
                    console.warn('Error creating event with attendees:', err && (err.message || err));

                    // Caso común: "Service accounts cannot invite attendees without Domain-Wide Delegation of Authority." 
                    // En ese caso hacemos fallback creando el evento SIN attendees ni sendUpdates para garantizar la reserva.
                    const fallbackMessage = (err && err.message && err.message.includes('Service accounts cannot invite attendees')) || (err && err.errors && err.errors.some(e => (e.message || '').includes('Service accounts cannot invite attendees')));
                    if (fallbackMessage) {
                        try {
                            const fallbackOpts = JSON.parse(JSON.stringify(insertOpts));
                            delete fallbackOpts.resource.attendees;
                            delete fallbackOpts.sendUpdates;
                            const fallbackRes = await calendar.events.insert(fallbackOpts);
                            console.log('Created event (fallback, no attendees):', fallbackRes.data && fallbackRes.data.id);

                            // Send fallback email to the user if SendGrid is configured
                            const htmlLink = fallbackRes.data && fallbackRes.data.htmlLink;
                            const subject = `Reserva confirmada - Consultorio ${consultorio} - ${fecha} ${horaInicio}:00`;
                            const htmlBody = `<p>Tu reserva fue confirmada (nota: no se enviaron invitaciones desde Google).</p><p><strong>Consultorio:</strong> ${consultorio}<br><strong>Fecha:</strong> ${fecha} ${horaInicio}:00<br><a href="${htmlLink}">Ver en Google Calendar</a></p>`;
                            const textBody = `Tu reserva fue confirmada (no se enviaron invitaciones desde Google). Consultorio: ${consultorio}\nFecha: ${fecha} ${horaInicio}:00\nEnlace: ${htmlLink || '—'}`;
                            try {
                                const sent = await sendConfirmationEmail(email, subject, htmlBody, textBody);
                                console.log('Fallback email sent:', sent);
                            } catch (e) {
                                console.warn('Fallback email failed:', e && (e.message || e));
                            }

                            return { statusCode: 200, body: JSON.stringify({ message: 'OK (no invitations sent)', eventId: fallbackRes.data.id, invitationSent: false, htmlLink }) };
                        } catch (err2) {
                            console.error('Fallback event creation failed:', err2 && (err2.message || err2));
                            return { statusCode: 500, body: JSON.stringify({ error: 'Error creating event', details: (err2 && err2.message) || String(err2) }) };
                        }
                    }

                    console.error('Event creation error:', err && (err.message || err));
                    return { statusCode: 500, body: JSON.stringify({ error: 'Error creating event', details: (err && err.message) || String(err) }) };
                }
    } catch (error) {
        console.error("Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};