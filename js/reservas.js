// reservas.js: Lógica de la sección de reservas
// (Aquí irá la lógica modularizada de reservas, importable desde dashboard.js)

// --- Lógica de reservas migrada desde dashboard.js ---
export async function renderReservas(container) {
  // Limpiar contenedor
  container.innerHTML = '';
  // Obtener usuario actual desde localStorage
  const user = JSON.parse(localStorage.getItem('usuarioActual'));
  if (!user) return;
  // Consultar el rol del usuario
  let esAdmin = false;
  if (user.rol === 'admin') esAdmin = true;
  // Título
  const titulo = document.createElement('h3');
  titulo.textContent = esAdmin ? 'Reservas realizadas' : 'Mis Reservas';
  titulo.style.marginBottom = '0.5em';
  container.appendChild(titulo);
  // Admin: combo de usuarios
  if (esAdmin) {
    let usuariosLista = null;
    try {
      const resp = await fetch('/.netlify/functions/listar_usuarios');
      const js = await resp.json();
      usuariosLista = Array.isArray(js.usuarios) ? js.usuarios.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')) : [];
    } catch (e) {
      container.innerHTML += `<p style='color:red'>No se pudo cargar la lista de usuarios: ${e.message}</p>`;
      return;
    }
    if (usuariosLista.length > 0) {
      const formFiltro = document.createElement('form');
      formFiltro.id = 'form-filtro-usuario';
      formFiltro.innerHTML = `
        <label style="font-weight:500;">Buscar usuario: <input type="text" id="filtro-nombre-usuario" placeholder="Ingrese parte del nombre..." autocomplete="off" style="margin-right:1em;"></label>
        <label style="font-weight:500;">Usuario: <select id="combo-usuario"><option value="">Seleccione un usuario</option></select></label>
      `;
      container.appendChild(formFiltro);
      const inputFiltro = formFiltro.querySelector('#filtro-nombre-usuario');
      const combo = formFiltro.querySelector('#combo-usuario');
      function renderCombo(filtro) {
        const opciones = usuariosLista
          .filter(u => !filtro || (u.nombre && u.nombre.toLowerCase().includes(filtro.toLowerCase())))
          .map(u => `<option value="${u.email}">${u.nombre || u.email}</option>`);
        combo.innerHTML = '<option value="">Seleccione un usuario</option>' + opciones.join('');
      }
      renderCombo('');
      inputFiltro.addEventListener('input', (e) => {
        renderCombo(e.target.value);
      });
      combo.addEventListener('change', (e) => {
        const reservasDiv = container.querySelector('.reservas-lista');
        if (reservasDiv) reservasDiv.remove();
        if (e.target.value) {
          mostrarReservasDeUsuario(container, { email: e.target.value, nombre: (usuariosLista.find(u => u.email === e.target.value) || {}).nombre }, true, usuariosLista);
        }
      });
    }
  } else {
    // Usuario normal: solo puede ver sus propias reservas
    mostrarReservasDeUsuario(container, { email: user.email, nombre: user.nombre || user.email }, false, null);
  }
}

async function mostrarReservasDeUsuario(container, filtro, isAdmin, usuariosLista) {
  try {
    let url = '/.netlify/functions/reservar';
    let emailFiltroValor = filtro && typeof filtro === 'object' ? filtro.email : filtro;
    let nombreFiltroValor = filtro && typeof filtro === 'object' ? filtro.nombre : '';
    if (isAdmin) {
      url += '?all=1';
    } else if (emailFiltroValor) {
      url += `?email=${encodeURIComponent(emailFiltroValor)}`;
    }
    const resp = await fetch(url);
    const data = await resp.json();
    let reservas = data.userEvents || [];
    // Filtrar SOLO por el usuario seleccionado (email o nombre exacto)
    const emailFiltroLower = (emailFiltroValor || '').toLowerCase();
    const nombreFiltroLower = (nombreFiltroValor || '').toLowerCase();
    reservas = reservas.filter(reserva => {
      const nombreReserva = (reserva.nombre || '').toLowerCase();
      const emailReserva = (reserva.email || '').toLowerCase();
      return (emailFiltroLower && emailReserva === emailFiltroLower) || (nombreFiltroLower && nombreReserva === nombreFiltroLower);
    });
    // Filtrar solo reservas futuras
    const ahora = new Date();
    reservas = reservas.filter(reserva => {
      const fechaReserva = new Date(`${reserva.fecha}T${reserva.hora.toString().padStart(2,'0')}:00:00-03:00`);
      return fechaReserva > ahora;
    });
    if (reservas.length === 0) {
      container.innerHTML += '<p class="reservas-lista">No hay reservas activas.</p>';
      return;
    }
    const lista = document.createElement('div');
    lista.className = 'reservas-lista';
    reservas.forEach(reserva => {
      const card = document.createElement('div');
      card.className = 'reserva-card';
      card.style.border = '1px solid #ccc';
      card.style.borderRadius = '8px';
      card.style.background = '#fafbff';
      card.style.margin = '1em 0';
      card.style.padding = '1em';
      card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '0.5em';
      const fechaHora = `${reserva.fecha} ${reserva.hora}:00 hs`;
      const fechaReserva = new Date(`${reserva.fecha}T${reserva.hora.toString().padStart(2,'0')}:00:00-03:00`);
      const ahora = new Date();
      const diffHoras = (fechaReserva - ahora) / (1000 * 60 * 60);
      const esCancelada = reserva.summary && reserva.summary.startsWith('Cancelada');
      if (esCancelada) return;
      card.innerHTML = `
        <div style="font-weight:bold;font-size:1.1em;color:#2a3a5a;">Consultorio ${reserva.consultorio}</div>
        <div><span style="color:#555;">${fechaHora}</span></div>
        <div><span style="color:#1a4">${reserva.nombre || reserva.email}</span></div>
      `;
      if (diffHoras > 24) {
        const btnCancelar = document.createElement('button');
        btnCancelar.innerText = 'Cancelar';
        btnCancelar.className = 'btn-cancelar';
        btnCancelar.style.background = '#e74c3c';
        btnCancelar.style.color = '#fff';
        btnCancelar.style.border = 'none';
        btnCancelar.style.borderRadius = '4px';
        btnCancelar.style.padding = '0.5em 1.2em';
        btnCancelar.style.fontWeight = 'bold';
        btnCancelar.style.cursor = 'pointer';
        btnCancelar.style.marginTop = '0.5em';
        btnCancelar.onclick = async () => {
          if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;
          try {
            const resp = await fetch('/.netlify/functions/reservar', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId: reserva.eventId, email: reserva.email })
            });
            const result = await resp.json();
            if (resp.ok) {
              alert('Reserva cancelada correctamente.');
              card.remove();
            } else {
              alert('No se pudo cancelar: ' + (result.error || result.details || 'Error desconocido'));
            }
          } catch (e) {
            alert('Error al cancelar: ' + e.message);
          }
        };
        card.appendChild(btnCancelar);
      } else {
        const noCancel = document.createElement('span');
        noCancel.style.color = 'gray';
        noCancel.style.marginTop = '0.5em';
        noCancel.innerText = '(No se puede cancelar: menos de 24h)';
        card.appendChild(noCancel);
      }
      lista.appendChild(card);
    });
    container.appendChild(lista);
  } catch (e) {
    container.innerHTML += `<p style='color:red'>Error al consultar reservas: ${e.message}</p>`;
  }
}
