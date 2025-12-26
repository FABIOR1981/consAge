// abmusu.js - Código Completo y Actualizado
import { APP_CONFIG } from './config.js';

export function renderAbmUsu(container) {
    // Generar las opciones de los combos
    const opcionesTipDocu = APP_CONFIG.tiposDocumento.map(t => `<option value="${t}">${t}</option>`).join("");
    const opcionesRol = APP_CONFIG.roles.map(r => `<option value="${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("");

    // HTML estructurado para el CSS externo
    container.innerHTML = `
        <div class="abmusu-section">
            <h2 class="abmusu-title">Gestión de Usuarios</h2>
            
            <form id="usuario-form" class="abmusu-form" autocomplete="off">
                <input type="hidden" id="usuario-index">
                
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" required autocomplete="username">
                </div>
                
                <div class="form-group">
                    <label>Confirmar Email</label>
                    <input type="email" id="email2" required autocomplete="username">
                </div>

                <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" id="nombre" required>
                </div>

                <div class="form-group">
                    <label>Rol</label>
                    <select id="rol">${opcionesRol}</select>
                </div>

                <div class="form-group checkbox-group">
                    <label>Activo</label>
                    <input type="checkbox" id="activo" checked>
                </div>

                <div class="form-group">
                    <label>Tipo Docu</label>
                    <select id="tipdocu">${opcionesTipDocu}</select>
                </div>

                <div class="form-group">
                    <label>Documento</label>
                    <input type="text" id="documento">
                </div>

                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="text" id="telefono">
                </div>

                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="contrasena" autocomplete="new-password">
                </div>

                <div class="form-group">
                    <label>Confirmar Contraseña</label>
                    <input type="password" id="contrasena2" autocomplete="new-password">
                </div>

                <div class="abmusu-buttons-container">
                    <button type="button" id="cancelar-btn" class="abmusu-btn-cancel">Cancelar</button>
                    <button type="submit" id="guardar-btn" class="abmusu-btn-save">Guardar</button>
                </div>
            </form>

            <div class="table-main-container">
                <table id="usuarios-table" class="custom-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Nombre</th>
                            <th>Rol</th>
                            <th>Doc.</th>
                            <th>Teléfono</th>
                            <th>Activo</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;

    let usuarios = [];

    // Cargar datos iniciales
    async function cargarUsuarios() {
        try {
            const resp = await fetch('data/usuarios.json');
            usuarios = await resp.json();
            renderTabla();
        } catch (e) {
            console.error("Error cargando usuarios:", e);
        }
    }

    // Renderizar la tabla con estilos modernos
    function renderTabla() {
        const tbody = container.querySelector('#usuarios-table tbody');
        tbody.innerHTML = '';
        usuarios.forEach((u, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.email}</td>
                <td>${u.nombre}</td>
                <td>${u.rol}</td>
                <td>${u.tipdocu || ''} ${u.documento || ''}</td>
                <td>${u.telefono || ''}</td>
                <td>${u.activo ? 'Sí' : 'No'}</td>
                <td class="table-actions">
                    <button class="edit-btn" data-edit="${idx}">Editar</button>
                    <button class="delete-btn" data-baja="${idx}">${u.activo ? 'Baja' : 'Alta'}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Función para notificaciones (Popups)
    function mostrarPopup(mensaje, tipo = 'info', tiempo = 3000) {
        let popup = document.getElementById('abmusu-popup');
        if (popup) popup.remove();
        popup = document.createElement('div');
        popup.id = 'abmusu-popup';
        popup.className = `abmusu-popup-content ${tipo}`;
        popup.innerHTML = `<div>${mensaje}</div><button id="cerrar-popup">Cerrar</button>`;
        document.body.appendChild(popup);
        
        const timeout = setTimeout(() => { popup.remove(); }, tiempo);
        popup.querySelector('#cerrar-popup').onclick = () => {
            clearTimeout(timeout);
            popup.remove();
        };
    }

    // Guardar en Netlify/Backend
    async function guardarUsuariosBackend() {
        try {
            const resp = await fetch('/.netlify/functions/update-usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: usuarios })
            });
            const result = await resp.json();
            if (resp.ok && result.success) {
                mostrarPopup('Cambios guardados con éxito', 'success');
            } else {
                mostrarPopup('Error al guardar: ' + result.error, 'error');
            }
        } catch (e) {
            mostrarPopup('Error de conexión', 'error');
        }
    }

    // Manejo del Formulario
    container.querySelector('#usuario-form').onsubmit = async function(e) {
        e.preventDefault();
        const idx = container.querySelector('#usuario-index').value;
        const email = container.querySelector('#email').value.trim();
        const email2 = container.querySelector('#email2').value.trim();
        const contrasena = container.querySelector('#contrasena').value;
        const contrasena2 = container.querySelector('#contrasena2').value;

        if (email !== email2) {
            mostrarPopup('Los emails no coinciden.', 'error');
            return;
        }
        if (contrasena !== contrasena2) {
            mostrarPopup('Las contraseñas no coinciden.', 'error');
            return;
        }

        const hashPassword = async (pw) => {
            if (!pw) return '';
            const enc = new TextEncoder();
            const data = enc.encode(pw);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        };

        const nuevoUsuario = {
            email,
            nombre: container.querySelector('#nombre').value,
            rol: container.querySelector('#rol').value,
            contrasena: contrasena ? await hashPassword(contrasena) : (idx !== '' ? usuarios[idx].contrasena : ''),
            tipdocu: container.querySelector('#tipdocu').value,
            documento: container.querySelector('#documento').value,
            telefono: container.querySelector('#telefono').value,
            activo: container.querySelector('#activo').checked
        };

        if (idx === '') {
            usuarios.push(nuevoUsuario);
        } else {
            usuarios[idx] = nuevoUsuario;
        }

        renderTabla();
        guardarUsuariosBackend();
        this.reset();
        container.querySelector('#usuario-index').value = '';
    };

    // Botón Cancelar
    container.querySelector('#cancelar-btn').onclick = function() {
        container.querySelector('#usuario-form').reset();
        container.querySelector('#usuario-index').value = '';
    };

    // Acciones de la Tabla (Editar/Baja)
    container.querySelector('#usuarios-table').onclick = function(e) {
        if (e.target.dataset.edit) {
            const idx = e.target.dataset.edit;
            const u = usuarios[idx];
            container.querySelector('#usuario-index').value = idx;
            container.querySelector('#email').value = u.email;
            container.querySelector('#email2').value = u.email;
            container.querySelector('#nombre').value = u.nombre;
            container.querySelector('#rol').value = u.rol;
            container.querySelector('#tipdocu').value = u.tipdocu || '';
            container.querySelector('#documento').value = u.documento || '';
            container.querySelector('#telefono').value = u.telefono || '';
            container.querySelector('#activo').checked = !!u.activo;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        if (e.target.dataset.baja) {
            const idx = e.target.dataset.baja;
            usuarios[idx].activo = !usuarios[idx].activo;
            renderTabla();
            guardarUsuariosBackend();
        }
    };

    cargarUsuarios();
}