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
        btn.className = 'btn';
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
    btnAtras.className = "btn btn-volver";
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
    // Crear contenedor visual de menú
    const menuGrid = document.createElement('div');
    menuGrid.className = 'menu-grid';

    const btnAgenda = document.createElement('button');
    btnAgenda.id = 'agenda-btn';
    btnAgenda.className = 'btn btn-primary btn-menu';
    btnAgenda.innerText = 'Agenda';
    btnAgenda.onclick = () => {
        mostrarSeccion('agenda');
    };
    menuGrid.appendChild(btnAgenda);

    // Botón de reservas futuras (nuevo, basado en informe)
    const btnMisReservasFuturas = document.createElement('button');
    btnMisReservasFuturas.id = 'mis-reservas-futuras-btn';
    btnMisReservasFuturas.className = 'btn btn-primary btn-menu';
    // Consultar al backend el rol real del usuario para el texto del botón y para el botón de informe
    let esAdmin = false;
    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        if (Array.isArray(js.usuarios)) {
            const actual = js.usuarios.find(u => u.email === user.email);
            if (actual && actual.rol === 'admin') esAdmin = true;
        }
    } catch {}
    btnMisReservasFuturas.innerText = esAdmin ? 'Reservas Futuras' : 'Mis Reservas Futuras';
    btnMisReservasFuturas.onclick = () => {
        mostrarSeccion('mis-reservas-futuras');
    };
    menuGrid.appendChild(btnMisReservasFuturas);

    if (esAdmin) {
        const btnInforme = document.createElement('button');
        btnInforme.id = 'informe-btn';
        btnInforme.className = 'btn btn-secondary btn-menu';
        btnInforme.innerText = 'Informe';
        btnInforme.onclick = () => mostrarSeccion('informe');
        menuGrid.appendChild(btnInforme);
    }
    btnsDiv.appendChild(menuGrid);
}

function mostrarSeccion(seccion) {
    // Ocultar todas las secciones
    document.getElementById('agenda-section').style.display = 'none';
    document.getElementById('reservas-section').style.display = 'none';
    document.getElementById('informe-section').style.display = 'none';
    let misReservasSection = document.getElementById('mis-reservas-futuras-section');
    if (misReservasSection) misReservasSection.style.display = 'none';
    // Mostrar la sección seleccionada y cargar su contenido
    if (seccion === 'agenda') {
        document.getElementById('agenda-section').style.display = '';
        renderAgenda(document.getElementById('agenda-container'));
    } else if (seccion === 'mis-reservas-futuras') {
        if (!misReservasSection) {
            misReservasSection = document.createElement('section');
            misReservasSection.id = 'mis-reservas-futuras-section';
            misReservasSection.className = 'card';
            document.querySelector('main.content').appendChild(misReservasSection);
        }
        misReservasSection.style.display = '';
        import('./informe_modular.js').then(mod => {
            mod.renderMisReservasFuturas(misReservasSection);
        });
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
        // --- NUEVA ESTRUCTURA DE TABLA ---
        const tablaContainer = document.createElement('div');
        tablaContainer.className = 'table-main-container';
        const tabla = document.createElement('table');
        tabla.className = 'custom-table';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th>Consultorio</th>
                    <th>Fecha y Hora</th>
                    <th>Usuario</th>
                    <th style="text-align:right">Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = tabla.querySelector('tbody');
        reservas.forEach(reserva => {
            const tr = document.createElement('tr');
            const fechaHora = `${reserva.fecha} ${reserva.hora}:00 hs`;
            const fechaReserva = new Date(`${reserva.fecha}T${reserva.hora.toString().padStart(2,'0')}:00:00-03:00`);
            const ahora = new Date();
            const diffHoras = (fechaReserva - ahora) / (1000 * 60 * 60);
            tr.innerHTML = `
                <td>Consultorio ${reserva.consultorio}</td>
                <td>${fechaHora}</td>
                <td>${reserva.nombre || reserva.email}</td>
                <td class="acciones-celda" style="text-align:right"></td>
            `;
            const tdAcciones = tr.querySelector('.acciones-celda');
            if (diffHoras > 24) {
                const btn = document.createElement('button');
                btn.innerText = 'Cancelar';
                btn.className = 'btn btn-danger btn-sm';
                btn.onclick = async () => {
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
                            tr.remove();
                        } else {
                            alert('No se pudo cancelar: ' + (result.error || result.details || 'Error desconocido'));
                        }
                    } catch (e) {
                        alert('Error al cancelar: ' + e.message);
                    }
                };
                tdAcciones.appendChild(btn);
            } else {
                tdAcciones.innerHTML = '<span class="no-cancelar">Bloqueado (-24h)</span>';
            }
            tbody.appendChild(tr);
        });
        container.appendChild(tablaContainer);
        tablaContainer.appendChild(tabla);
        const btnVolver = document.createElement('button');
        btnVolver.innerText = 'Volver a Agenda';
        btnVolver.className = 'btn-volver btn';
        btnVolver.onclick = cargarBotonesConsultorios;
        container.appendChild(btnVolver);
    } catch (e) {
        container.innerHTML += '<p style="color:red">Error al consultar reservas: ' + e.message + '</p>';
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
            // Asegurar que la tabla tenga la clase 'table' y esté dentro de un div 'table-container'
            fragment = fragment.replace(/<table([^>]*)>/gi, '<div class="table-container"><table$1 class="table">');
            fragment = fragment.replace(/<\/table>/gi, '</table></div>');
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
    });
}
