export const APP_CONFIG = {
    nombreProyecto: "Agenda de Consultorios",
    consultorios: [1, 2, 3, 4, 5],
    // Asignamos un colorId de Google a cada consultorio
    coloresConsultorios: {
        "1": "2",  // Flamenco
        "2": "5",  // Banana
        "3": "3",  // UVA
        "4": "7",  // Turquesa
        "5": "10"  // Albahaca

/*
1: Lavanda — #a4bdfc
2: Salvia — #7ae7bf
3: Uva — #dbadff
4: Flamenco — #ff887c
5: Banana — #fbd75b
6: Mandarina — #ffb878
7: Turquesa — #46d6db
8: Gris claro — #e1e1e1
9: Azul intenso — #5484ed
10: Verde intenso — #51b749
11: Tomate — #dc2127

*/



    },
    horarios: {
        inicio: 8, // 08:00
        fin: 21,    // 21:00
        intervalo: 60 // minutos por turno
    },
    diasLaborales: [1, 2, 3, 4, 5, 6], // Lunes a Viernes

    // Agregamos una regla específica para el sábado
    horarioSabado: {
        inicio: 8,
        fin: 15
    }


    cancelacion: {
        horasAntelacion: 24,
        reglaFinDeSemana: true // Si es lunes, debe cancelar el viernes
    },
    
    zonaHoraria: 'America/Montevideo',
    estadosReserva: {
        RESERVADA: 'Reservada',
        USADA: 'Usada',
        CANCELADA: 'Cancelada'
    }
};