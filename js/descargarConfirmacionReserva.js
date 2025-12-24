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
    doc.text('Gracias por reservar. Ante cualquier duda, comuníquese con recepción.', 20, 90);
    doc.save(`confirmacion_reserva_${nombre}_${fecha}_${hora}.pdf`);
}
