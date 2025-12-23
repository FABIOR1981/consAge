import { renderReservas } from './reservas.js';
import { renderAgenda } from './agenda.js';
import { renderInforme } from './informe_modular.js';

let seleccion = {
    consultorio: null,
    fecha: null
};

// --- Gestión de Reservas ---
const reservarTurno = async (hora) => {
    const user = netlifyIdentity.currentUser();
    const textoConfirmar = `¿Confirmar Consultorio ${seleccion.consultorio}\nFecha: ${seleccion.fecha}\nHora: ${hora}:00 hs?`;
    if (!confirm(textoConfirmar)) return;

    const container = document.getElementById('calendar-container');
    container.innerHTML = "<p>⌛ Procesando reserva...</p>";

    try {
        const colorLookup = APP_CONFIG.coloresConsultorios || {};
        const defaultColor = Object.values(colorLookup)[0] || '1';
        const colorIdToSend = colorLookup[seleccion.consultorio] || defaultColor;

        const displayName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.name || user?.email);
        
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

        if (respuesta.ok) {
            alert("✅ ¡Éxito! Turno agendado.");
            cargarBotonesConsultorios();
        } else {
            const datos = await respuesta.json();
            alert(`❌ Error: ${datos.error || 'No se pudo reservar'}`);
            mostrarHorarios();
        }
    } catch (err) {
        alert("❌ Error de red: " + err.message);
        mostrarHorarios();
    }
};

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
        if ([0, 6].includes(selected.getDay())) { alert("No se permiten fines de semana."); return; }
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
    try {
        const resp = await fetch(`/.netlify/functions/reservar?email=${encodeURIComponent(user.email)}&fecha=${seleccion.fecha}&consultorio=${seleccion.consultorio}`);
        const data = await resp.json();
        
        const grid = document.createElement('div');
        grid.className = 'horarios-grid';
        
        for (let h = APP_CONFIG.horarios.inicio; h < APP_CONFIG.horarios.fin; h++) {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.innerText = `${h.toString().padStart(2, '0')}:00`;
            
            if (data.ocupadasPorUsuario.includes(h)) {
                btn.classList.add('ocupado-usuario');
                btn.innerText += ' (Tuyo)';
                btn.onclick = () => cancelarReserva(h, data.userEvents.find(ev => ev.hora === h)?.eventId);
            } else if (!data.horasDisponibles.includes(h)) {
                btn.disabled = true;
                btn.classList.add('ocupado-otro');
            } else {
                btn.classList.add('libre');
                btn.onclick = () => reservarTurno(h);
            }
            grid.appendChild(btn);
        }
        container.appendChild(grid);
    } catch (e) {
        container.innerHTML += '<p style="color:red">Error cargando disponibilidad.</p>';
    }
};

const cancelarReserva = async (hora, eventId) => {
    if (!confirm(`¿Cancelar reserva de las ${hora}:00 hs?`)) return;
    try {
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, email: netlifyIdentity.currentUser().email })
        });
        if (resp.ok) { alert('Cancelada.'); mostrarHorarios(); }
    } catch (e) { alert('Error al cancelar.'); }
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

// --- Dashboard y Navegación ---
async function renderDashboardButtons(user) {
    const btnsDiv = document.getElementById('dashboard-btns');
    if (!btnsDiv) return;
    btnsDiv.innerHTML = '';
    
    const menuGrid = document.createElement('div');
    menuGrid.className = 'menu-grid';

    const btnAgenda = document.createElement('button');
    btnAgenda.className = 'btn btn-primary btn-menu';
    btnAgenda.innerText = 'Agenda';
    btnAgenda.onclick = () => mostrarSeccion('agenda');
    
    const btnReservas = document.createElement('button');
    btnReservas.className = 'btn btn-primary btn-menu';
    btnReservas.innerText = 'Reservas Futuras';
    btnReservas.onclick = () => mostrarSeccion('mis-reservas-futuras');

    menuGrid.appendChild(btnAgenda);
    menuGrid.appendChild(btnReservas);

    // Verificar Rol Admin
    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        const actual = js.usuarios.find(u => u.email === user.email);
        if (actual?.rol === 'admin') {
            const btnInforme = document.createElement('button');
            btnInforme.className = 'btn btn-secondary btn-menu';
            btnInforme.innerText = 'Informe';
            btnInforme.onclick = () => mostrarSeccion('informe');
            menuGrid.appendChild(btnInforme);
        }
    } catch {}
    
    btnsDiv.appendChild(menuGrid);
}

function mostrarSeccion(seccion) {
    const secciones = ['agenda-section', 'reservas-section', 'informe-section', 'mis-reservas-futuras-section'];
    secciones.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });

    if (seccion === 'agenda') {
        document.getElementById('agenda-section').style.display = '';
        renderAgenda(document.getElementById('agenda-container'));
    } else if (seccion === 'mis-reservas-futuras') {
        let misReservasSection = document.getElementById('mis-reservas-futuras-section');
        if (!misReservasSection) {
            misReservasSection = document.createElement('section');
            misReservasSection.id = 'mis-reservas-futuras-section';
            misReservasSection.className = 'card';
            document.querySelector('main.content').appendChild(misReservasSection);
        }
        misReservasSection.style.display = '';
        import('./informe_modular.js').then(mod => mod.renderMisReservasFuturas(misReservasSection));
    } else if (seccion === 'informe') {
        document.getElementById('informe-section').style.display = '';
        renderInforme(document.getElementById('informe-container'));
    }
}

// Función que genera la TABLA REAL con Estilo Zebra
async function mostrarMisReservasAdmin(emailFiltro, isAdmin) {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '<p>Cargando reservas...</p>';
    
    try {
        let url = `/.netlify/functions/reservar?all=${isAdmin ? '1' : '0'}`;
        const resp = await fetch(url);
        const data = await resp.json();
        let reservas = data.userEvents || [];

        container.innerHTML = '<h3>Mis Reservas Futuras</h3>';
        
        const tablaContainer = document.createElement('div');
        tablaContainer.className = 'table-main-container';

        const tabla = document.createElement('table');
        tabla.className = 'custom-table';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Hora Consultorio</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = tabla.querySelector('tbody');
        reservas.forEach((res, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td>${res.fecha}</td>
                <td>${res.hora}:00 (C${res.consultorio})</td>
                <td>${res.nombre || res.email}</td>
                <td><span class="status-badge ${res.estado?.toLowerCase() || 'reservada'}">${res.estado || 'Reservada'}</span></td>
                <td>
                    ${res.estado !== 'Cancelada' ? `<button class="btn-cancelar-small" onclick="cancelarReserva('${res.hora}', '${res.eventId}')">Cancelar</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        tablaContainer.appendChild(tabla);
        container.appendChild(tablaContainer);
    } catch (e) {
        container.innerHTML = '<p>Error al cargar reservas.</p>';
    }
}

const initDashboard = async () => {
    const user = netlifyIdentity.currentUser();
    if (!user) { window.location.href = "index.html"; return; }
    
    document.getElementById('user-email').innerText = user.email;
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) welcomeMsg.innerText = "Bienvenidos a la agenda de DeMaria Consultores.";
    
    await renderDashboardButtons(user);
};

if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => { if(user) initDashboard(); else window.location.href="index.html"; });
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
}