import { APP_CONFIG } from './config.js';

if (!window.__informeInitDone) window.__informeInitDone = false;

export async function initInforme() {
    if (window.__informeInitDone) return;

    const comboConsultorio = document.getElementById('combo-consultorio');
    const form = document.getElementById('form-informe');
    const tabla = document.getElementById('tabla-informe');
    let totalHorasDiv = document.getElementById('total-horas-informe');

    if (!comboConsultorio || !form || !tabla) {
        return false;
    }

    window.__informeInitDone = true;

    // Poblar combo
    comboConsultorio.innerHTML = '<option value="">-- Todos --</option>';
    if (APP_CONFIG && Array.isArray(APP_CONFIG.consultorios)) {
        APP_CONFIG.consultorios.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            comboConsultorio.appendChild(opt);
        });
    }

    if (!totalHorasDiv) {
        totalHorasDiv = document.createElement('div');
        totalHorasDiv.id = 'total-horas-informe';
        totalHorasDiv.style.margin = '0.5em 0';
        totalHorasDiv.style.textAlign = 'right';
        tabla.parentNode.insertBefore(totalHorasDiv, tabla);
    } else {
        totalHorasDiv.style.textAlign = 'right';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        tabla.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
        const fechaInicio = form.elements['fechaInicio'] ? form.elements['fechaInicio'].value : '';
        const fechaFin = form.elements['fechaFin'] ? form.elements['fechaFin'].value : '';
        const consultorio = form.elements['consultorio'] ? form.elements['consultorio'].value : '';
        const usuario = form.elements['busqueda'] ? form.elements['busqueda'].value.trim() : '';

        let url = `/.netlify/functions/informe_reservas?fechaInicio=${encodeURIComponent(fechaInicio)}&fechaFin=${encodeURIComponent(fechaFin)}`;
        if (consultorio) url += `&consultorio=${encodeURIComponent(consultorio)}`;
        if (usuario) url += `&usuario=${encodeURIComponent(usuario)}`;

        try {
            const resp = await fetch(url);
            const data = await resp.json();
            if (!Array.isArray(data) && data && data.reservas) {
                renderReservasTable(data.reservas, tabla, totalHorasDiv);
                return;
            }
            if (!Array.isArray(data) || data.length === 0) {
                tabla.innerHTML = '<tr><td colspan="6">No hay resultados</td></tr>';
                totalHorasDiv.innerText = '';
                return;
            }
            let rows = '<tr><th>Num</th><th>Consultorio</th><th>Fecha</th><th>Turno</th><th>Usuario</th><th>Estado</th></tr>';
            data.forEach((r, i) => {
                rows += `<tr><td>${i+1}</td><td>${r.consultorio||''}</td><td>${r.fecha||''}</td><td>${r.hora||''}</td><td>${r.usuario||''}</td><td>${r.estado||''}</td></tr>`;
            });
            tabla.innerHTML = rows;
            totalHorasDiv.style.textAlign = 'right';
            totalHorasDiv.innerHTML = `<div class="total-main">Total de filas: <strong>${data.length}</strong></div>`;
        } catch (err) {
            tabla.innerHTML = `<tr><td colspan="6">Error al obtener datos: ${err.message}</td></tr>`;
            totalHorasDiv.innerText = '';
        }
    });

    return true;

    function renderReservasTable(reservas, tablaEl, totalDiv) {
        let totalHorasReservadas = 0;
        let totalHorasCanceladas = 0;
        let totalHorasUsadas = 0;
        let totalHorasPorUsar = 0;
        const ahora = new Date();
        reservas.forEach(ev => {
            const esCancelada = ev.summary && ev.summary.startsWith('Cancelada');
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
                if (inicio && inicio < ahora) totalHorasUsadas += horas;
                else if (inicio && inicio >= ahora) totalHorasPorUsar += horas;
            }
        });
        totalDiv.innerHTML = '';
        totalDiv.style.textAlign = 'right';
            const colorMain = '#2e7d32';
            const colorSub = '#2e7d32';
            const colorCancel = '#888888';
            totalDiv.innerHTML += `<div style="color:${colorMain}; font-weight:700;">Total de horas reservadas: <strong>${totalHorasReservadas.toFixed(2)}</strong></div>`;
            totalDiv.innerHTML += `<div style="color:${colorSub}; margin-left:0.8em; font-weight:600;">• Usadas: <strong>${totalHorasUsadas.toFixed(2)}</strong></div>`;
            totalDiv.innerHTML += `<div style="color:${colorSub}; margin-left:0.8em; font-weight:600;">• Por usar: <strong>${totalHorasPorUsar.toFixed(2)}</strong></div>`;
            totalDiv.innerHTML += `<div style="color:${colorCancel}; font-weight:600; margin-top:0.25em;">Total de horas canceladas: <strong>${totalHorasCanceladas.toFixed(2)}</strong></div>`;
        totalDiv.innerHTML += `<div class="total-sub">• Usadas: <strong>${totalHorasUsadas.toFixed(2)}</strong></div>`;
        totalDiv.innerHTML += `<div class="total-sub">• Por usar: <strong>${totalHorasPorUsar.toFixed(2)}</strong></div>`;
        totalDiv.innerHTML += `<div class="total-cancel">Total de horas canceladas: <strong>${totalHorasCanceladas.toFixed(2)}</strong></div>`;

        if (!reservas.length) {
            tablaEl.innerHTML = '<tr><td colspan="6">Sin resultados</td></tr>';
            return;
        }
        tablaEl.innerHTML = `<tr><th>Num</th><th>Consultorio</th><th>Usuario</th><th>Inicio</th><th>Fin</th><th>Descripción</th></tr>`;
        reservas.forEach((ev, idx) => {
            const consultorio = ev.summary ? ev.summary.split(':')[0] : '';
            const usuario = (ev.description && ev.description.match(/Reserva realizada por: ([^\n]+)/)) ? RegExp.$1 : '';
            const esCancelada = ev.summary && ev.summary.startsWith('Cancelada');
            const estiloCancelada = esCancelada ? "background:#f0f0f0;color:#888;" : "";
            tablaEl.innerHTML += `<tr style='${estiloCancelada}'><td>${idx + 1}</td><td>${consultorio}</td><td>${usuario}</td><td>${ev.start ? ev.start.replace('T', ' ').slice(0,16) : ''}</td><td>${ev.end ? ev.end.replace('T', ' ').slice(0,16) : ''}</td><td>${ev.description || ''}${esCancelada ? ' <span style=\'color:#888\'>(Cancelada)</span>' : ''}</td></tr>`;
        });
    }
}

// Si el módulo se carga directo, intentar inicializar después de DOMContentLoaded
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => { initInforme().catch(()=>{}); });
} else {
    initInforme().catch(()=>{});
}


