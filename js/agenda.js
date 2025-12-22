// agenda.js: Lógica de la sección de agenda
// (Aquí irá la lógica modularizada de agenda, importable desde dashboard.js)



import { APP_CONFIG } from './config.js';
// Variables de estado para la agenda
let seleccion = { consultorio: null, fecha: null };
let envIdPorHora = {};

export async function renderAgenda(container) {
  container.innerHTML = '';
  cargarBotonesConsultorios(container);
}

function cargarBotonesConsultorios(container) {
  container.innerHTML = '<h3>Paso 1: Elija un Consultorio</h3>';
  const grid = document.createElement('div');
  grid.className = 'consultorios-grid';
  (APP_CONFIG.consultorios || []).filter(num => num !== 1).forEach(num => {
    const btn = document.createElement('button');
    btn.innerText = `Consultorio ${num}`;
    btn.className = 'btn-consultorio';
    btn.onclick = () => elegirFecha(num, container);
    grid.appendChild(btn);
  });
  container.appendChild(grid);
}

function elegirFecha(num, container) {
  seleccion.consultorio = num;
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
    mostrarHorarios(container);
  };
  container.appendChild(input);
  const btnAtras = document.createElement('button');
  btnAtras.innerText = "← Volver";
  btnAtras.className = "btn-volver";
  btnAtras.onclick = () => cargarBotonesConsultorios(container);
  container.appendChild(btnAtras);
}

async function mostrarHorarios(container) {
  container.innerHTML = `<h3>Horarios: C${seleccion.consultorio} para el ${seleccion.fecha}</h3>`;
  const user = window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
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
      btn.onclick = () => cancelarReserva(h, container);
    } else if (!horasDisponibles.includes(h)) {
      btn.disabled = true;
      btn.classList.add('ocupado-otro');
    } else {
      btn.classList.add('libre');
      btn.onclick = () => reservarTurno(h, container);
    }
    grid.appendChild(btn);
  }
  container.appendChild(grid);
  const btnAtras = document.createElement('button');
  btnAtras.innerText = "← Cambiar Fecha";
  btnAtras.className = "btn-volver";
  btnAtras.onclick = () => elegirFecha(seleccion.consultorio, container);
  container.appendChild(btnAtras);
}

async function cancelarReserva(hora, container) {
  const user = window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
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
      mostrarHorarios(container);
    } else {
      alert('No se pudo cancelar: ' + (data.error || data.details || 'Error desconocido'));
    }
  } catch (e) {
    alert('Error al cancelar: ' + e.message);
  }
}

async function reservarTurno(hora, container) {
  const user = window.netlifyIdentity && window.netlifyIdentity.currentUser ? window.netlifyIdentity.currentUser() : null;
  const textoConfirmar = `¿Confirmar Consultorio ${seleccion.consultorio}\nFecha: ${seleccion.fecha}\nHora: ${hora}:00 hs?`;
  if (!confirm(textoConfirmar)) return;
  container.innerHTML = "<p>⌛ Procesando reserva y enviando invitaciones...</p>";
  try {
    const colorLookup = window.APP_CONFIG.coloresConsultorios || {};
    const defaultColor = Object.values(colorLookup)[0] || '1';
    const colorIdToSend = colorLookup[seleccion.consultorio] || defaultColor;
    const displayName = (user && (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name))) || (user && user.name) || user.email;
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
    const datos = await respuesta.json();
    if (respuesta.ok) {
      alert("✅ ¡Éxito! Turno agendado. Revisa tu email y calendario.");
      renderAgenda(container);
    } else {
      const msg = datos && (datos.error || datos.details) ? `${datos.error || ''} ${datos.details || ''}` : 'Error desconocido';
      const extras = datos && datos.missing ? `\nCampos faltantes: ${datos.missing.join(', ')}` : '';
      const ocup = datos && datos.ocupados ? `\nOcupados: ${JSON.stringify(datos.ocupados)}` : '';
      alert(`❌ No se pudo reservar:\n${msg}${extras}${ocup}`);
      renderAgenda(container);
    }
  } catch (err) {
    alert("❌ Error: " + err.message);
    renderAgenda(container);
  }
}
