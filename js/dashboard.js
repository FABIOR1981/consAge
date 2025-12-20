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
        const respuesta = await fetch('/.netlify/functions/reservar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                consultorio: seleccion.consultorio,
                fecha: seleccion.fecha,
                hora: hora,
                colorId: APP_CONFIG.coloresConsultorios[seleccion.consultorio] // Enviamos el color elegido
            })
        });

        const datos = await respuesta.json();

        if (respuesta.ok) {
            alert("✅ ¡Éxito! Turno agendado. Revisa tu email y calendario.");
            cargarBotonesConsultorios();
        } else {
            throw new Error(datos.details || "Error desconocido");
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
    // Solicitar al backend las horas disponibles y ocupadas por el usuario
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
        // Mapear eventId por hora para cancelación
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
        // Solo mostrar consultorios distintos de 1 para reservar
        APP_CONFIG.consultorios.filter(num => num !== 1).forEach(num => {
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
    // Actualizar mensaje de bienvenida con texto agradable
    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) {
        welcomeMsg.innerText = "Bienvenidos a la agenda de DeMaria Consultores. ¡Gestiona tus turnos de forma fácil y rápida!";
    }
    cargarBotonesConsultorios();
};

if (window.netlifyIdentity) {
    window.netlifyIdentity.on("init", user => { if(user) initDashboard(); else window.location.href="index.html"; });
    window.netlifyIdentity.on("logout", () => window.location.href = "index.html");
    // Agregar evento al botón de logout
    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.netlifyIdentity.logout();
            });
        }
        // Evento para mostrar reservas del usuario
        const misReservasBtn = document.getElementById('mis-reservas-btn');
        if (misReservasBtn) {
            misReservasBtn.addEventListener('click', async () => {
                const user = netlifyIdentity.currentUser();
                if (!user) return;
                const container = document.getElementById('calendar-container');
                container.innerHTML = '<h3>Mis Reservas</h3><p>Consultando tus reservas...</p>';
                try {
                    // Consultar reservas del usuario (ajustar endpoint si es necesario)
                    const resp = await fetch(`/.netlify/functions/reservar?email=${encodeURIComponent(user.email)}`);
                    const data = await resp.json();
                    const reservas = data.userEvents || [];
                    if (reservas.length === 0) {
                        container.innerHTML += '<p>No tienes reservas activas.</p>';
                        return;
                    }
                    const lista = document.createElement('ul');
                    lista.className = 'reservas-lista';
                    reservas.forEach(reserva => {
                        const li = document.createElement('li');
                        const fechaHora = `${reserva.fecha} ${reserva.hora}:00 hs`;
                        // Calcular si se puede cancelar (más de 24h)
                        const fechaReserva = new Date(`${reserva.fecha}T${reserva.hora.toString().padStart(2,'0')}:00:00-03:00`);
                        const ahora = new Date();
                        const diffHoras = (fechaReserva - ahora) / (1000 * 60 * 60);
                        // Detectar si está cancelada por el título
                        const esCancelada = reserva.summary && reserva.summary.startsWith('Cancelada');
                        if (esCancelada) {
                            // No mostrar reservas canceladas en 'Mis Reservas'
                            return;
                        }
                        li.innerHTML = `<strong>Consultorio ${reserva.consultorio}</strong> - ${fechaHora}`;
                        if (diffHoras > 24) {
                            const btnCancelar = document.createElement('button');
                            btnCancelar.innerText = 'Cancelar';
                            btnCancelar.className = 'btn-cancelar';
                            btnCancelar.onclick = async () => {
                                if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;
                                // Llamar a cancelarReserva con el eventId
                                try {
                                    const resp = await fetch('/.netlify/functions/reservar', {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ eventId: reserva.eventId, email: user.email })
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
                    container.innerHTML = '<h3>Mis Reservas</h3>';
                    container.appendChild(lista);
                } catch (e) {
                    container.innerHTML += `<p style='color:red'>Error al consultar reservas: ${e.message}</p>`;
                }
            });
        }
    });
}