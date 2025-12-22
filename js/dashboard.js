// js/dashboard.js
import { renderReservas } from './reservas.js';
import { renderAgenda } from './agenda.js';
import { renderInforme } from './informe_modular.js';

let seleccion = {
    consultorio: null,
    fecha: null
};

const reservarTurno = async (hora) => {
    const user = netlifyIdentity.currentUser();
    const textoConfirmar = `¿Confirmar Consultorio ${seleccion.consultorio}\nFecha: ${seleccion.fecha}\nHora: ${hora}:00 hs?`;
    if (!confirm(textoConfirmar)) return;

    const container = document.getElementById('calendar-container');
    container.innerHTML = "<p>⌛ Procesando reserva y enviando invitaciones...</p>";

    try {
        // asegurar que enviamos un colorId válido (fallback si no está definido)
        const colorLookup = APP_CONFIG.coloresConsultorios || {};
        const defaultColor = Object.values(colorLookup)[0] || '1';
        const colorIdToSend = colorLookup[seleccion.consultorio] || defaultColor;

        const displayName = (user && (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name))) || (user && user.name) || user.email;
        const respuesta = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                nombre: displayName,
                consultorio: seleccion.consultorio,
                fecha: seleccion.fecha,
                hora: hora,
                colorId: colorIdToSend
            })
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            alert("✅ ¡Éxito! Turno agendado. Revisa tu email y calendario.");
            cargarBotonesConsultorios();
        } else {
            const msg = datos && (datos.error || datos.details) ? `${datos.error || ''} ${datos.details || ''}` : 'Error desconocido';
            const extras = datos && datos.missing ? `\nCampos faltantes: ${datos.missing.join(', ')}` : '';
            const ocup = datos && datos.ocupados ? `\nOcupados: ${JSON.stringify(datos.ocupados)}` : '';
            alert(`❌ No se pudo reservar:\n${msg}${extras}${ocup}`);
            throw new Error(msg);
        }
    } catch (err) {
        alert("❌ Error: " + err.message);
        mostrarHorarios();
    }
};

let envIdPorHora = {};

const elegirFecha = (num) => {
    seleccion.consultorio = num;
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Seleccione Día (Consultorio ${num})</h3>`;
    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'input-calendario';
    input.min = new Date().toISOString().split('T')[0];
    input.onchange = (e) => {
        const selected = new Date(e.target.value + 'T00:00:00');
        const d = selected.getDay();
        if (d === 0 || d === 6) { alert("No se pueden elegir fines de semana."); return; }
        seleccion.fecha = e.target.value;
        mostrarHorarios();
    };
    container.appendChild(input);
    const btnAtras = document.createElement('button');
    btnAtras.innerText = "← Volver";
    btnAtras.className = "btn-volver";
    btnAtras.onclick = cargarBotonesConsultorios;
    container.appendChild(btnAtras);
};

const mostrarHorarios = async () => {
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Horarios: C${seleccion.consultorio} para el ${seleccion.fecha}</h3>`;
    const user = netlifyIdentity.currentUser();
    let horasDisponibles = [];
    let ocupadasPorUsuario = [];
    let userEvents = [];
    envIdPorHora = {};
    try {
        const resp = await fetch(`/.netlify/functions/reservar?email=${encodeURIComponent(user.email)}&fecha=${seleccion.fecha}&consultorio=${seleccion.consultorio}`);
        const data = await resp.json();
        horasDisponibles = data.horasDisponibles;
        ocupadasPorUsuario = data.ocupadasPorUsuario;
        userEvents = data.userEvents || [];
        userEvents.forEach(ev => { envIdPorHora[ev.hora] = ev.eventId; });
    } catch (e) {
        container.innerHTML += '<p style="color:red">No se pudo cargar la disponibilidad.</p>';
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'horarios-grid';
    for (let h = APP_CONFIG.horarios.inicio; h < APP_CONFIG.horarios.fin; h++) {
        const btn = document.createElement('button');
        btn.className = 'btn-horario';
        btn.innerText = `${h.toString().padStart(2, '0')}:00`;
        if (ocupadasPorUsuario.includes(h)) {
            btn.classList.add('ocupado-usuario');
            btn.innerText += ' (Tuyo)';
            btn.onclick = () => cancelarReserva(h);
        } else if (!horasDisponibles.includes(h)) {
            btn.disabled = true;
            btn.classList.add('ocupado-otro');
        } else {
            btn.classList.add('libre');
            btn.onclick = () => reservarTurno(h);
        }
        grid.appendChild(btn);
    }
    container.appendChild(grid);
    const btnAtras = document.createElement('button');
    btnAtras.innerText = "← Cambiar Fecha";
    btnAtras.className = "btn-volver";
    btnAtras.onclick = () => elegirFecha(seleccion.consultorio);
    container.appendChild(btnAtras);
};

const cancelarReserva = async (hora) => {
    const user = netlifyIdentity.currentUser();
    const eventId = envIdPorHora[hora];
    if (!eventId) { alert('No se encontró el ID del evento para cancelar.'); return; }
    if (!confirm(`¿Cancelar tu reserva de las ${hora}:00 hs?`)) return;
    try {
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, email: user.email })
        });
        const data = await resp.json();
        if (resp.ok) {
            alert('Reserva cancelada correctamente.');
            mostrarHorarios();
        } else {
            alert('No se pudo cancelar: ' + (data.error || data.details || 'Error desconocido'));
        }
    } catch (e) {
        alert('Error al cancelar: ' + e.message);
    }
};

