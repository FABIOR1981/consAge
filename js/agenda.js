import { APP_CONFIG } from './config.js';

let seleccion = { consultorio: null, fecha: null };

export async function renderAgenda(container) {
    container.innerHTML = '<div class="informe-container"><h2 class="informe-titulo">Agenda de Turnos</h2><div id="agenda-content"></div></div>';
    cargarBotonesConsultorios(container.querySelector('#agenda-content'));
}

function cargarBotonesConsultorios(container) {
    container.innerHTML = '<p style="margin-bottom:1em;"><strong>Paso 1:</strong> Elija un Consultorio</p>';
    const grid = document.createElement('div');
    grid.className = 'consultorios-grid';
    grid.style = "display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px;";

    (APP_CONFIG.consultorios || []).forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn btn-primary';
        btn.onclick = () => elegirFecha(num, container);
        grid.appendChild(btn);
    });
    container.appendChild(grid);
}

function elegirFecha(num, container) {
    seleccion.consultorio = num;
    container.innerHTML = `
        <p><strong>Paso 2:</strong> Seleccione Día (Consultorio ${num})</p>
        <input type="date" id="input-fecha-agenda" class="search-input" style="margin-bottom:1em; display:block; max-width:300px;">
        <button id="btn-volver-cons" class="btn btn-secondary" style="margin-right:10px;">Volver</button>
    `;

    const input = container.querySelector('#input-fecha-agenda');
    input.min = new Date().toISOString().split('T')[0];

    container.querySelector('#btn-volver-cons').onclick = () => cargarBotonesConsultorios(container);

    input.onchange = (e) => {
        seleccion.fecha = e.target.value;
        if (seleccion.fecha) cargarHorarios(container);
    };
}

async function cargarHorarios(container) {
    const originalContent = container.innerHTML;
    container.innerHTML += '<p id="cargando-h">Buscando horarios disponibles...</p>';
    
    try {
        const url = `/.netlify/functions/consultar_disponibilidad?consultorio=${seleccion.consultorio}&fecha=${seleccion.fecha}`;
        const resp = await fetch(url);
        const ocupados = await resp.json();

        const listaOcupados = Array.isArray(ocupados) ? ocupados : (ocupados.ocupados || []);
        
        // --- AQUÍ APLICAMOS EL ESTILO ZEBRA ---
        let html = `
        <div class="table-main-container" style="margin-top:20px;">
            <table class="custom-table">
                <thead>
                    <tr>
                        <th>Hora</th>
                        <th>Estado</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>`;

        const { inicio, fin, intervalo } = APP_CONFIG.horarios;
        for (let h = inicio; h < fin; h++) {
            const horaStr = `${h.toString().padStart(2, '0')}:00`;
            const estaOcupado = listaOcupados.includes(horaStr);
            
            html += `
                <tr>
                    <td><strong>${horaStr} hs</strong></td>
                    <td>
                        <span class="status-badge ${estaOcupado ? 'cancelada' : 'usada'}" style="padding:4px 8px;">
                            ${estaOcupado ? 'Ocupado' : 'Libre'}
                        </span>
                    </td>
                    <td>
                        ${estaOcupado 
                            ? '<span style="color:#95a5a6;">No disponible</span>' 
                            : `<button class="btn btn-primary btn-reservar-ahora" data-hora="${h}" style="padding:4px 10px; font-size:0.85em;">Reservar</button>`}
                    </td>
                </tr>`;
        }

        html += '</tbody></table></div>';
        const cargandoMsg = container.querySelector('#cargando-h');
        if(cargandoMsg) cargandoMsg.remove();
        
        // Insertamos la tabla
        const divTabla = document.createElement('div');
        divTabla.innerHTML = html;
        container.appendChild(divTabla);

        // Eventos para botones de reserva
        container.querySelectorAll('.btn-reservar-ahora').forEach(btn => {
            btn.onclick = () => ejecutarReserva(btn.getAttribute('data-hora'), container);
        });

    } catch (err) {
        container.innerHTML += `<p style="color:red">Error: ${err.message}</p>`;
    }
}

async function ejecutarReserva(hora, container) {
    const user = window.netlifyIdentity.currentUser();
    if(!confirm(`¿Reservar Consultorio ${seleccion.consultorio} a las ${hora}:00 hs?`)) return;

    try {
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                nombre: user.user_metadata?.full_name || user.email,
                consultorio: seleccion.consultorio,
                fecha: seleccion.fecha,
                hora: hora
            })
        });

        if (resp.ok) {
            alert("✅ Reserva exitosa");
            cargarHorarios(container);
        } else {
            const d = await resp.json();
            alert("❌ Error: " + (d.error || "No se pudo realizar"));
        }
    } catch (e) {
        alert("Error de conexión");
    }
}