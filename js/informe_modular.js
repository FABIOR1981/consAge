import { APP_CONFIG } from './config.js';

// Bandera de inicialización para renderInforme
let __informeInitDone = false;

// --- 1. RENDERIZAR MIS RESERVAS FUTURAS ---
export async function renderMisReservasFuturas(container) {
    let esAdmin = false;
    let usuariosLista = [];
    let comboHtml = '';
    const hoy = new Date();
    const fechaInicio = hoy.toISOString().split('T')[0];
    // 90 días a futuro
    const fechaFin = new Date(hoy.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const user = window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
    if (!user) return;

    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        if (Array.isArray(js.usuarios)) {
            const actual = js.usuarios.find(u => u.email === user.email);
            if (actual && actual.rol === 'admin') esAdmin = true;
            usuariosLista = js.usuarios.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }
    } catch (e) { console.error(e); }

    let usuarioFiltro = user.email;

    if (esAdmin) {
        usuarioFiltro = '';
        comboHtml = `
        <div style='margin-bottom:1.5em; background: white; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'>
            <label style="font-weight:600; color:#2c3e50;">Filtrar por Usuario: 
                <select id="combo-usuario-futuras" style="padding: 8px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 10px;">
                    <option value="">Seleccione un usuario</option>
                    ${usuariosLista.map(u => `<option value="${u.email}">${u.nombre || u.email}</option>`).join('')}
                </select>
            </label>
        </div>`;
    }

    // CAMBIO CRÍTICO: Usamos un DIV contenedor para los resultados, NO una TABLE vacía
    container.innerHTML = `
    <div class="informe-container">
        <h2 class="informe-titulo" style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">${esAdmin ? 'Reservas Futuras (Admin)' : 'Mis Reservas Futuras'}</h2>
        ${comboHtml}
        <div id="total-horas-informe"></div>
        
        <div id="contenedor-resultados">
            <p>${esAdmin ? 'Seleccione un usuario para ver sus reservas futuras.' : 'Buscando reservas futuras...'}</p>
        </div>
    </div>`;

    const urlBase = `/.netlify/functions/informe_reservas?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`;

    const cargarReservas = async (usuarioEmail) => {
        const resultContainer = container.querySelector('#contenedor-resultados');
        const totalDiv = container.querySelector('#total-horas-informe');
        
        resultContainer.innerHTML = '<p>Cargando datos...</p>';
        
        let finalUrl = urlBase;
        if (usuarioEmail) finalUrl += `&usuario=${encodeURIComponent(usuarioEmail)}`;

        try {
            const resp = await fetch(finalUrl);
            const data = await resp.json();
            let reservas = Array.isArray(data) ? data : (data.reservas || []);
            
            // Filtrar solo reservas futuras
            const ahora = new Date();
            reservas = reservas.filter(r => r.start && new Date(r.start) > ahora);
            
            // Llamamos a la función que crea la tabla con las clases ZEBRA correctas
            renderReservasTable(reservas, resultContainer, totalDiv, true); // true indica que es vista "Futuras"
            
        } catch (err) {
            resultContainer.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
        }
    };

    if (esAdmin) {
        const combo = container.querySelector('#combo-usuario-futuras');
        combo.addEventListener('change', (e) => {
            if (e.target.value) cargarReservas(e.target.value);
        });
        return;
    }

    // Si no es admin, cargar directamente
    cargarReservas(user.email);
}

// --- 2. RENDERIZAR INFORME GENERAL ---
export async function renderInforme(container) {
    if (__informeInitDone) return;
    __informeInitDone = true;

    // CAMBIO CRÍTICO: Usamos div id="contenedor-resultados" en lugar de table id="tabla-informe"
    container.innerHTML = `
    <div class="informe-container">
        <h2 class="informe-titulo">Informe de Reservas</h2>
        
        <form id="form-informe" class="informe-form">
            <label>Fecha inicio: <input type="date" name="fechaInicio" required></label>
            <label>Fecha fin: <input type="date" name="fechaFin" required></label>
            <label>Consultorio: 
                <select name="consultorio" id="combo-consultorio">
                    <option value="">Todos</option>
                </select>
            </label>
            
            <div class="search-row" id="search-row-informe" style="width: 100%; margin-top: 10px;"></div>
            
            <button type="submit" style="margin-top: 15px;">Buscar</button>
        </form>

        <div id="total-horas-informe"></div>
        
        <div id="contenedor-resultados">
            <p>Complete los filtros y presione Buscar</p>
        </div>
    </div>`;

    await renderComboUsuariosInforme(container);
    initInforme(container);
}

