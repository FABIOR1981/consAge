import { APP_CONFIG } from './config.js';

const user = netlifyIdentity.currentUser();

// 1. Si no hay usuario, mandarlo de vuelta al mantenimiento
if (!user) {
    window.location.href = "index.html";
}

// 2. Mostrar email y saludo
document.getElementById('user-email').innerText = user.email;

// 3. Lógica de ABM: Diferenciar Admin de Usuario Normal
const roles = user.app_metadata.roles || [];
if (roles.includes("admin")) {
    document.getElementById('admin-section').style.display = "block";
    document.getElementById('welcome-msg').innerText = "Panel de Administración";
}

// 4. Botón de Cerrar Sesión
document.getElementById('logout-btn').addEventListener('click', () => {
    netlifyIdentity.logout();
});

netlifyIdentity.on("logout", () => {
    window.location.href = "index.html";
});