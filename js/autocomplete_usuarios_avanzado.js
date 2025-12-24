// Autocompletado avanzado solo por nombre (no email)
let usuariosCache = [];

export async function cargarUsuariosParaAutocompleteAvanzado(inputId, listaId) {
    const input = document.getElementById(inputId);
    let lista = document.getElementById(listaId);
    if (!input) return;
    if (!lista) {
        lista = document.createElement('div');
        lista.id = listaId;
        lista.className = 'autocomplete-lista';
        input.parentNode.appendChild(lista);
    }
    // Obtener usuarios solo una vez
    if (!usuariosCache.length) {
        const resp = await fetch('/.netlify/functions/listar_usuarios');
        const data = await resp.json();
        if (Array.isArray(data.usuarios)) {
            usuariosCache = data.usuarios;
        }
    }
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        lista.innerHTML = '';
        if (!val) return;
        const filtrados = usuariosCache.filter(u => u.nombre && u.nombre.toLowerCase().includes(val));
        filtrados.forEach(u => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.textContent = u.nombre;
            item.addEventListener('mousedown', function(e) {
                input.value = u.nombre;
                lista.innerHTML = '';
                lista.style.display = 'none';
            });
            lista.appendChild(item);
        });
        lista.style.display = filtrados.length ? 'block' : 'none';
    });
    // Ocultar lista al perder foco
    input.addEventListener('blur', function() {
        setTimeout(() => { lista.innerHTML = ''; lista.style.display = 'none'; }, 150);
    });
}
