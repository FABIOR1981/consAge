// descargarConfirmacionReserva.js
// Función aislada para generar y descargar un PDF de confirmación de reserva
// Requiere la librería jsPDF (https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js)

export async function descargarConfirmacionReserva({ nombre, fecha, hora, consultorio, email }) {
    // Cargar jsPDF si no está presente
    if (!window.jspdf) {
        await new Promise(resolve => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('Consultorios de Maria', 20, 20);
    doc.setFontSize(12);
    doc.text(`Reserva confirmada para: ${nombre}`, 20, 35);
    doc.text(`Email: ${email || '-'}`, 20, 45);
    doc.text(`Consultorio: ${consultorio}`, 20, 55);
    doc.text(`Fecha: ${fecha}`, 20, 65);
    doc.text(`Hora: ${hora}`, 20, 75);
    doc.text('Gracias por reservar. Ante cualquier duda, comuníquese al 091001334.', 20, 90);
    doc.save(`confirmacion_reserva_${nombre}_${fecha}_${hora}.pdf`);
}

export function enviarWhatsAppConfirmacion({ nombre, fecha, hora, consultorio, email }) {
    // 1. Definir el número de teléfono (destino)
    // Si es para el cliente, deberías tener su número en los parámetros.
    // Si es para el consultorio, pon el número fijo aquí.
    const telefono = "59891001334"; // Formato internacional sin el "+"

    // 2. Crear el mensaje usando Template Literals y saltos de línea (%0A)
    const mensaje = `*Consultorios de Maria*%0A%0A` +
                    `✅ *Reserva confirmada*%0A` +
                    `👤 *Paciente:* ${nombre}%0A` +
                    `📧 *Email:* ${email || '-'}%0A` +
                    `🏥 *Consultorio:* ${consultorio}%0A` +
                    `📅 *Fecha:* ${fecha}%0A` +
                    `⏰ *Hora:* ${hora}%0A%0A` +
                    `¡Gracias por reservar!`;

    // 3. Detectar si es un dispositivo móvil
    const esMovil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 4. Elegir el enlace correcto
    // En móviles usamos 'whatsapp://send' para forzar la App
    // En PC usamos 'web.whatsapp.com' para el navegador
    let url;
    if (esMovil) {
        url = `whatsapp://send?phone=${telefono}&text=${texto}`;
    } else {
        url = `https://web.whatsapp.com/send?phone=${telefono}&text=${texto}`;
    }

    // 5. Abrir el enlace
    window.open(url, '_blank');
}
