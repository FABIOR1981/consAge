import { APP_CONFIG } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-informe');
    const tabla = document.getElementById('tabla-informe');
    form.onsubmit = async (e) => {
        e.preventDefault();
        tabla.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
        const fechaInicio = form.fechaInicio.value;
        const fechaFin = form.fechaFin.value;
        const consultorio = form.consultorio.value;
        const usuario = form.usuario.value;
        let url = `/.netlify/functions/informe_reservas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
        if (consultorio) url += `&consultorio=${consultorio}`;
        if (usuario) url += `&usuario=${encodeURIComponent(usuario)}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || data.details || 'Error desconocido');
            if (!data.reservas.length) {
                tabla.innerHTML = '<tr><td colspan="5">Sin resultados</td></tr>';
                return;
            }
            tabla.innerHTML = `<tr><th>Consultorio</th><th>Usuario</th><th>Inicio</th><th>Fin</th><th>Descripción</th></tr>`;
            data.reservas.forEach(ev => {
                const consultorio = ev.summary ? ev.summary.split(':')[0] : '';
                const usuario = (ev.description && ev.description.match(/Reserva realizada por: ([^\n]+)/)) ? RegExp.$1 : '';
                tabla.innerHTML += `<tr><td>${consultorio}</td><td>${usuario}</td><td>${ev.start ? ev.start.replace('T', ' ').slice(0,16) : ''}</td><td>${ev.end ? ev.end.replace('T', ' ').slice(0,16) : ''}</td><td>${ev.description || ''}</td></tr>`;
            });
        } catch (err) {
            tabla.innerHTML = `<tr><td colspan="5" style="color:red">${err.message}</td></tr>`;
        }
    };
});
