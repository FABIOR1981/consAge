// js/auth.js
if (window.netlifyIdentity) {
    // Al inicializar el widget
    window.netlifyIdentity.on("init", user => {
        if (user) {
            window.location.href = "dashboard.html";
        }
    });

    // Al hacer login exitoso
    window.netlifyIdentity.on("login", user => {
        window.location.href = "dashboard.html";
    });

    window.netlifyIdentity.on("error", err => console.error("Error de Identity:", err));
}