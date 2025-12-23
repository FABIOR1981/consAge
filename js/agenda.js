async function ejecutarReserva(hora, targetContainer) {
    const user = window.netlifyIdentity.currentUser();
    if (!user) return alert("Debes estar logueado");

    const confirmacion = confirm(`¿Reservar Consultorio ${seleccion.consultorio} a las ${hora}:00 hs?`);
    if(!confirmacion) return;

    // Mostramos un mensaje de carga
    const originalContent = targetContainer.innerHTML;
    targetContainer.innerHTML = "<p>Procesando reserva, por favor espere...</p>";

    try {
        const payload = {
            email: user.email,
            nombre: user.user_metadata?.full_name || user.email,
            consultorio: seleccion.consultorio.toString(), // Enviamos como string por seguridad
            fecha: seleccion.fecha,
            hora: parseInt(hora),
            colorId: (APP_CONFIG.coloresConsultorios && APP_CONFIG.coloresConsultorios[seleccion.consultorio]) 
                      ? APP_CONFIG.coloresConsultorios[seleccion.consultorio].toString() 
                      : "1"
        };

        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (resp.ok) {
            alert("✅ ¡Reserva confirmada!");
            cargarHorarios(targetContainer);
        } else {
            const errorData = await resp.json();
            alert("❌ Error: " + (errorData.error || "No se pudo realizar"));
            targetContainer.innerHTML = originalContent; // Restaurar la tabla si falla
        }
    } catch (e) {
        alert("Error de conexión con el servidor");
        targetContainer.innerHTML = originalContent;
    }
}