import { APP_CONFIG } from './config.js';

if (!window.__informeInitDone) window.__informeInitDone = false;

export function initInforme() {
    if (window.__informeInitDone) return;

    const tryInit = () => {
        const comboConsultorio = document.getElementById('combo-consultorio');
        const form = document.getElementById('form-informe');
        const tabla = document.getElementById('tabla-informe');
        let totalHorasDiv = document.getElementById('total-horas-informe');

        if (!comboConsultorio || !form || !tabla) return false;

        // marcar como inicializado
        window.__informeInitDone = true;

        // poblar combo
        comboConsultorio.innerHTML = '<option value="">-- Todos --</option>';
        if (APP_CONFIG && Array.isArray(APP_CONFIG.consultorios)) {
            APP_CONFIG.consultorios.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                comboConsultorio.appendChild(opt);
            });
        }

        // manejar submit sin redirección
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
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
                // render tabla
                if (!Array.isArray(data) || data.length === 0) {
                    tabla.innerHTML = '<tr><td colspan="6">No hay resultados</td></tr>';
                    totalHorasDiv && (totalHorasDiv.innerText = '');
                    return;
                }
                let rows = '<tr><th>Num</th><th>Consultorio</th><th>Fecha</th><th>Turno</th><th>Usuario</th><th>Estado</th></tr>';
                data.forEach((r, i) => {
                    rows += `<tr><td>${i+1}</td><td>${r.consultorio||''}</td><td>${r.fecha||''}</td><td>${r.hora||''}</td><td>${r.usuario||''}</td><td>${r.estado||''}</td></tr>`;
                });
                tabla.innerHTML = rows;
                totalHorasDiv && (totalHorasDiv.innerText = `Total: ${data.length}`);
            } catch (err) {
                tabla.innerHTML = `<tr><td colspan="6">Error al obtener datos: ${err.message}</td></tr>`;
            }
        });

        return true;
    };

    if (!tryInit()) {
        document.addEventListener('DOMContentLoaded', () => { tryInit(); });
    }
}

// Si se carga como módulo standalone, inicializar cuando esté listo
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initInforme);
} else {
    initInforme();
}
import { APP_CONFIG } from './config.js';

// Guard para evitar inicialización duplicada
if (!window.__informeInitDone) window.__informeInitDone = false;

export function initInforme() {
	if (window.__informeInitDone) return;
	window.__informeInitDone = true;

	// Llenar combo de consultorios desde config.js
	const comboConsultorio = document.getElementById('combo-consultorio');
	if (comboConsultorio && APP_CONFIG.consultorios) {
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
		// usamos 'usuario' como nombre del parámetro para alinear con el backend
		const usuario = form.elements['busqueda'] ? form.elements['busqueda'].value.trim() : '';
		let url = `/.netlify/functions/informe_reservas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
		if (consultorio && consultorio !== '0') url += `&consultorio=${consultorio}`;
		if (usuario) url += `&usuario=${encodeURIComponent(usuario)}`;
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
}

// Auto-inicializar si el script se carga directamente en la página
if (document.readyState === 'loading') {
	window.addEventListener('DOMContentLoaded', initInforme);
} else {
	initInforme();
}


