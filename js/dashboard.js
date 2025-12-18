// js/dashboard.js
import { APP_CONFIG } from './config.js';

let seleccion = {
    consultorio: null,
    fecha: null
};

// PASO 3: Llamar a la función de reserva en Google
const reservarTurno = async (hora) => {
    const user = netlifyIdentity.currentUser();
    
    const confirmar = confirm(`¿Reservar Consultorio ${seleccion.consultorio} para el día ${seleccion.fecha} a las ${hora}:00 hs?`);
    if (!confirmar) return;

    try {
        const container = document.getElementById('calendar-container');
        container.innerHTML = "<p>⌛ Procesando reserva en Google Calendar...</p>";

        const respuesta = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                consultorio: seleccion.consultorio,
                fecha: seleccion.fecha,
                hora: hora.toString().padStart(2, '0')
            })
        });

        const resultado = await respuesta.json();

        if (respuesta.ok) {
            alert("✅ ¡Éxito! El turno ha sido agendado.");
            cargarBotonesConsultorios(); 
        } else {
            throw new Error(resultado.details || "Error desconocido");
        }
    } catch (err) {
        console.error("Error al reservar:", err);
        alert("❌ No se pudo agendar: " + err.message);
        mostrarHorarios(); // Volver a los horarios para reintentar
    }
};

// PASO 2: Mostrar los horarios para la fecha elegida
const mostrarHorarios = () => {
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Horarios para el ${seleccion.fecha} (C${seleccion.consultorio})</h3>`;
    
    const listaHorarios = document.createElement('div');
    listaHorarios.className = 'horarios-grid';

    const { inicio, fin } = APP_CONFIG.horarios;

    for (let hora = inicio; hora < fin; hora++) {
        const slot = document.createElement('button');
        slot.className = 'btn-horario';
        slot.innerText = `${hora.toString().padStart(2, '0')}:00 hs`;
        slot.onclick = () => reservarTurno(hora);
        listaHorarios.appendChild(slot);
    }

    container.appendChild(listaHorarios);

    const btnVolver = document.createElement('button');
    btnVolver.innerText = "← Cambiar Fecha";
    btnVolver.className = "btn-volver";
    btnVolver.onclick = () => elegirFecha(seleccion.consultorio);
    container.appendChild(btnVolver);
};

// PASO 1.5: Selector de Fecha
const elegirFecha = (num) => {
    seleccion.consultorio = num;
    const container = document.getElementById('calendar-container');
    container.innerHTML = `<h3>Paso 2: Elija el día para Consultorio ${num}</h3>`;

    const inputFecha = document.createElement('input');
    inputFecha.type = 'date';
    inputFecha.className = 'input-calendario';
    
    // Evitar elegir días pasados
    const hoy = new Date().toISOString().split('T')[0];
    inputFecha.min = hoy;

    inputFecha.onchange = (e) => {
        const fechaVal = e.target.value;
        const diaSemana = new Date(fechaVal).getUTCDay(); // 0 es Domingo, 6 es Sábado

        // Validar si es fin de semana (0=Dom, 6=Sáb)
        if (diaSemana === 0 || diaSemana === 6) {
            alert("Los fines de semana no están disponibles.");
            e.target.value = "";
            return;
        }

        seleccion.fecha = fechaVal;
        mostrarHorarios();
    };

    container.appendChild(inputFecha);

    const btnVolver = document.createElement('button');
    btnVolver.innerText = "← Volver a Consultorios";
    btnVolver.className = "btn-volver";
    btnVolver.onclick = () => cargarBotonesConsultorios();
    container.appendChild(btnVolver);
};

// PASO 1: Selector de Consultorio
const cargarBotonesConsultorios = () => {
    const container = document.getElementById('calendar-container');
    if (!container) return;

    container.innerHTML = '<h3>Paso 1: Seleccione un Consultorio</h3>';
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'consultorios-grid';

    APP_CONFIG.consultorios.forEach(num => {
        const btn = document.createElement('button');
        btn.innerText = `Consultorio ${num}`;
        btn.className = 'btn-consultorio';
        btn.onclick = () => elegirFecha(num);
        btnGroup.appendChild(btn);
    });
    container.appendChild(btnGroup);
};

// Inicialización
const initDashboard = () => {
    const user = netlifyIdentity.currentUser();
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    document.getElementById('user-email').innerText = user.email;
    cargarBotonesConsultorios();
};

if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => {
        if (!user) window.location.href = "index.html";
        else initDashboard();
    });
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
}