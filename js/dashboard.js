// js/dashboard.js
import { APP_CONFIG } from './config.js';

// Función para inicializar el panel
const initDashboard = () => {
    const user = netlifyIdentity.currentUser();

    // 1. Seguridad: Si no hay usuario, fuera
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    // 2. Interfaz básica
    document.getElementById('user-email').innerText = user.email;
    
    // 3. Lógica de Roles
    const roles = user.app_metadata ? user.app_metadata.roles : [];
    const isAdmin = roles && roles.includes("admin");

    if (isAdmin) {
        document.getElementById('admin-section').style.display = "block";
        document.getElementById('welcome-msg').innerText = `Admin: ${APP_CONFIG.nombreProyecto}`;
    } else {
        document.getElementById('welcome-msg').innerText = "Reserva de Turnos";
    }

    // 4. Dibujar los Consultorios automáticamente desde config.js
    const container = document.getElementById('calendar-container');
    container.innerHTML = '<h3>Seleccione un Consultorio:</h3>';
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'consultorios-grid';

    APP_CONFIG.consultorios.forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn-consultorio';
        btn.onclick = () => alert(`Cargando agenda del Consultorio ${num}...`);
        btnGroup.appendChild(btn);
    });
    container.appendChild(btnGroup);

    // 5. Botón Cerrar Sesión
    document.getElementById('logout-btn').addEventListener('click', () => {
        netlifyIdentity.logout();
    });
};

// Esperar a que Identity esté listo
if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", initDashboard);
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
}