import { renderAgenda } from './agenda.js';
import { renderInforme } from './informe_modular.js';

// Función para inicializar el Dashboard y controlar los permisos
const initDashboard = async () => {
    const user = window.netlifyIdentity?.currentUser();
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    document.getElementById('user-email').innerText = user.email;

    // --- LÓGICA DE VALIDACIÓN DE ROL DESDE usuarios.json ---
    let esAdmin = false;
    try {
        // Llamamos a la función que lee tu carpeta /data/usuarios.json
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const data = await resp.json();
        
        if (data.usuarios && Array.isArray(data.usuarios)) {
            const usuarioEncontrado = data.usuarios.find(u => u.email === user.email);
            if (usuarioEncontrado && usuarioEncontrado.rol === 'admin') {
                esAdmin = true;
            }
        }
    } catch (error) {
        console.error("Error al consultar el archivo de usuarios:", error);
    }

    // --- CONTROL DE VISIBILIDAD DEL BOTÓN INFORME ---
    const btnInforme = document.getElementById('btn-informe');
    if (btnInforme) {
        if (esAdmin) {
            btnInforme.style.display = 'inline-block'; // Mostrar si es admin
        } else {
            btnInforme.remove(); // Eliminar por completo si no es admin
        }
    }

    // Asignar los eventos de los botones
    document.getElementById('btn-agenda').onclick = () => mostrarSeccion('agenda');
    document.getElementById('btn-reservas').onclick = () => mostrarSeccion('mis-reservas-futuras');
    if (esAdmin && btnInforme) {
        btnInforme.onclick = () => mostrarSeccion('informe');
    }
};

// Función para cambiar entre secciones
function mostrarSeccion(seccion) {
    // Ocultar todas las secciones primero
    const secciones = ['agenda-section', 'reservas-section', 'informe-section'];
    secciones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (seccion === 'agenda') {
        document.getElementById('agenda-section').style.display = 'block';
        renderAgenda(document.getElementById('agenda-container'));
    } 
    else if (seccion === 'mis-reservas-futuras') {
        document.getElementById('reservas-section').style.display = 'block';
        import('./informe_modular.js').then(mod => mod.renderMisReservasFuturas(document.getElementById('reservas-container')));
    } 
    else if (seccion === 'informe') {
        document.getElementById('informe-section').style.display = 'block';
        renderInforme(document.getElementById('informe-container'));
    }
}

// Escuchar el inicio de Netlify Identity
if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => {
        if (!user) window.location.href = "index.html";
        else initDashboard();
    });
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
}

document.getElementById('logout-btn').onclick = () => window.netlifyIdentity.logout();