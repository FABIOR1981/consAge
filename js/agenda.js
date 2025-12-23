import { APP_CONFIG } from './config.js';

let seleccion = { consultorio: null, fecha: null };

/**
 * Renderiza la vista inicial de la agenda
 */
export async function renderAgenda(container) {
    // Aumentamos el tamaño base para que se vea mejor en pantallas de laptop
    container.style.fontSize = "1.15rem"; 
    container.innerHTML = `
        <div class="informe-container">
            <h2 class="informe-titulo" style="font-size: 2.3rem; margin-bottom: 1.5rem;">📅 Agenda de Turnos</h2>
            <div id="agenda-content"></div>
        </div>`;
    cargarBotonesConsultorios(container.querySelector('#agenda-content'));
}

/**
 * Paso 1: Muestra los consultorios disponibles según el ROL
 */
async function cargarBotonesConsultorios(container) {
    container.innerHTML = '<p style="margin-bottom:1.5em; font-weight: 500; font-size: 1.3rem;">Paso 1: Seleccione un Consultorio</p>';
    
    // Verificación de ROL: El Consultorio 1 es exclusivo para Administradores
    const user = window.netlifyIdentity?.currentUser();
    let esAdmin = false;
    try {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const js = await resp.json();
        if (Array.isArray(js.usuarios)) {
            const actual = js.usuarios.find(u => u.email === user.email);
            if (actual && actual.rol === 'admin') esAdmin = true;
        }
    } catch (e) { 
        console.error("Error al verificar permisos de administrador:", e); 
    }

    const grid = document.createElement('div');
    grid.className = 'consultorios-grid';
    // Diseño de botones grandes y espaciados
    grid.style = "display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:20px;";

    // Filtrar: El consultorio 1 solo se incluye si el usuario es administrador
    const consultoriosFiltrados = (APP_CONFIG.consultorios || []).filter(num => {
        if (num === 1) return esAdmin;
        return true;
    });

    consultoriosFiltrados.forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn btn-primary';
        btn.style = "padding: 30px 20px; font-size: 1.4rem; font-weight: bold; border-radius: 15px; cursor: pointer; transition: transform 0.2s;";
        
        // Efecto visual al pasar el mouse
        btn.onmouseover = () => btn.style.transform = "scale(1.03)";
        btn.onmouseout = () => btn.style.transform = "scale(1)";
        
        btn.onclick = () => elegirFecha(num, container);
        grid.appendChild(btn);
    });
    
    container.appendChild(grid);
}

/**
 * Paso 2: Selección de fecha para el consultorio elegido
 */
