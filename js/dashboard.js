// js/dashboard.js
import { APP_CONFIG } from './config.js';

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
    btnAgenda.onclick = cargarBotonesConsultorios;
    btnsDiv.appendChild(btnAgenda);
    const btnMisReservas = document.createElement('button');
    btnMisReservas.id = 'mis-reservas-btn';
    btnMisReservas.className = 'btn-primary';
    // Por defecto, texto para usuario normal
    btnMisReservas.innerText = 'Mis Reservas';
    btnMisReservas.onclick = mostrarMisReservas;
    btnsDiv.appendChild(btnMisReservas);

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

async function mostrarMisReservas(emailFiltro = null, usuariosLista = null) {
    const container = document.getElementById('calendar-container');
    const user = netlifyIdentity.currentUser();
    if (!user) return;
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
    // DEBUG: Mostrar respuesta cruda de reservas SIEMPRE visible y al inicio del contenedor
    let debugReservaSpan = document.getElementById('debug-reservas');
    // container ya está declarado al inicio de la función
    if (!debugReservaSpan) {
        debugReservaSpan = document.createElement('pre');
        debugReservaSpan.id = 'debug-reservas';
        debugReservaSpan.style.fontSize = '0.85em';
        debugReservaSpan.style.color = '#006';
        debugReservaSpan.style.background = '#f8f8ff';
        debugReservaSpan.style.border = '1px solid #bbf';
        debugReservaSpan.style.padding = '0.5em';
        debugReservaSpan.style.marginTop = '0.5em';
        // Insertar siempre al principio del contenedor
        if (container.firstChild) {
            container.insertBefore(debugReservaSpan, container.firstChild);
        } else {
            container.appendChild(debugReservaSpan);
        }
    }
    // Llamar al backend de reservas y mostrar la respuesta cruda
    let debugMsg = '';
    try {
        const resp = await fetch('/.netlify/functions/reservar?email=' + encodeURIComponent(user.email));
        let text = await resp.text();
        let data = null;
        try { data = JSON.parse(text); } catch {}
        if (!resp.ok) {
            debugMsg = 'DEBUG reservas: ERROR ' + resp.status + '\n' + (data && data.error ? data.error + (data.details ? ('\nDetalles: ' + data.details) : '') : text) + '\n(Eliminar este bloque luego)';
        } else {
            debugMsg = 'DEBUG reservas (/.netlify/functions/reservar):\n' + JSON.stringify(data, null, 2) + '\n(Eliminar este bloque luego)';
        }
    } catch (e) {
        debugMsg = 'DEBUG reservas: error al consultar backend: ' + e.message;
    }
    container.innerHTML = `<h3>${esAdmin ? 'Reservas' : 'Mis Reservas'}</h3><p>Consultando reservas...</p>`;
    // Insertar el bloque de depuración SIEMPRE arriba (sin redeclarar)
    var debugReservaSpan = document.getElementById('debug-reservas');
    if (!debugReservaSpan) {
        debugReservaSpan = document.createElement('pre');
        debugReservaSpan.id = 'debug-reservas';
        debugReservaSpan.style.fontSize = '0.85em';
        debugReservaSpan.style.color = '#006';
        debugReservaSpan.style.background = '#f8f8ff';
        debugReservaSpan.style.border = '1px solid #bbf';
        debugReservaSpan.style.padding = '0.5em';
        debugReservaSpan.style.marginTop = '0.5em';
    }
    debugReservaSpan.innerText = debugMsg;
    container.insertBefore(debugReservaSpan, container.firstChild);

    // Solo admin puede ver reservas de otros
    if (esAdmin) {
        // Si es admin y no hay lista de usuarios, obtenerla y re-llamar la función
        if (!usuariosLista) {
            try {
                const resp = await fetch('/.netlify/functions/listar_usuarios');
                const js = await resp.json();
                let lista = Array.isArray(js.usuarios) ? js.usuarios : [];
                // Si el usuario actual no está en la lista, agregarlo
                if (!lista.some(u => u.email === user.email)) {
                    lista.unshift({ nombre: user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : user.email, email: user.email });
                }
                return mostrarMisReservas(emailFiltro, lista);
            } catch (e) {
                container.innerHTML += `<p style='color:red'>No se pudo cargar la lista de usuarios: ${e.message}</p>`;
                return;
            }
        }
        // Renderizar combo solo una vez para admin
        let filtroUsuario = emailFiltro;
        if (usuariosLista && usuariosLista.length > 0) {
            const formFiltro = document.createElement('form');
            formFiltro.id = 'form-filtro-usuario';
            formFiltro.innerHTML = `<label>Usuario: <select id="combo-usuario"></select></label>`;
            container.appendChild(formFiltro);
            const combo = formFiltro.querySelector('#combo-usuario');
            combo.innerHTML = usuariosLista.map(u => {
                const mostrar = (u.nombre && u.nombre !== u.email) ? `${u.nombre} (${u.email})` : u.email;
                return `<option value="${u.email}">${mostrar}</option>`;
            }).join('');
            let defaultUsuario = user.email;
            if (!usuariosLista.some(u => u.email === defaultUsuario)) {
                defaultUsuario = usuariosLista[0].email;
            }
            combo.value = emailFiltro || defaultUsuario;
            combo.disabled = usuariosLista.length === 1;
            combo.addEventListener('change', (e) => {
                if (e.target.value) {
                    mostrarMisReservas(e.target.value, usuariosLista);
                }
            });
            filtroUsuario = combo.value;
        }
        if (filtroUsuario) {
            await mostrarMisReservasAdmin(filtroUsuario, esAdmin, usuariosLista);
        } else {
            container.innerHTML += '<p style="color:red">No hay usuarios disponibles para mostrar reservas.</p>';
        }
    } else {
        // Usuario normal: solo puede ver sus propias reservas
        await mostrarMisReservasAdmin(user.email, false, null);
    }
}

