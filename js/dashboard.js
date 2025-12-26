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
        'admin-section',
        'abmusu-section'
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
    else if (seccion === 'abmusu') {
        const sec = document.getElementById('abmusu-section');
        const cont = document.getElementById('abmusu-container');
        if (sec && cont) {
            sec.style.display = 'block';
            // Cargar el módulo de ABM USUARIOS (puedes reemplazar esto por tu propio renderizador)
            import('./abmusu.js').then(mod => {
                if (mod.renderAbmUsu) {
                    mod.renderAbmUsu(cont);
                } else {
                    cont.innerHTML = '<p>ABM de usuarios disponible.</p>';
                }
            });
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

    const btnAbmUsu = document.getElementById('btn-abmusu');
    const btnLogout = document.getElementById('logout-btn');

    if (btnAgenda) btnAgenda.onclick = () => mostrarSeccion('agenda');
    if (btnReservas) btnReservas.onclick = () => mostrarSeccion('mis-reservas-futuras');
    if (btnInforme) btnInforme.onclick = () => mostrarSeccion('informe');
    if (btnAbmUsu) btnAbmUsu.onclick = () => mostrarSeccion('abmusu');

    if (btnLogout) {
        btnLogout.onclick = () => {
            window.netlifyIdentity.logout();
        };
    }

    // Por defecto, al entrar, mostramos la sección de Agenda
    mostrarSeccion('agenda');

    // Mostrar u ocultar el botón ABM USU solo para admin
    try {
        const email = user.email;
        const resp = await fetch('data/usuarios.json');
        const usuarios = await resp.json();
        const usuario = usuarios.find(u => u.email === email);
        if (usuario && usuario.rol === 'admin') {
            if (btnAbmUsu) btnAbmUsu.style.display = '';
        } else {
            if (btnAbmUsu) btnAbmUsu.style.display = 'none';
        }
    } catch (e) {
        if (btnAbmUsu) btnAbmUsu.style.display = 'none';
    }
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