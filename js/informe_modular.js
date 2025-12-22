import { APP_CONFIG } from './config.js';

let __informeInitDone = false;

export async function renderInforme(container) {
    if (__informeInitDone) return;
    __informeInitDone = true;
    container.innerHTML = `
    <div class="informe-container">
        <h2 class="informe-titulo">Informe de Reservas</h2>
        <form id="form-informe" class="informe-form">
            <label>Fecha inicio:
                <input type="date" name="fechaInicio" required>
            </label>
            <label>Fecha fin:
                <input type="date" name="fechaFin" required>
            </label>
            <label>Consultorio:
                <select name="consultorio" id="combo-consultorio">
                    <option value="">Todos</option>
                </select>
            </label>
            <div class="search-row">
                <label for="input-busqueda" class="search-label">Búsqueda:</label>
                <input type="text" name="busqueda" id="input-busqueda" class="search-input" placeholder="Ingrese nombre, apellido o email">
                <span class="search-note">(usuario, nombre u apellido)</span>
            </div>
            <button type="submit">Buscar</button>
        </form>
        <div id="total-horas-informe"></div>
        <table id="tabla-informe">
            <tr><td colspan="5">Complete los filtros y presione Buscar</td></tr>
        </table>
    </div>`;
    initInforme(container);
}

export async function initInforme(container) {
    const comboConsultorio = container.querySelector('#combo-consultorio');
    const form = container.querySelector('#form-informe');
    const tabla = container.querySelector('#tabla-informe');
    let totalHorasDiv = container.querySelector('#total-horas-informe');

    // Poblar combo
    comboConsultorio.innerHTML = '<option value="">-- Todos --</option>';
    if (APP_CONFIG && Array.isArray(APP_CONFIG.consultorios)) {
        APP_CONFIG.consultorios.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            comboConsultorio.appendChild(opt);
        });
    }

    if (!totalHorasDiv) {
        totalHorasDiv = document.createElement('div');
        totalHorasDiv.id = 'total-horas-informe';
        totalHorasDiv.className = 'total-horas-informe';
        tabla.parentNode.insertBefore(totalHorasDiv, tabla);
    } else {
        totalHorasDiv.classList.add('total-horas-informe');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        tabla.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
        const fechaInicio = form.elements['fechaInicio'] ? form.elements['fechaInicio'].value : '';
        const fechaFin = form.elements['fechaFin'] ? form.elements['fechaFin'].value : '';
        const consultorio = form.elements['consultorio'] ? form.elements['consultorio'].value : '';
        const usuario = form.elements['busqueda'] ? form.elements['busqueda'].value : '';

        let url = `/.netlify/functions/informe_reservas?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`;
        if (consultorio) url += `&consultorio=${encodeURIComponent(consultorio)}`;
        if (usuario) url += `&usuario=${encodeURIComponent(usuario)}`;

        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!Array.isArray(data) && data && data.reservas) {
                renderReservasTable(data.reservas, tabla, totalHorasDiv);
                return;
            }
            if (!Array.isArray(data) || data.length === 0) {
                tabla.innerHTML = '<tr><td colspan="6">No hay resultados</td></tr>';
                totalHorasDiv.innerText = '';
                return;
            }
            renderReservasTable(data, tabla, totalHorasDiv);
        } catch (err) {
            tabla.innerHTML = `<tr><td colspan="6">Error: ${err.message}</td></tr>`;
            totalHorasDiv.innerText = '';
        }
    });
}

function renderReservasTable(reservas, tabla, totalHorasDiv) {
    let total = 0;
    tabla.innerHTML = `<tr><th>Fecha</th><th>Hora</th><th>Consultorio</th><th>Usuario</th><th>Email</th></tr>`;
    reservas.forEach(r => {
        // Extraer fecha y hora desde r.start
        let fecha = '';
        let hora = '';
        if (r.start) {
            const d = new Date(r.start);
            fecha = d.toLocaleDateString('es-ES');
            hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        // Extraer consultorio desde summary: "C2: ..."
        let consultorio = '';
        if (r.summary) {
            const match = r.summary.match(/^C(\d+):/);
            if (match) consultorio = match[1];
        }
        // Extraer usuario y email desde description
        let usuario = '';
        let email = '';
        if (r.description) {
            let m = r.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
            if (m) {
                usuario = m[1];
                email = m[2];
            } else {
                m = r.description.match(/Reserva realizada por: ([^\n@]+@[\w.\-]+)/);
                if (m) {
                    usuario = m[1];
                    email = m[1];
                } else {
                    m = r.description.match(/Reserva realizada por: ([^\n]+)/);
                    if (m) usuario = m[1];
                }
            }
        }
        tabla.innerHTML += `<tr><td>${fecha}</td><td>${hora}</td><td>${consultorio}</td><td>${usuario}</td><td>${email}</td></tr>`;
        total++;
    });
    totalHorasDiv.innerText = `Total de reservas: ${total}`;
}