const cargarBotonesConsultorios = () => {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '<h3>Paso 1: Elija un Consultorio</h3>';
    const grid = document.createElement('div');
    grid.className = 'consultorios-grid';
    APP_CONFIG.consultorios.filter(num => num !== 1).forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn-consultorio';
        btn.onclick = () => elegirFecha(num);
        grid.appendChild(btn);
    });
    container.appendChild(grid);
};

async function renderDashboardButtons(user) {
    const btnsDiv = document.getElementById('dashboard-btns');
    if (!btnsDiv) return;
    btnsDiv.innerHTML = '';
    const btnAgenda = document.createElement('button');
    btnAgenda.id = 'agenda-btn';
    btnAgenda.className = 'btn-secondary';
    btnAgenda.innerText = 'Agenda';
    btnAgenda.onclick = () => {
        mostrarSeccion('agenda');
    };
    btnsDiv.appendChild(btnAgenda);
        const btnReservas = document.createElement('button');
        btnReservas.id = 'mis-reservas-btn';
        btnReservas.className = 'btn-primary';
        btnReservas.innerText = 'Reservas';
        btnReservas.onclick = () => {
            const container = document.getElementById('calendar-container');
            container.innerHTML = '';
            renderReservas(document.getElementById('reservas-container'));
        };
        btnsDiv.appendChild(btnReservas);

    // Consultar al backend el rol real del usuario
    let esAdmin = false;
    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        if (Array.isArray(js.usuarios)) {
            const actual = js.usuarios.find(u => u.email === user.email);
            if (actual && actual.rol === 'admin') esAdmin = true;
        }
    } catch {}
    if (esAdmin) {
        btnMisReservas.innerText = 'Reservas';
        const btnInforme = document.createElement('button');
        btnInforme.id = 'informe-btn';
        btnInforme.className = 'btn-secondary';
        btnInforme.innerText = 'Informe';
        btnInforme.onclick = renderInformeEnDashboard;
        btnsDiv.appendChild(btnInforme);
    }
}

function mostrarSeccion(seccion) {
    // Ocultar todas las secciones
    document.getElementById('agenda-section').style.display = 'none';
    document.getElementById('reservas-section').style.display = 'none';
    document.getElementById('informe-section').style.display = 'none';
    // Mostrar la sección seleccionada y cargar su contenido
    if (seccion === 'agenda') {
        document.getElementById('agenda-section').style.display = '';
        renderAgenda(document.getElementById('agenda-container'));
    } else if (seccion === 'reservas') {
        document.getElementById('reservas-section').style.display = '';
        renderReservas(document.getElementById('reservas-container'));
    } else if (seccion === 'informe') {
        document.getElementById('informe-section').style.display = '';
        renderInforme(document.getElementById('informe-container'));
    }
}

