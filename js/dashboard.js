// js/dashboard.js
import { APP_CONFIG } from './config.js';

let seleccion = {
    consultorio: null,
    fecha: null
};

// Utilities: modal & spinner
const showSpinner = () => { const s = document.getElementById('spinner'); if (s) s.style.display = 'flex'; };
const hideSpinner = () => { const s = document.getElementById('spinner'); if (s) s.style.display = 'none'; };

const showModal = (message, showCancel = false) => {
    return new Promise(resolve => {
        const modal = document.getElementById('modal');
        const msg = document.getElementById('modal-message');
        const ok = document.getElementById('modal-ok');
        const cancel = document.getElementById('modal-cancel');
        msg.innerText = message;
        cancel.style.display = showCancel ? 'inline-block' : 'none';
        modal.style.display = 'flex';
        const cleanup = (val) => { modal.style.display = 'none'; ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel); resolve(val); };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        ok.addEventListener('click', onOk);
        cancel.addEventListener('click', onCancel);
    });
};
const showAlert = (message) => showModal(message, false);
const showConfirm = (message) => showModal(message, true);

const reservarTurno = async (hora) => {
    const user = netlifyIdentity.currentUser();
    if (!user) { await showAlert('No autorizado. Por favor inicia sesión.'); window.location.href = 'index.html'; return; }

    const textoConfirmar = `¿Confirmar Consultorio ${seleccion.consultorio}\nFecha: ${seleccion.fecha}\nHora: ${hora}:00 hs?`;
    if (!(await showConfirm(textoConfirmar))) return;

    if (!APP_CONFIG.consultorios.includes(seleccion.consultorio)) { await showAlert('Consultorio inválido'); cargarBotonesConsultorios(); return; }

    showSpinner();

    try {
        const token = await user.jwt();
        const respuesta = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                email: user.email,
                consultorio: seleccion.consultorio,
                fecha: seleccion.fecha,
                hora: hora,
                colorId: APP_CONFIG.coloresConsultorios[seleccion.consultorio]
            })
        });

        const datos = await respuesta.json();
        hideSpinner();

        if (respuesta.status === 401) {
            await showAlert("⚠️ No autorizado. Vuelva a iniciar sesión.");
            window.location.href = "index.html";
            return;
        } else if (respuesta.status === 409) {
            await showAlert("⚠️ El horario ya está reservado. Por favor elige otro.");
            mostrarHorarios();
            return;
        } else if (!respuesta.ok) {
            throw new Error(datos.error || datos.details || "Error desconocido");
        }

        await showAlert("✅ ¡Éxito! Turno agendado. Revisa tu email y calendario.");
        cargarBotonesConsultorios();
    } catch (err) {
        hideSpinner();
        await showAlert("❌ Error: " + err.message);
        mostrarHorarios();
    }
};

// ... (Funciones mostrarHorarios, elegirFecha y cargarBotonesConsultorios se mantienen igual que la versión anterior)

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