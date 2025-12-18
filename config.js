export const APP_CONFIG = {
    nombreProyecto: "Agenda de Consultorios",
    consultorios: [2, 3, 4, 5],
    horarios: {
        inicio: 8, // 08:00
        fin: 20,    // 20:00
        intervalo: 60 // minutos por turno
    },
    diasLaborales: [1, 2, 3, 4, 5], // Lunes a Viernes
    cancelacion: {
        horasAntelacion: 24,
        reglaFinDeSemana: true // Si es lunes, debe cancelar el viernes
    }
};