// Nueva función para mostrar reservas de un usuario (o todas si email vacío)
async function mostrarMisReservasAdmin(emailFiltro, isAdmin, usuariosLista) {
    const user = netlifyIdentity.currentUser();
    const container = document.getElementById('calendar-container');
    try {
        let url = '/.netlify/functions/reservar';
        let emailFiltroValor = emailFiltro && typeof emailFiltro === 'object' ? emailFiltro.email : emailFiltro;
        let nombreFiltroValor = emailFiltro && typeof emailFiltro === 'object' ? emailFiltro.nombre : '';
        // Siempre pedir todas las reservas futuras (all=1) para admin, filtrar en frontend
        if (isAdmin) {
            url += '?all=1';
        } else if (emailFiltroValor) {
            url += `?email=${encodeURIComponent(emailFiltroValor)}`;
        }
        const resp = await fetch(url);
        const data = await resp.json();
        let reservas = data.userEvents || [];
        // Filtrar SOLO por el usuario seleccionado (email o nombre exacto)
        const emailFiltroLower = (emailFiltroValor || '').toLowerCase();
        const nombreFiltroLower = (nombreFiltroValor || '').toLowerCase();
        reservas = reservas.filter(reserva => {
            const nombreReserva = (reserva.nombre || '').toLowerCase();
            const emailReserva = (reserva.email || '').toLowerCase();
            // Coincidencia exacta por email o nombre
            return (emailFiltroLower && emailReserva === emailFiltroLower) || (nombreFiltroLower && nombreReserva === nombreFiltroLower);
        });
        // Filtrar solo reservas futuras
        const ahora = new Date();
        reservas = reservas.filter(reserva => {
            const fechaReserva = new Date(`${reserva.fecha}T${reserva.hora.toString().padStart(2,'0')}:00:00-03:00`);
            return fechaReserva > ahora;
        });
        if (reservas.length === 0) {
            container.innerHTML += '<p>No hay reservas activas.</p>';
            return;
        }
        const lista = document.createElement('div');
        lista.className = 'reservas-lista';
        reservas.forEach(reserva => {
            const card = document.createElement('div');
            card.className = 'reserva-card';
            card.style.border = '1px solid #ccc';
            card.style.borderRadius = '8px';
            card.style.background = '#fafbff';
            card.style.margin = '1em 0';
            card.style.padding = '1em';
            card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '0.5em';
            const fechaHora = `${reserva.fecha} ${reserva.hora}:00 hs`;
            const fechaReserva = new Date(`${reserva.fecha}T${reserva.hora.toString().padStart(2,'0')}:00:00-03:00`);
            const ahora = new Date();
            const diffHoras = (fechaReserva - ahora) / (1000 * 60 * 60);
            const esCancelada = reserva.summary && reserva.summary.startsWith('Cancelada');
            if (esCancelada) return;
            card.innerHTML = `
                <div style="font-weight:bold;font-size:1.1em;color:#2a3a5a;">Consultorio ${reserva.consultorio}</div>
                <div><span style="color:#555;">${fechaHora}</span></div>
                <div><span style="color:#1a4">${reserva.nombre || reserva.email}</span></div>
            `;
            if (diffHoras > 24) {
                const btnCancelar = document.createElement('button');
                btnCancelar.innerText = 'Cancelar';
                btnCancelar.className = 'btn-cancelar';
                btnCancelar.style.background = '#e74c3c';
                btnCancelar.style.color = '#fff';
                btnCancelar.style.border = 'none';
                btnCancelar.style.borderRadius = '4px';
                btnCancelar.style.padding = '0.5em 1.2em';
                btnCancelar.style.fontWeight = 'bold';
                btnCancelar.style.cursor = 'pointer';
                btnCancelar.style.marginTop = '0.5em';
                btnCancelar.onclick = async () => {
                    if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;
                    try {
                        const resp = await fetch('/.netlify/functions/reservar', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ eventId: reserva.eventId, email: reserva.email })
                        });
                        const result = await resp.json();
                        if (resp.ok) {
                            alert('Reserva cancelada correctamente.');
                            card.remove();
                        } else {
                            alert('No se pudo cancelar: ' + (result.error || result.details || 'Error desconocido'));
                        }
                    } catch (e) {
                        alert('Error al cancelar: ' + e.message);
                    }
                };
                card.appendChild(btnCancelar);
            } else {
                const noCancel = document.createElement('span');
                noCancel.style.color = 'gray';
                noCancel.style.marginTop = '0.5em';
                noCancel.innerText = '(No se puede cancelar: menos de 24h)';
                card.appendChild(noCancel);
            }
            lista.appendChild(card);
        });
        container.appendChild(lista);
        const btnVolver = document.createElement('button');
        btnVolver.innerText = 'Volver a Agenda';
        btnVolver.className = 'btn-volver';
        btnVolver.style.marginTop = '1.5em';
        btnVolver.onclick = cargarBotonesConsultorios;
        container.appendChild(btnVolver);
    } catch (e) {
        container.innerHTML += `<p style='color:red'>Error al consultar reservas: ${e.message}</p>`;
    }
}

