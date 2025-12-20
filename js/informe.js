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
        const fechaInicio = form.elements['fechaInicio'] ? form.elements['fechaInicio'].value : '';
        const fechaFin = form.elements['fechaFin'] ? form.elements['fechaFin'].value : '';
        const consultorio = form.elements['consultorio'] ? form.elements['consultorio'].value : '';
        const busqueda = form.elements['busqueda'] ? form.elements['busqueda'].value.trim() : '';
        const tipoBusqueda = form.elements['tipoBusqueda'] ? form.elements['tipoBusqueda'].value : '';
        let url = `/.netlify/functions/informe_reservas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
        if (consultorio && consultorio !== '0') url += `&consultorio=${consultorio}`;
        if (busqueda) url += `&busqueda=${encodeURIComponent(busqueda)}&tipoBusqueda=${encodeURIComponent(tipoBusqueda)}`;
        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || data.details || 'Error desconocido');
            // Calcular totales de horas reservadas y canceladas
            let totalHorasReservadas = 0;
            let totalHorasCanceladas = 0;
            let totalHorasUsadas = 0;
            let totalHorasPorUsar = 0;
            const ahora = new Date();
            if (data.reservas && data.reservas.length) {
                data.reservas.forEach(ev => {
                    const esCancelada = ev.summary && ev.summary.startsWith('Cancelada');
                    // Calcular duración en horas
                    let horas = 0;
                    let inicio = null;
                    if (ev.start && ev.end) {
                        inicio = new Date(ev.start);
                        const fin = new Date(ev.end);
                        horas = (fin - inicio) / (1000 * 60 * 60);
                    }
                    if (esCancelada) {
                        totalHorasCanceladas += horas;
                    } else {
                        totalHorasReservadas += horas;
                        if (inicio && inicio < ahora) {
                            totalHorasUsadas += horas;
                        } else if (inicio && inicio >= ahora) {
                            totalHorasPorUsar += horas;
                        }
                    }
                });
            }
            // Mostrar totalizadores
            totalHorasDiv.innerHTML = '';
            totalHorasDiv.innerHTML += `<div>Total de horas reservadas: <strong>${totalHorasReservadas.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>`;
            totalHorasDiv.innerHTML += `<div style='margin-left:1em;'>• Usadas: <strong>${totalHorasUsadas.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>`;
            totalHorasDiv.innerHTML += `<div style='margin-left:1em;'>• Por usar: <strong>${totalHorasPorUsar.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>`;
            totalHorasDiv.innerHTML += `<div style='color:#888'>Total de horas canceladas: <strong>${totalHorasCanceladas.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>`;
            if (!data.reservas.length) {
                tabla.innerHTML = '<tr><td colspan="6">Sin resultados</td></tr>';
                return;
            }
            tabla.innerHTML = `<tr><th>Num</th><th>Consultorio</th><th>Usuario</th><th>Inicio</th><th>Fin</th><th>Descripción</th></tr>`;
            data.reservas.forEach((ev, idx) => {
                const consultorio = ev.summary ? ev.summary.split(':')[0] : '';
                const usuario = (ev.description && ev.description.match(/Reserva realizada por: ([^\n]+)/)) ? RegExp.$1 : '';
                const esCancelada = ev.summary && ev.summary.startsWith('Cancelada');
                const estiloCancelada = esCancelada ? "background:#f0f0f0;color:#888;" : "";
                tabla.innerHTML += `<tr style='${estiloCancelada}'><td>${idx + 1}</td><td>${consultorio}</td><td>${usuario}</td><td>${ev.start ? ev.start.replace('T', ' ').slice(0,16) : ''}</td><td>${ev.end ? ev.end.replace('T', ' ').slice(0,16) : ''}</td><td>${ev.description || ''}${esCancelada ? ' <span style=\'color:#888\'>(Cancelada)</span>' : ''}</td></tr>`;
            });
        } catch (err) {
            tabla.innerHTML = `<tr><td colspan="5" style="color:red">${err.message}</td></tr>`;
            totalHorasDiv.textContent = '';
        }
    };
});
