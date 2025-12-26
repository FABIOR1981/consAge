// Renderizador simple para ABM USUARIOS
export function renderAbmUsu(container) {
    container.innerHTML = `
        <h2>ABM de Usuarios</h2>
        <form id="usuario-form" style="margin-bottom:1em;">
            <input type="hidden" id="usuario-index">
            <label>Email: <input type="email" id="email" required></label>
            <label>Nombre: <input type="text" id="nombre" required></label>
            <label>Rol: <select id="rol"><option value="admin">Admin</option><option value="usuario">Usuario</option></select></label>
            <label>Tipo Docu: <input type="text" id="tipdocu"></label>
            <label>Documento: <input type="text" id="documento"></label>
            <label>Teléfono: <input type="text" id="telefono"></label>
            <button type="submit" id="guardar-btn">Guardar</button>
            <button type="button" id="cancelar-btn">Cancelar</button>
        </form>
        <table id="usuarios-table" border="1" style="width:100%;">
            <thead>
                <tr>
                    <th>Email</th><th>Nombre</th><th>Rol</th><th>Tipo Docu</th><th>Documento</th><th>Teléfono</th><th>Activo</th><th>Acciones</th>
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

    async function guardarUsuarios() {
        // Llama a la función serverless para persistir en GitHub
        let msgDiv = container.querySelector('#abmusu-msg');
        if (!msgDiv) {
            msgDiv = document.createElement('div');
            msgDiv.id = 'abmusu-msg';
            msgDiv.style.margin = '1em 0';
            container.prepend(msgDiv);
        }
        msgDiv.textContent = 'Guardando usuarios...';
        msgDiv.style.color = '#333';
        try {
            const resp = await fetch('/.netlify/functions/update-usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: usuarios })
            });
            const result = await resp.json();
            if (resp.ok && result.success) {
                msgDiv.textContent = 'Usuarios guardados correctamente. Commit: ' + result.commit;
                msgDiv.style.color = 'green';
            } else {
                msgDiv.textContent = 'Error al guardar: ' + (result.error || resp.statusText) + (result.details ? ' - ' + result.details : '');
                msgDiv.style.color = 'red';
            }
        } catch (e) {
            msgDiv.textContent = 'Error de red o servidor: ' + e.message;
            msgDiv.style.color = 'red';
        }
    }

    container.querySelector('#usuario-form').onsubmit = function(e) {
        e.preventDefault();
        const idx = container.querySelector('#usuario-index').value;
        const nuevoUsuario = {
            email: container.querySelector('#email').value,
            nombre: container.querySelector('#nombre').value,
            rol: container.querySelector('#rol').value,
            tipdocu: container.querySelector('#tipdocu').value,
            documento: container.querySelector('#documento').value,
            telefono: container.querySelector('#telefono').value,
            activo: true
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
            container.querySelector('#tipdocu').value = u.tipdocu || '';
            container.querySelector('#documento').value = u.documento || '';
            container.querySelector('#telefono').value = u.telefono || '';
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