async function renderComboUsuariosInforme(container) {
    const user = window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
    if (!user) return;

    let esAdmin = false;
    let usuariosLista = [];
    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        if (Array.isArray(js.usuarios)) {
            const actual = js.usuarios.find(u => u.email === user.email);
            if (actual && actual.rol === 'admin') esAdmin = true;
            usuariosLista = js.usuarios.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        }
    } catch {}

    const searchRow = container.querySelector('#search-row-informe');

    if (!esAdmin || usuariosLista.length === 0) {
        searchRow.innerHTML = `
            <label style="display:block; width:100%;">Búsqueda (Nombre/Email):
                <input type="text" name="busqueda" placeholder="Opcional..." style="width:100%;">
            </label>`;
        return;
    }

    searchRow.innerHTML = `
        <div style="display:flex; gap:15px; flex-wrap:wrap; align-items:flex-end; width:100%;">
            <label style="flex:1;">Filtrar lista: 
                <input type="text" id="filtro-nombre-usuario-informe" placeholder="Escriba para buscar..." autocomplete="off">
            </label>
            <label style="flex:1;">Seleccionar Usuario: 
                <select id="combo-usuario-informe"><option value="">Seleccione un usuario</option></select>
            </label>
            <label style="flex:1;">Usuario (Avanzado):
                <input type="text" id="combo-usuario2" class="search-input" placeholder="Buscar usuario por nombre o apellido" autocomplete="off">
                <div id="autocomplete-lista-usuario2" class="autocomplete-lista"></div>
                <span class="search-note">(autocompletado avanzado por nombre/apellido)</span>
            </label>
        </div>
        <style>
        .autocomplete-lista {
            position: absolute;
            left: 0;
            right: 0;
            top: 100%;
            background: #fff;
            border: 1px solid #ccc;
            z-index: 1000;
            max-height: 180px;
            overflow-y: auto;
            min-width: 180px;
            width: 100%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .autocomplete-item {
            padding: 8px 12px;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .autocomplete-item:hover {
            background: #e6f0fa;
        }
        </style>
    `;

    const inputFiltro = searchRow.querySelector('#filtro-nombre-usuario-informe');
    const combo = searchRow.querySelector('#combo-usuario-informe');
    const inputAvanzado = searchRow.querySelector('#combo-usuario2');
    const listaAvanzada = searchRow.querySelector('#autocomplete-lista-usuario2');

    function renderCombo(filtro) {
        const opciones = usuariosLista
            .filter(u => !filtro || (u.nombre && u.nombre.toLowerCase().includes(filtro.toLowerCase())) || u.email.includes(filtro.toLowerCase()))
            .map(u => `<option value="${u.email}">${u.nombre || u.email}</option>`);
        combo.innerHTML = '<option value="">Seleccione un usuario</option>' + opciones.join('');
    }
    renderCombo('');

    inputFiltro.addEventListener('input', (e) => renderCombo(e.target.value));

    // Autocompletado avanzado tipo lista filtrable para ComboUsuario2
    function renderListaAvanzada(filtro) {
        listaAvanzada.innerHTML = '';
        const val = filtro ? filtro.trim().toLowerCase() : '';
        let filtrados = usuariosLista;
        if (val) {
            filtrados = usuariosLista.filter(u => u.nombre && u.nombre.toLowerCase().includes(val));
        }
        if (filtrados.length === 0) {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = 'Sin resultados';
            item.style.color = '#888';
            listaAvanzada.appendChild(item);
        } else {
            filtrados.forEach(u => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.textContent = u.nombre;
                item.addEventListener('mousedown', function(e) {
                    inputAvanzado.value = u.nombre;
                    listaAvanzada.innerHTML = '';
                    listaAvanzada.style.display = 'none';
                });
                listaAvanzada.appendChild(item);
            });
        }
        listaAvanzada.style.display = 'block';
    }

    inputAvanzado.addEventListener('input', function() {
        renderListaAvanzada(this.value);
    });
    inputAvanzado.addEventListener('focus', function() {
        renderListaAvanzada(this.value);
    });
    inputAvanzado.addEventListener('blur', function() {
        setTimeout(() => {
            listaAvanzada.innerHTML = '';
            listaAvanzada.style.display = 'none';
        }, 150);
    });

    combo.addEventListener('change', (e) => {
        let inputBusqueda = container.querySelector('input[name="busqueda"]');
        if (!inputBusqueda) {
            inputBusqueda = document.createElement('input');
            inputBusqueda.type = 'hidden';
            inputBusqueda.name = 'busqueda';
            combo.form.appendChild(inputBusqueda);
        }
        inputBusqueda.value = e.target.value;
    });
}

