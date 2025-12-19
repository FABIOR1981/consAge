import { APP_CONFIG } from './config.js';

window.addEventListener('DOMContentLoaded', () => {
        // Llenar combo de consultorios desde config.js
        const comboConsultorio = document.getElementById('combo-consultorio');
        if (comboConsultorio && APP_CONFIG.consultorios) {
            // Eliminar opciones extra si las hubiera (dejamos solo "Todos")
            while (comboConsultorio.options.length > 1) comboConsultorio.remove(1);
            APP_CONFIG.consultorios.forEach(num => {
                const opt = document.createElement('option');
                opt.value = num;
                opt.textContent = `Consultorio ${num}`;
                comboConsultorio.appendChild(opt);
            });
        }
    const form = document.getElementById('form-informe');
    const tabla = document.getElementById('tabla-informe');
    // Crear o buscar el elemento para mostrar el total de horas
    let totalHorasDiv = document.getElementById('total-horas-informe');
    if (!totalHorasDiv) {
        totalHorasDiv = document.createElement('div');
        totalHorasDiv.id = 'total-horas-informe';
        totalHorasDiv.style.margin = '1em 0';
        tabla.parentNode.insertBefore(totalHorasDiv, tabla);
    }
    form.onsubmit = async (e) => {
        e.preventDefault();
        tabla.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
        const fechaInicio = form.fechaInicio.value;
        const fechaFin = form.fechaFin.value;
        const consultorio = comboConsultorio ? comboConsultorio.value : form.consultorio.value;
        const busqueda = form.busqueda.value.trim();
        const tipoBusqueda = form.tipoBusqueda.value;
        let url = `/.netlify/functions/informe_reservas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
        if (consultorio && consultorio !== '0') url += `&consultorio=${consultorio}`;
        if (busqueda) url += `&busqueda=${encodeURIComponent(busqueda)}&tipoBusqueda=${encodeURIComponent(tipoBusqueda)}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || data.details || 'Error desconocido');
            // Mostrar total de horas
            if (typeof data.totalHoras === 'number') {
                totalHorasDiv.textContent = `Total de horas reservadas: ${data.totalHoras.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            } else {
                totalHorasDiv.textContent = '';
            }
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
            totalHorasDiv.textContent = '';
        }
    };
});
