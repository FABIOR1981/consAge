import { APP_CONFIG } from './config.js';

let seleccion = { consultorio: null, fecha: null };

export async function renderAgenda(container) {
    // Aumentamos tamaño de fuente para tu HP Pavilion
    container.style.fontSize = "1.2rem"; 
    container.innerHTML = `
        <div class="informe-container">
            <h2 class="informe-titulo" style="font-size:2.2rem;">Agenda de Turnos</h2>
            <div id="agenda-content"></div>
        </div>`;
    cargarBotonesConsultorios(container.querySelector('#agenda-content'));
}

async function cargarBotonesConsultorios(container) {
    container.innerHTML = '<p style="margin-bottom:1.5em; font-weight:bold;">Paso 1: Seleccione un Consultorio</p>';
    
    const user = window.netlifyIdentity?.currentUser();
    let esAdmin = false;

    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        const actual = js.usuarios.find(u => u.email === user.email);
        if (actual && actual.rol === 'admin') esAdmin = true;
    } catch (e) { console.error("Error verificando rol:", e); }

    const grid = document.createElement('div');
    grid.className = 'consultorios-grid';
    grid.style = "display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:20px;";

    // RESTRICCIÓN: Consultorio 1 solo para Admin
    const disponibles = (APP_CONFIG.consultorios || []).filter(num => num === 1 ? esAdmin : true);

    disponibles.forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn btn-primary';
        btn.style = "padding: 25px; font-size: 1.3rem; font-weight: bold; cursor: pointer; border-radius:12px;";
        btn.onclick = () => elegirFecha(num, container);
        grid.appendChild(btn);
    });
    container.appendChild(grid);
}

function elegirFecha(num, container) {
    seleccion.consultorio = num;
    container.innerHTML = `
        <div style="background:#f0f7ff; padding:20px; border-radius:10px;">
            <p style="font-weight:bold; font-size:1.4rem;">Paso 2: Día para Consultorio ${num}</p>
            <input type="date" id="input-fecha-agenda" class="search-input" 
                   style="padding:15px; font-size:1.2rem; margin: 1em 0; display:block; width:100%; max-width:400px; border-radius:8px;">
            <button id="btn-volver-cons" class="btn btn-secondary">← Volver a Consultorios</button>
        </div>
        <div id="horarios-resultado" style="margin-top:2rem;"></div>
    `;

    const input = container.querySelector('#input-fecha-agenda');
    input.min = new Date().toISOString().split('T')[0];
    
    container.querySelector('#btn-volver-cons').onclick = () => cargarBotonesConsultorios(container);

    input.onchange = (e) => {
        const fechaSel = new Date(e.target.value + 'T00:00:00');
        const dia = fechaSel.getDay(); // 0=Dom, 6=Sab

        // VALIDACIÓN DÍAS LABORALES
        if (dia === 0) {
            alert("Los domingos el centro permanece cerrado.");
            e.target.value = "";
            return;
        }

        seleccion.fecha = e.target.value;
        cargarHorarios(container.querySelector('#horarios-resultado'));
    };
}

async function cargarHorarios(targetContainer) {
    targetContainer.innerHTML = '<p>⌛ Buscando disponibilidad en Google Calendar...</p>';
    
    try {
        const url = `/.netlify/functions/informe_reservas?consultorio=${seleccion.consultorio}&fechaInicio=${seleccion.fecha}&fechaFin=${seleccion.fecha}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const ocupados = (data.reservas || []).map(r => {
            const d = new Date(r.start);
            return `${d.getHours().toString().padStart(2, '0')}:00`;
        });

        // LÓGICA DE SÁBADO (8 a 15hs)
        const esSabado = new Date(seleccion.fecha + 'T00:00:00').getDay() === 6;
        const horaFinHoy = esSabado ? 15 : APP_CONFIG.horarios.fin;

        let html = `
        <div class="table-main-container">
            <table class="custom-table" style="width:100%; font-size:1.2rem;">
                <thead><tr><th>Hora</th><th>Estado</th><th>Acción</th></tr></thead>
                <tbody>`;

        for (let h = APP_CONFIG.horarios.inicio; h < horaFinHoy; h++) {
            const horaStr = `${h.toString().padStart(2, '0')}:00`;
            const estaOcupado = ocupados.includes(horaStr);
            
            html += `
                <tr style="height: 75px;">
                    <td><strong>${horaStr} hs</strong></td>
                    <td><span class="status-badge ${estaOcupado ? 'cancelada' : 'usada'}">${estaOcupado ? 'Ocupado' : 'Libre'}</span></td>
                    <td>${estaOcupado ? '-' : `<button class="btn btn-primary btn-confirmar" data-hora="${h}">Reservar</button>`}</td>
                </tr>`;
        }
        html += '</tbody></table></div>';
        targetContainer.innerHTML = html;

        targetContainer.querySelectorAll('.btn-confirmar').forEach(btn => {
            btn.onclick = () => ejecutarReserva(btn.getAttribute('data-hora'), targetContainer);
        });

    } catch (err) { targetContainer.innerHTML = "Error al conectar con el calendario."; }
}

async function ejecutarReserva(hora, targetContainer) {
    const user = window.netlifyIdentity.currentUser();
    if(!confirm(`¿Confirmar reserva a las ${hora}:00 hs?`)) return;

    try {
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                nombre: user.user_metadata?.full_name || user.email,
                consultorio: seleccion.consultorio,
                fecha: seleccion.fecha,
                hora: parseInt(hora),
                colorId: APP_CONFIG.coloresConsultorios[seleccion.consultorio] || "1"
            })
        });

        if (resp.ok) {
            alert("✅ Reserva exitosa. Se envió un correo.");
            cargarHorarios(targetContainer);
        } else {
            const d = await resp.json();
            alert("❌ Error: " + (d.error || "No disponible"));
        }
    } catch (e) { alert("Error de conexión"); }
}