export async function initInforme(container) {
    const comboConsultorio = container.querySelector('#combo-consultorio');
    const form = container.querySelector('#form-informe');
    const resultContainer = container.querySelector('#contenedor-resultados');
    let totalHorasDiv = container.querySelector('#total-horas-informe');

    if (APP_CONFIG && Array.isArray(APP_CONFIG.consultorios)) {
        APP_CONFIG.consultorios.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            comboConsultorio.appendChild(opt);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        resultContainer.innerHTML = '<p>Cargando informe...</p>';
        
        const fechaInicio = form.elements['fechaInicio'].value;
        const fechaFin = form.elements['fechaFin'].value;
        const consultorio = form.elements['consultorio'].value;
        const usuario = form.elements['busqueda'] ? form.elements['busqueda'].value : '';

        let url = `/.netlify/functions/informe_reservas?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`;
        if (consultorio) url += `&consultorio=${encodeURIComponent(consultorio)}`;
        if (usuario) url += `&usuario=${encodeURIComponent(usuario)}`;

        try {
            const resp = await fetch(url);
            const data = await resp.json();
            let lista = [];

            if (Array.isArray(data)) lista = data;
            else if (data && data.reservas) lista = data.reservas;

            if (lista.length === 0) {
                resultContainer.innerHTML = '<p>No se encontraron reservas en este período.</p>';
                totalHorasDiv.innerText = '';
                return;
            }
            
            // Renderizamos la tabla en el contenedor limpio
            renderReservasTable(lista, resultContainer, totalHorasDiv, false);

        } catch (err) {
            resultContainer.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
            totalHorasDiv.innerText = '';
        }
    });
}

