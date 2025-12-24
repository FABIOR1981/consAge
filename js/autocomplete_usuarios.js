// Este archivo contendrá la lógica para el combo autocompletable de usuarios en el informe
export async function cargarUsuariosParaAutocomplete(inputId, datalistId) {
    // Obtener usuarios desde el backend (ajusta la URL si es necesario)
    const resp = await fetch('/.netlify/functions/listar_usuarios');
    const data = await resp.json();
    if (!Array.isArray(data.usuarios)) return;
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    datalist.innerHTML = '';
    data.usuarios.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.email + (u.nombre ? ` (${u.nombre})` : '');
        datalist.appendChild(opt);
    });
}
