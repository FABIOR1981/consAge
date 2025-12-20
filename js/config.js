export const APP_CONFIG = {
    nombreProyecto: "Agenda de Consultorios",
    consultorios: [1, 2, 3, 4, 5],
    // Asignamos un colorId de Google a cada consultorio
    coloresConsultorios: {
        "1": "2",  // Flamenco
        "2": "1",  // Banana
        "3": "2",  // UVA
        "4": "7",  // Turquesa
        "5": "10"  // Albahaca
    },
    horarios: {
        inicio: 8, // 08:00
        fin: 21,    // 21:00
        intervalo: 60 // minutos por turno
    },
    diasLaborales: [1, 2, 3, 4, 5], // Lunes a Viernes
    cancelacion: {
        horasAntelacion: 24,
        reglaFinDeSemana: true // Si es lunes, debe cancelar el viernes
    },
    zonaHoraria: 'America/Montevideo'
};