// Nueva función para mostrar reservas de un usuario (o todas si email vacío)
async function mostrarMisReservasAdmin(emailFiltro, isAdmin, usuariosLista) {
    const user = netlifyIdentity.currentUser();
    const container = document.getElementById('calendar-container');
    try {
        let url = '/.netlify/functions/reservar';
        if (isAdmin && !emailFiltro) {
            url += '?all=1';
        } else if (emailFiltro) {
            url += `?email=${encodeURIComponent(emailFiltro)}`;
        }
        const resp = await fetch(url);
        const data = await resp.json();
        let reservas = data.userEvents || [];
        // Si no es admin, filtrar por email o nombre (usando nombre de usuarios.json)
        if (!isAdmin && user) {
            let nombreUsuario = '';
            try {
                const resp = await fetch('/.netlify/functions/listar_usuarios');
                const js = await resp.json();
                if (Array.isArray(js.usuarios)) {
                    const actual = js.usuarios.find(u => u.email === user.email);
                    if (actual && actual.nombre) nombreUsuario = actual.nombre.toLowerCase();
                }
            } catch {}
            reservas = reservas.filter(reserva => {
                const nombreReserva = (reserva.nombre || '').toLowerCase();
                const emailReserva = (reserva.email || '').toLowerCase();
                const emailUsuario = (user.email || '').toLowerCase();
                return emailReserva === emailUsuario || (nombreReserva && nombreReserva === nombreUsuario);
            });
        }
        if (reservas.length === 0) {
            container.innerHTML += '<p>No hay reservas activas.</p>';
            return;
        }
        const lista = document.createElement('ul');
        lista.className = 'reservas-lista';
        reservas.forEach(reserva => {
            const li = document.createElement('li');
            const fechaHora = `${reserva.fecha} ${reserva.hora}:00 hs`;
            const fechaReserva = new Date(`${reserva.fecha}T${reserva.hora.toString().padStart(2,'0')}:00:00-03:00`);
            const ahora = new Date();
            const diffHoras = (fechaReserva - ahora) / (1000 * 60 * 60);
            const esCancelada = reserva.summary && reserva.summary.startsWith('Cancelada');
            if (esCancelada) return;
            li.innerHTML = `<strong>Consultorio ${reserva.consultorio}</strong> - ${fechaHora} - <span>${reserva.nombre || reserva.email}</span>`;
            if (diffHoras > 24) {
                const btnCancelar = document.createElement('button');
                btnCancelar.innerText = 'Cancelar';
                btnCancelar.className = 'btn-cancelar';
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
                            li.remove();
                        } else {
                            alert('No se pudo cancelar: ' + (result.error || result.details || 'Error desconocido'));
                        }
                    } catch (e) {
                        alert('Error al cancelar: ' + e.message);
                    }
                };
                li.appendChild(btnCancelar);
            } else {
                li.innerHTML += ' <span style="color:gray">(No se puede cancelar: menos de 24h)</span>';
            }
            lista.appendChild(li);
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
    cargarBotonesConsultorios();
};

if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => { if(user) initDashboard(); else window.location.href="index.html"; });
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => window.netlifyIdentity.logout());
        // El botón mis-reservas se crea dinámicamente, así que no se puede agregar aquí
    });
}
