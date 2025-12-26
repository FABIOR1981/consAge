// Renderizador simple para ABM USUARIOS
import { APP_CONFIG } from './config.js';
export function renderAbmUsu(container) {
    // Generar las opciones del combo de tipo de documento
    const opcionesTipDocu = APP_CONFIG.tiposDocumento.map(t => `<option value="${t}">${t}</option>`).join("");
    const opcionesRol = APP_CONFIG.roles.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("");
    container.innerHTML = `
        <h2>ABM de Usuarios</h2>
        <form id="usuario-form" class="abmusu-form" autocomplete="off" style="margin-bottom:1.5em; max-width:600px; margin-left:auto; margin-right:auto;">
            <input type="hidden" id="usuario-index">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.2em;">
                <div>
                    <label>Email:<br><input type="email" id="email" required autocomplete="username" style="width:100%;max-width:260px;"></label>
                </div>
                <div>
                    <label>Nombre:<br><input type="text" id="nombre" required style="width:100%;max-width:220px;"></label>
                </div>
                <div>
                    <label>Rol:<br><select id="rol" style="width:100%;max-width:160px;">${opcionesRol}</select></label>
                </div>
                <div>
                    <label>Activo:<br><input type="checkbox" id="activo" checked></label>
                </div>
                <div>
                    <label>Tipo Docu:<br><select id="tipdocu" style="width:100%;max-width:120px;">${opcionesTipDocu}</select></label>
                </div>
                <div>
                    <label>Documento:<br><input type="text" id="documento" style="width:100%;max-width:120px;"></label>
                </div>
                <div>
                    <label>Teléfono:<br><input type="text" id="telefono" style="width:100%;max-width:120px;"></label>
                </div>
                <div>
                    <label>Contraseña:<br><input type="password" id="contrasena" autocomplete="new-password" style="width:100%;max-width:160px;"></label>
                </div>
            </div>
            <div style="margin-top:1.5em; text-align:center;">
                <button type="submit" id="guardar-btn">Guardar</button>
                <button type="button" id="cancelar-btn">Cancelar</button>
            </div>
        </form>
        <table id="usuarios-table" border="1" style="width:100%;">
            <thead>
                <tr>
                    <th>Email</th><th>Nombre</th><th>Rol</th><th>Contraseña</th><th>Tipo Docu</th><th>Documento</th><th>Teléfono</th><th>Activo</th><th>Acciones</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;

    let usuarios = [];
    let editIndex = null;

    async function cargarUsuarios() {
        const resp = await fetch('data/usuarios.json');
        usuarios = await resp.json();
        renderTabla();
    }

    function renderTabla() {
        const tbody = container.querySelector('#usuarios-table tbody');
        tbody.innerHTML = '';
        usuarios.forEach((u, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.email}</td>
                <td>${u.nombre}</td>
                <td>${u.rol}</td>
                <td>${u.contrasena ? '••••••' : ''}</td>
                <td>${u.tipdocu || ''}</td>
                <td>${u.documento || ''}</td>
                <td>${u.telefono || ''}</td>
                <td>${u.activo ? 'Sí' : 'No'}</td>
                <td>
                    <button data-edit="${idx}">Editar</button>
                    <button data-baja="${idx}">${u.activo ? 'Baja' : 'Alta'}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function mostrarPopup(mensaje, tipo = 'info', tiempo = 3000) {
        let popup = document.getElementById('abmusu-popup');
        if (popup) popup.remove();
        popup = document.createElement('div');
        popup.id = 'abmusu-popup';
        popup.style.position = 'fixed';
        popup.style.top = '30%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.background = '#fff';
        popup.style.border = '2px solid ' + (tipo === 'success' ? 'green' : tipo === 'error' ? 'red' : '#333');
        popup.style.color = tipo === 'success' ? 'green' : tipo === 'error' ? 'red' : '#333';
        popup.style.padding = '2em 2em 1em 2em';
        popup.style.zIndex = 9999;
        popup.style.boxShadow = '0 2px 16px #0005';
        popup.style.fontSize = '1.1em';
        popup.innerHTML = `<div style="margin-bottom:1em;">${mensaje}</div><button id="cerrar-popup" style="padding:0.5em 1em;">Cerrar</button>`;
        document.body.appendChild(popup);
        // Cierre automático
        const timeout = setTimeout(() => { popup.remove(); }, tiempo);
        // Cierre manual
        popup.querySelector('#cerrar-popup').onclick = () => {
            clearTimeout(timeout);
            popup.remove();
        };
    }

    async function guardarUsuarios() {
        mostrarPopup('Guardando usuarios...', 'info', 2000);
        try {
            const resp = await fetch('/.netlify/functions/update-usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: usuarios })
            });
            const result = await resp.json();
            if (resp.ok && result.success) {
                mostrarPopup('Usuarios guardados correctamente.<br>Commit: ' + result.commit, 'success', 3500);
            } else {
                mostrarPopup('Error al guardar: ' + (result.error || resp.statusText) + (result.details ? ' - ' + result.details : ''), 'error', 6000);
            }
        } catch (e) {
            mostrarPopup('Error de red o servidor: ' + e.message, 'error', 6000);
        }
    }

    container.querySelector('#usuario-form').onsubmit = function(e) {
        e.preventDefault();
        const idx = container.querySelector('#usuario-index').value;
        const nuevoUsuario = {
            email: container.querySelector('#email').value,
            nombre: container.querySelector('#nombre').value,
            rol: container.querySelector('#rol').value,
            contrasena: container.querySelector('#contrasena').value,
            tipdocu: container.querySelector('#tipdocu').value,
            documento: container.querySelector('#documento').value,
            telefono: container.querySelector('#telefono').value,
            activo: container.querySelector('#activo').checked
        };
        if (idx === '') {
            usuarios.push(nuevoUsuario);
        } else {
            usuarios[idx] = { ...usuarios[idx], ...nuevoUsuario };
        }
        guardarUsuarios();
        renderTabla();
        this.reset();
        container.querySelector('#usuario-index').value = '';
    };

    container.querySelector('#cancelar-btn').onclick = function() {
        container.querySelector('#usuario-form').reset();
        container.querySelector('#usuario-index').value = '';
    };

    container.querySelector('#usuarios-table').onclick = function(e) {
        if (e.target.dataset.edit) {
            const idx = e.target.dataset.edit;
            const u = usuarios[idx];
            container.querySelector('#usuario-index').value = idx;
            container.querySelector('#email').value = u.email;
            container.querySelector('#nombre').value = u.nombre;
            container.querySelector('#rol').value = u.rol;
            container.querySelector('#contrasena').value = u.contrasena || '';
            container.querySelector('#tipdocu').value = u.tipdocu || APP_CONFIG.tiposDocumento[0];
            container.querySelector('#documento').value = u.documento || '';
            container.querySelector('#telefono').value = u.telefono || '';
            container.querySelector('#activo').checked = !!u.activo;
        }
        if (e.target.dataset.baja) {
            const idx = e.target.dataset.baja;
            usuarios[idx].activo = !usuarios[idx].activo;
            guardarUsuarios();
            renderTabla();
        }
    };

    cargarUsuarios();
}
