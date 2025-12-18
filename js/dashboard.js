// js/dashboard.js
import { APP_CONFIG } from './config.js';

// Función para reservar el turno llamando a la Netlify Function
const reservarTurno = async (consultorioNum, hora) => {
    const user = netlifyIdentity.currentUser();
    
    // Confirmación simple
    const confirmar = confirm(`¿Desea agendar el Consultorio ${consultorioNum} a las ${hora}:00 hs?`);
    if (!confirmar) return;

    // Obtenemos la fecha de hoy en formato YYYY-MM-DD
    const fechaHoy = new Date().toISOString().split('T')[0];

    try {
        // Mostramos un mensaje de carga
        const container = document.getElementById('calendar-container');
        const originalContent = container.innerHTML;
        container.innerHTML = "<p>⌛ Procesando reserva en Google Calendar...</p>";

        const respuesta = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                consultorio: consultorioNum,
                fecha: fechaHoy,
                hora: hora.toString().padStart(2, '0')
            })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert("✅ ¡Éxito! El turno ha sido agendado en demariaconsultorios1334@gmail.com");
            cargarBotonesConsultorios(); // Volver al inicio
        } else {
            throw new Error(resultado.error || "Error desconocido");
        }
    } catch (err) {
        console.error("Error al reservar:", err);
        alert("❌ No se pudo agendar: " + err.message);
        cargarBotonesConsultorios(); // Volver para intentar de nuevo
    }
};

// Función para generar la lista de horarios (de 8 a 20hs según config.js)
const mostrarHorarios = (consultorioNum) => {
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Horarios Disponibles - Consultorio ${consultorioNum}</h3>`;
    
    const listaHorarios = document.createElement('div');
    listaHorarios.className = 'horarios-grid';

    const { inicio, fin } = APP_CONFIG.horarios;

    for (let hora = inicio; hora < fin; hora++) {
        const slot = document.createElement('button');
        slot.className = 'btn-horario';
        slot.innerText = `${hora.toString().padStart(2, '0')}:00 hs`;
        
        slot.onclick = () => reservarTurno(consultorioNum, hora);
        
        listaHorarios.appendChild(slot);
    }

    // Botón para volver atrás
    const btnVolver = document.createElement('button');
    btnVolver.innerText = "← Volver a Consultorios";
    btnVolver.className = "btn-volver";
    btnVolver.onclick = () => cargarBotonesConsultorios();

    container.appendChild(listaHorarios);
    container.appendChild(btnVolver);
};

// Función para dibujar los botones de los consultorios [2, 3, 4, 5]
const cargarBotonesConsultorios = () => {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    container.innerHTML = '<h3>Seleccione un Consultorio:</h3>';
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'consultorios-grid';

    APP_CONFIG.consultorios.forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn-consultorio';
        btn.onclick = () => mostrarHorarios(num);
        btnGroup.appendChild(btn);
    });
    container.appendChild(btnGroup);
};

// Inicialización del Dashboard
const initDashboard = () => {
    const user = netlifyIdentity.currentUser();

    // Seguridad: Si no hay usuario, redirigir al login
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // Mostrar email del usuario
    document.getElementById('user-email').innerText = user.email;
    
    // Lógica de Admin
    const roles = user.app_metadata ? user.app_metadata.roles : [];
    const isAdmin = roles && roles.includes("admin");

    if (isAdmin) {
        document.getElementById('admin-section').style.display = "block";
        document.getElementById('welcome-msg').innerText = `Admin: ${APP_CONFIG.nombreProyecto}`;
    } else {
        document.getElementById('welcome-msg').innerText = "Reserva de Turnos";
    }

    cargarBotonesConsultorios();

    // Botón de Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = () => netlifyIdentity.logout();
    }
};

// Eventos de Netlify Identity
if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => {
        if (!user) window.location.href = "index.html";
        else initDashboard();
    });
    
    window.netlifyIdentity.on("logout", () => {
        window.location.href = "index.html";
    });
}