import { APP_CONFIG } from './config.js';

// Función para generar los horarios disponibles
const mostrarHorarios = (consultorioNum) => {
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Turnos para el Consultorio ${consultorioNum}</h3>`;
    
    const listaHorarios = document.createElement('div');
    listaHorarios.className = 'horarios-grid';

    const { inicio, fin, intervalo } = APP_CONFIG.horarios;

    for (let hora = inicio; hora < fin; hora++) {
        const slot = document.createElement('button');
        slot.className = 'btn-horario';
        slot.innerText = `${hora.toString().padStart(2, '0')}:00 hs`;
        
        slot.onclick = () => {
            alert(`Reservando en Consultorio ${consultorioNum} a las ${hora}:00 hs. (Próximo paso: Google Calendar)`);
        };
        
        listaHorarios.appendChild(slot);
    }

    // Botón para volver a la selección de consultorios
    const btnVolver = document.createElement('button');
    btnVolver.innerText = "← Volver a Consultorios";
    btnVolver.className = "btn-volver";
    btnVolver.onclick = () => cargarBotonesConsultorios();

    container.appendChild(listaHorarios);
    container.appendChild(btnVolver);
};

// Función para dibujar los botones principales
const cargarBotonesConsultorios = () => {
    const container = document.getElementById('calendar-container');
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

const initDashboard = () => {
    const user = netlifyIdentity.currentUser();
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    document.getElementById('user-email').innerText = user.email;
    
    const roles = user.app_metadata ? user.app_metadata.roles : [];
    if (roles.includes("admin")) {
        document.getElementById('admin-section').style.display = "block";
        document.getElementById('welcome-msg').innerText = `Admin: ${APP_CONFIG.nombreProyecto}`;
    } else {
        document.getElementById('welcome-msg').innerText = "Reserva de Turnos";
    }

    cargarBotonesConsultorios();

    document.getElementById('logout-btn').addEventListener('click', () => {
        netlifyIdentity.logout();
    });
};

if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", initDashboard);
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
}