function elegirFecha(num, container) {
    seleccion.consultorio = num;
    container.innerHTML = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; border-left: 5px solid #007bff;">
            <p style="font-weight:bold; font-size:1.5rem; margin-top:0;">Paso 2: Fecha para el Consultorio ${num}</p>
            <input type="date" id="input-fecha-agenda" class="search-input" 
                   style="padding:15px; font-size:1.3rem; margin: 1em 0; display:block; width:100%; max-width:400px; border-radius: 8px; border: 1px solid #ccc;">
            <button id="btn-volver-cons" class="btn btn-secondary" style="font-size:1rem; padding: 10px 20px;">← Cambiar Consultorio</button>
        </div>
        <div id="horarios-resultado" style="margin-top: 2rem;"></div>
    `;

    const input = container.querySelector('#input-fecha-agenda');
    // Evitar que elijan fechas pasadas
    input.min = new Date().toISOString().split('T')[0];
    
    container.querySelector('#btn-volver-cons').onclick = () => cargarBotonesConsultorios(container);

    input.onchange = (e) => {
        seleccion.fecha = e.target.value;
        if (seleccion.fecha) {
            cargarHorarios(container.querySelector('#horarios-resultado'));
        }
    };
}

/**
 * Paso 3: Consulta disponibilidad y muestra la tabla
 */
async function cargarHorarios(targetContainer) {
    targetContainer.innerHTML = '<p id="cargando-h" style="font-size: 1.2rem; color: #666;">⌛ Consultando disponibilidad en tiempo real...</p>';
    
    try {
        // CORRECCIÓN CLAVE: Usamos 'informe_reservas' porque es la función que procesa las consultas de calendario
        const url = `/.netlify/functions/informe_reservas?consultorio=${seleccion.consultorio}&fechaInicio=${seleccion.fecha}&fechaFin=${seleccion.fecha}`;
        
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("No se pudo conectar con el servidor de calendario.");
        
        const data = await resp.json();
        const reservasExistentes = data.reservas || [];
        
        // Mapeamos las horas que ya tienen una reserva
        const horasBloqueadas = reservasExistentes.map(res => {
            const fechaRes = new Date(res.start);
            return `${fechaRes.getHours().toString().padStart(2, '0')}:00`;
        });

        let html = `
        <div class="table-main-container">
            <table class="custom-table" style="width:100%; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <thead>
                    <tr style="font-size: 1.2rem; background-color: #f1f3f5;">
                        <th style="padding: 20px;">Hora</th>
                        <th>Estado</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>`;

        // Determinar día de la semana y si es laboral
        let inicio = APP_CONFIG.horarios.inicio;
        let fin = APP_CONFIG.horarios.fin;
        let intervalo = APP_CONFIG.horarios.intervalo || 60;
        let diaLaboral = true;
        let diaSemana = null;
        if (seleccion.fecha) {
            const fechaObj = new Date(seleccion.fecha);
            diaSemana = fechaObj.getDay();
            // En config.js: 1=Lunes ... 6=Sábado (getDay: 0=Domingo, 6=Sábado)
            // Ajustamos para comparar correctamente:
            // Si config usa 1-6, getDay 1-6 es igual, pero getDay 0 es domingo
            diaLaboral = APP_CONFIG.diasLaborales.includes(diaSemana);
            if (APP_CONFIG.horariosEspeciales && APP_CONFIG.horariosEspeciales[diaSemana]) {
                inicio = APP_CONFIG.horariosEspeciales[diaSemana].inicio;
                fin = APP_CONFIG.horariosEspeciales[diaSemana].fin;
            }
        }
        if (!diaLaboral) {
            targetContainer.innerHTML = `<div style="padding: 20px; background: #fffbe5; border: 1px solid #ffe066; border-radius: 8px; color: #b08900; font-size:1.2rem;">⛔ No se pueden agendar turnos en este día. Solo días laborales.</div>`;
            return;
        }
        // Generamos los rangos según la configuración global o especial y el intervalo
        for (let h = inicio; h < fin; h += intervalo / 60) {
            const horaStr = `${h.toString().padStart(2, '0')}:00`;
            const estaOcupado = horasBloqueadas.includes(horaStr);
            
            html += `
                <tr style="height: 80px; font-size: 1.25rem; border-bottom: 1px solid #eee;">
                    <td style="padding-left: 20px;"><strong>${horaStr} hs</strong></td>
                    <td>
                        <span class="status-badge ${estaOcupado ? 'cancelada' : 'usada'}" style="padding: 10px 25px; border-radius: 25px; font-size: 1rem;">
                            ${estaOcupado ? 'Ocupado' : 'Disponible'}
                        </span>
                    </td>
                    <td>
                        ${estaOcupado ? '<span style="color: #999; font-style: italic;">No disponible</span>' 
                                     : `<button class="btn btn-primary btn-reserva-final" data-hora="${h}" style="padding: 12px 30px; font-size: 1rem;">Reservar</button>`}
                    </td>
                </tr>`;
        }
        
        html += '</tbody></table></div>';
        targetContainer.innerHTML = html;

        // Asignar eventos a los botones de reserva
        targetContainer.querySelectorAll('.btn-reserva-final').forEach(btn => {
            btn.onclick = () => ejecutarReserva(btn.getAttribute('data-hora'), targetContainer);
        });

    } catch (err) {
        targetContainer.innerHTML = `
            <div style="padding: 20px; background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; color: #c53030;">
                <strong>Error:</strong> ${err.message}. Por favor, intente recargar la página.
            </div>`;
    }
}

/**
 * Finalizar la reserva enviando los datos al backend
 */
async function ejecutarReserva(hora, targetContainer) {
    const user = window.netlifyIdentity.currentUser();
    const texto = `¿Confirmar reserva del Consultorio ${seleccion.consultorio} para el día ${seleccion.fecha} a las ${hora}:00 hs?`;
    
    if (!confirm(texto)) return;

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
            alert("✅ Turno agendado correctamente. Se ha enviado un correo de confirmación.");
            cargarHorarios(targetContainer); // Actualizar la tabla para mostrar el nuevo estado
        } else {
            const dataError = await resp.json();
            alert("❌ Error: " + (dataError.error || "El turno ya no está disponible."));
        }
    } catch (e) {
        alert("Error de conexión al procesar la reserva.");
    }
}