// --- 3. GENERADOR DE LA TABLA (EL CORAZÓN DEL ESTILO) ---
function renderReservasTable(reservas, containerDestino, totalHorasDiv, esVistaFuturas) {
    let total = 0;
    let totalUsadas = 0;
    let totalCanceladas = 0;

    // Aquí usamos las clases EXACTAS de css/comunes.css
    // table-main-container -> para el scroll y sombra
    // custom-table -> para el estilo zebra
    
    let html = `
    <div class="table-main-container">
        <table class="custom-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Consultorio</th>
                    <th>Usuario</th>
                    <th>Estado</th>
                    ${esVistaFuturas ? '<th>Acciones</th>' : ''}
                </tr>
            </thead>
            <tbody>`;

    reservas.forEach((r, idx) => {
        // Parsear fechas
        let fecha = '';
        let hora = '';
        if (r.start) {
            const d = new Date(r.start);
            fecha = d.toLocaleDateString('es-ES');
            hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }

        // Parsear consultorio
        let consultorio = '';
        if (r.summary) {
            const match = r.summary.match(/^C(\d+):/);
            if (match) consultorio = `C${match[1]}`;
        }

        // Parsear usuario
        let usuario = 'Desconocido';
        if (r.description) {
             let m = r.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
             if (m) usuario = m[1]; // Nombre
             else {
                 m = r.description.match(/Reserva realizada por: ([^\n]+)/);
                 if (m) usuario = m[1];
             }
        }

        // Lógica de Estado
        let estado = APP_CONFIG.estadosReserva.RESERVADA; // "Reservada"
        if (r.summary && r.summary.toLowerCase().includes('cancelada')) {
            estado = APP_CONFIG.estadosReserva.CANCELADA;
            totalCanceladas++;
        } else if (r.start) {
            const ahora = new Date();
            const inicio = new Date(r.start);
            if (inicio < ahora) {
                estado = APP_CONFIG.estadosReserva.USADA;
                totalUsadas++;
            }
        }
        
        // Botón Cancelar (Solo si es futura y faltan > 24hs)
        let acciones = '';
        if (esVistaFuturas && estado === APP_CONFIG.estadosReserva.RESERVADA && r.start) {
             const ahora = new Date();
             const inicio = new Date(r.start);
             const diffHoras = (inicio - ahora) / (1000 * 60 * 60);
             // Permitir cancelar si falta más de 24hs (o ajusta según tu regla)
             if (diffHoras > 24) {
                 acciones = `<button class="btn-cancelar-reserva" data-id="${r.id}" 
                 style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.8em;">
                 Cancelar</button>`;
             } else {
                 acciones = '<span style="color:#999; font-size:0.8em;">Sin cx</span>';
             }
        }

        // Badge Class para CSS
        let badgeClass = 'reservada';
        if (estado === APP_CONFIG.estadosReserva.USADA) badgeClass = 'usada';
        if (estado === APP_CONFIG.estadosReserva.CANCELADA) badgeClass = 'cancelada';

        html += `
            <tr>
                <td>${idx + 1}</td>
                <td>${fecha}</td>
                <td>${hora}</td>
                <td>${consultorio}</td>
                <td>${usuario}</td>
                <td><span class="status-badge ${badgeClass}" style="padding:4px 8px; border-radius:12px; font-weight:bold; font-size:0.85em; display:inline-block;">${estado}</span></td>
                ${esVistaFuturas ? `<td>${acciones}</td>` : ''}
            </tr>`;
        
        total++;
    });

    html += `</tbody></table></div>`; // Cerramos div y table

    // INYECCIÓN LIMPIA
    containerDestino.innerHTML = html;

    // Actualizar contadores
    if (!esVistaFuturas && totalHorasDiv) {
        totalHorasDiv.innerHTML = `<div style="padding:10px; background:#e8f4fd; border-radius:4px; margin-bottom:15px; color:#2c3e50;">
            <strong>Resumen:</strong> Total: ${total} | Usadas: ${totalUsadas} | Canceladas: ${totalCanceladas}
        </div>`;
    } else if (totalHorasDiv) {
        totalHorasDiv.innerHTML = '';
    }

    // Reactivar eventos de los botones generados
    if (esVistaFuturas) {
        containerDestino.querySelectorAll('.btn-cancelar-reserva').forEach(btn => {
            btn.addEventListener('click', manejarCancelacion);
        });
    }
}

// Función separada para manejar la cancelación
async function manejarCancelacion(e) {
    const btn = e.target;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;

    const user = window.netlifyIdentity ? window.netlifyIdentity.currentUser() : null;
    
    // Intentar obtener el email del combo si es admin, o el propio
    let email = user ? user.email : '';
    const combo = document.getElementById('combo-usuario-futuras');
    if (combo && combo.value) email = combo.value;

    try {
        btn.disabled = true;
        btn.innerText = '...';
        
        const resp = await fetch('/.netlify/functions/reservar', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: id, email })
        });
        
        if (resp.ok) {
            alert('✅ Reserva cancelada.');
            // Recargar simulando click en el botón o recargando la función
            // Una forma simple es recargar la página o disparar el evento change del combo
            if (combo) { 
                combo.dispatchEvent(new Event('change')); 
            } else {
                // Si es usuario normal, recargamos el módulo llamando a render de nuevo
                const contenedor = document.getElementById('mis-reservas-futuras-section'); // Asegúrate que este ID coincida con tu HTML principal
                if(contenedor) renderMisReservasFuturas(contenedor);
                else location.reload();
            }
        } else {
            const err = await resp.json();
            alert('❌ Error: ' + (err.error || 'No se pudo cancelar'));
            btn.disabled = false;
            btn.innerText = 'Cancelar';
        }
    } catch (error) {
        alert('Error de conexión');
        btn.disabled = false;
        btn.innerText = 'Cancelar';
    }
}