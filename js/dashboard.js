import { APP_CONFIG } from './config.js';

let seleccion = {
    consultorio: null,
    fecha: null
};

// PASO 3: Ejecutar la reserva
const reservarTurno = async (hora) => {
    const user = netlifyIdentity.currentUser();
    const textoConfirmar = `¿Confirmar Consultorio ${seleccion.consultorio}\nFecha: ${seleccion.fecha}\nHora: ${hora}:00 hs?`;
    
    if (!confirm(textoConfirmar)) return;

    const container = document.getElementById('calendar-container');
    container.innerHTML = "<p>⌛ Procesando reserva...</p>";

    try {
        const respuesta = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                consultorio: seleccion.consultorio,
                fecha: seleccion.fecha,
                hora: hora
            })
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            alert("✅ ¡Turno agendado con éxito!");
            cargarBotonesConsultorios();
        } else {
            throw new Error(datos.details || "Error desconocido");
        }
    } catch (err) {
        alert("❌ Error: " + err.message);
        mostrarHorarios();
    }
};

// PASO 2: Mostrar los horarios
const mostrarHorarios = () => {
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Horarios: C${seleccion.consultorio} para el ${seleccion.fecha}</h3>`;
    
    const grid = document.createElement('div');
    grid.className = 'horarios-grid';

    for (let h = APP_CONFIG.horarios.inicio; h < APP_CONFIG.horarios.fin; h++) {
        const btn = document.createElement('button');
        btn.className = 'btn-horario';
        btn.innerText = `${h.toString().padStart(2, '0')}:00`;
        btn.onclick = () => reservarTurno(h);
        grid.appendChild(btn);
    }
    container.appendChild(grid);

    const btnAtras = document.createElement('button');
    btnAtras.innerText = "← Cambiar Fecha";
    btnAtras.className = "btn-volver";
    btnAtras.onclick = () => elegirFecha(seleccion.consultorio);
    container.appendChild(btnAtras);
};

// PASO 1.5: Elegir Fecha
const elegirFecha = (num) => {
    seleccion.consultorio = num;
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Seleccione Día (Consultorio ${num})</h3>`;

    const input = document.createElement('input');
    input.type = 'date';
    input.className = 'input-calendario';
    input.min = new Date().toISOString().split('T')[0]; // No fechas pasadas

    input.onchange = (e) => {
        const d = new Date(e.target.value).getUTCDay(); // 0=Dom, 6=Sab
        if (d === 0 || d === 6) {
            alert("No se pueden elegir fines de semana.");
            return;
        }
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

// PASO 1: Elegir Consultorio
const cargarBotonesConsultorios = () => {
    const container = document.getElementById('calendar-container');
    container.innerHTML = '<h3>Paso 1: Elija un Consultorio</h3>';
    const grid = document.createElement('div');
    grid.className = 'consultorios-grid';

    APP_CONFIG.consultorios.forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn-consultorio';
        btn.onclick = () => elegirFecha(num);
        grid.appendChild(btn);
    });
    container.appendChild(grid);
};

// Inicio
const initDashboard = () => {
    const user = netlifyIdentity.currentUser();
    if (!user) { window.location.href = "index.html"; return; }
    document.getElementById('user-email').innerText = user.email;
    cargarBotonesConsultorios();
};

if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => { if(user) initDashboard(); else window.location.href="index.html"; });
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
}