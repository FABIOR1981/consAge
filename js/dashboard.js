import { renderAgenda } from './agenda.js';
import { renderInforme } from './informe_modular.js';


// ================= ZONA DE SECCIONES =================

// --- Utilidad para limpiar CSS de sección ---
function limpiarCssSeccion() {
    const ids = ['agenda-css', 'reservas-css', 'informe-css', 'abmusu-css'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

// --- Sección Agenda ---
function cargarEstiloAgenda() {
    limpiarCssSeccion();
    if (!document.getElementById('agenda-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_agenda.css';
        link.id = 'agenda-css';
        document.head.appendChild(link);
    }
}

function mostrarAgenda() {
    cargarEstiloAgenda();
    const sec = document.getElementById('agenda-section');
    const cont = document.getElementById('agenda-container');
    if (sec && cont) {
        sec.style.display = 'block';
        renderAgenda(cont);
    }
}

// --- Sección Reservas Futuras ---
function cargarEstiloReservas() {
    limpiarCssSeccion();
    if (!document.getElementById('reservas-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_reservas.css';
        link.id = 'reservas-css';
        document.head.appendChild(link);
    }
}

function mostrarReservas() {
    cargarEstiloReservas();
    const sec = document.getElementById('reservas-section');
    const cont = document.getElementById('reservas-container');
    if (sec && cont) {
        sec.style.display = 'block';
        import('./informe_modular.js').then(mod => {
            mod.renderMisReservasFuturas(cont);
        });
    }
}

// --- Sección Informe ---
function cargarEstiloInforme() {
    limpiarCssSeccion();
    if (!document.getElementById('informe-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_informe.css';
        link.id = 'informe-css';
        document.head.appendChild(link);
    }
}

function mostrarInforme() {
    cargarEstiloInforme();
    const sec = document.getElementById('informe-section');
    const cont = document.getElementById('informe-container');
    if (sec && cont) {
        sec.style.display = 'block';
        renderInforme(cont);
    }
}

// --- Sección ABM USU ---
function cargarEstiloAbmUsu() {
    limpiarCssSeccion();
    if (!document.getElementById('abmusu-css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/2_abmusu.css';
        link.id = 'abmusu-css';
        document.head.appendChild(link);
    }
}

function mostrarAbmUsu() {
    cargarEstiloAbmUsu();
    const sec = document.getElementById('abmusu-section');
    const cont = document.getElementById('abmusu-container');
    if (sec && cont) {
        sec.style.display = 'block';
        import('./abmusu.js').then(mod => {
            if (mod.renderAbmUsu) {
                mod.renderAbmUsu(cont);
            } else {
                cont.innerHTML = '<p>ABM de usuarios disponible.</p>';
            }
        });
    }
}

// --- Controlador de Secciones ---
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

    // 4. Mostrar la sección correspondiente
    if (seccion === 'agenda') mostrarAgenda();
    else if (seccion === 'mis-reservas-futuras') mostrarReservas();
    else if (seccion === 'informe') mostrarInforme();
    else if (seccion === 'abmusu') mostrarAbmUsu();
}

/**
 * Configuración inicial del Dashboard al cargar la página
 */
const initDashboard = async () => {
    // Verificar si el usuario está autenticado localmente (por ejemplo, en localStorage)
    const user = JSON.parse(localStorage.getItem('usuario_logueado'));
    if (!user) {
        window.location.href = "index2.html";
        return;
    }
    // Mostrar el email o documento del usuario en la barra de navegación
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.innerText = user.email || user.documento;

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
            localStorage.removeItem('usuario_logueado');
            window.location.href = "index2.html";
        };
    }

    // Por defecto, al entrar, mostramos la sección de Agenda
    mostrarSeccion('agenda');

    // Mostrar u ocultar el botón ABM USU solo para admin
    try {
        const resp = await fetch('data/usuarios.json');
        const usuarios = await resp.json();
        // Buscar por email o documento
        let usuario = null;
        if (user.email) {
            usuario = usuarios.find(u => u.email === user.email);
        }
        if (!usuario && user.documento) {
            usuario = usuarios.find(u => u.documento === user.documento);
        }
        if (usuario && usuario.rol === 'admin') {
            if (btnAbmUsu) btnAbmUsu.style.display = '';
        } else {
            if (btnAbmUsu) btnAbmUsu.style.display = 'none';
        }
    } catch (e) {
        if (btnAbmUsu) btnAbmUsu.style.display = 'none';
    }
};

// --- Eliminado manejo de Netlify Identity ---