import { renderAgenda } from './agenda.js';
import { renderInforme } from './informe_modular.js';

/**
 * Función principal para cambiar entre secciones del dashboard
 * @param {string} seccion - El nombre de la sección a mostrar
 */
function mostrarSeccion(seccion) {
    // 1. IDs de las secciones definidos en dashboard.html
    const seccionesIds = [
        'agenda-section', 
        'reservas-section', 
        'informe-section', 
        'admin-section'
    ];

    // 2. Ocultar todas las secciones para limpiar la pantalla
    seccionesIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 3. Actualizar el título principal (quitar el "Cargando...")
    const welcome = document.getElementById('welcome-msg');
    if (welcome) {
        welcome.innerText = "Panel de Gestión";
    }

    // 4. Lógica para activar la sección seleccionada
    if (seccion === 'agenda') {
        const sec = document.getElementById('agenda-section');
        const cont = document.getElementById('agenda-container');
        if (sec && cont) {
            sec.style.display = 'block';
            renderAgenda(cont);
        }
    } 
    else if (seccion === 'mis-reservas-futuras') {
        const sec = document.getElementById('reservas-section');
        const cont = document.getElementById('reservas-container');
        if (sec && cont) {
            sec.style.display = 'block';
            // Cargamos dinámicamente la función desde el módulo de informes
            import('./informe_modular.js').then(mod => {
                mod.renderMisReservasFuturas(cont);
            });
        }
    } 
    else if (seccion === 'informe') {
        const sec = document.getElementById('informe-section');
        const cont = document.getElementById('informe-container');
        if (sec && cont) {
            sec.style.display = 'block';
            renderInforme(cont);
        }
    }
}

/**
 * Configuración inicial del Dashboard al cargar la página
 */
const initDashboard = async () => {
    // Verificar si el usuario está autenticado mediante Netlify Identity
    const user = window.netlifyIdentity ? window.netlifyIdentity.currentUser() : null;
    
    if (!user) {
        console.warn("Usuario no autenticado, redirigiendo al login...");
        window.location.href = "index.html";
        return;
    }

    // Mostrar el email del usuario en la barra de navegación
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.innerText = user.email;

    // Configurar los eventos de los botones del menú
    const btnAgenda = document.getElementById('btn-agenda');
    const btnReservas = document.getElementById('btn-reservas');
    const btnInforme = document.getElementById('btn-informe');
    const btnLogout = document.getElementById('logout-btn');

    if (btnAgenda) btnAgenda.onclick = () => mostrarSeccion('agenda');
    if (btnReservas) btnReservas.onclick = () => mostrarSeccion('mis-reservas-futuras');
    if (btnInforme) btnInforme.onclick = () => mostrarSeccion('informe');
    
    if (btnLogout) {
        btnLogout.onclick = () => {
            window.netlifyIdentity.logout();
        };
    }

    // Por defecto, al entrar, mostramos la sección de Agenda
    mostrarSeccion('agenda');
};

// --- Manejo de eventos de Netlify Identity ---
if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => {
        if (user) {
            initDashboard();
        } else {
            window.location.href = "index.html";
        }
    });

    window.netlifyIdentity.on("login", user => {
        initDashboard();
    });

    window.netlifyIdentity.on("logout", () => {
        window.location.href = "index.html";
    });
} else {
    console.error("Netlify Identity no detectado. Verifica el script en el HTML.");
}