async function renderInformeEnDashboard() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '<h3>Informe de Reservas</h3><p>Cargando informe...</p>';
    try {
        const resp = await fetch('informe.html');
        let html = await resp.text();
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            let fragment = bodyMatch ? bodyMatch[1] : html;
            // Eliminar tags <script> que carguen el propio informe.js para evitar doble carga
            fragment = fragment.replace(/<script[^>]+src=["']?[^"'>]*informe\.js[^"'>]*["']?[^>]*>[\s\S]*?<\/script>/gi, '');
            container.innerHTML = '<h3>Informe de Reservas</h3>' + fragment;
        // Cargar e inicializar el script del informe (dinámicamente) para que el combo y el formulario funcionen
        try {
            // Esperar un frame para que el HTML inyectado se procese por el navegador
            await new Promise(r => requestAnimationFrame(r));
            // Import dinámico resuelto respecto al módulo actual (más robusto que un string relativo)
            const mod = await import(new URL('./informe.js', import.meta.url));
            if (mod && typeof mod.initInforme === 'function') mod.initInforme();
        } catch (impErr) {
            // Silenciar error de inicialización de informe.js
        }
    } catch (e) {
        container.innerHTML += `<p style='color:red'>Error al cargar informe: ${e.message}</p>`;
    }
}

const initDashboard = async () => {
    const user = netlifyIdentity.currentUser();
    if (!user) { window.location.href = "index.html"; return; }
    // Mostrar email y rol debajo
    const emailSpan = document.getElementById('user-email');
    emailSpan.innerText = user.email;
    // Consultar el rol real del usuario
    let rol = '';
    let rolMsg = '';
    let usuariosDebug = [];
    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        if (Array.isArray(js.usuarios)) {
            usuariosDebug = js.usuarios;
            const actual = js.usuarios.find(u => u.email === user.email);
            if (actual && actual.rol) {
                rol = actual.rol;
                rolMsg = `Rol: ${rol}`;
            } else {
                rolMsg = 'Rol no encontrado';
            }
        } else {
            rolMsg = 'No se pudo obtener el rol';
        }
    } catch {
        rolMsg = 'No se pudo obtener el rol';
    }
    // Crear o actualizar un span para el rol, siempre debajo del email
    let rolSpan = document.getElementById('user-rol');
    if (!rolSpan) {
        rolSpan = document.createElement('span');
        rolSpan.id = 'user-rol';
        rolSpan.style.display = 'block';
        rolSpan.style.fontSize = '0.95em';
        rolSpan.style.color = '#888';
        // Insertar justo después del email
        if (emailSpan.nextSibling) {
            emailSpan.parentNode.insertBefore(rolSpan, emailSpan.nextSibling);
        } else {
            emailSpan.parentNode.appendChild(rolSpan);
        }
    }
    rolSpan.innerText = rolMsg;
    // ...bloque de depuración eliminado...
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) welcomeMsg.innerText = "Bienvenidos a la agenda de DeMaria Consultores. ¡Gestiona tus turnos de forma fácil y rápida!";
    await renderDashboardButtons(user);
    // La agenda ahora es modular, no se llama aquí
};

if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => { if(user) initDashboard(); else window.location.href="index.html"; });
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => window.netlifyIdentity.logout());

        // ...existing code...
