export const APP_CONFIG = {
    nombreProyecto: "Agenda de Consultorios",
    consultorios: [2, 3, 4, 5],
    // Asignamos un colorId de Google a cada consultorio
    coloresConsultorios: {
        "2": "6",  // Girasol (Amarillo intenso)
        "3": "9",  // Violeta
        "4": "1",  // Azul (Lavanda)
        "5": "10"  // Verde (Albahaca)
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
    }
};