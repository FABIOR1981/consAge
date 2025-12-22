// js/auth.js
if (window.netlifyIdentity) {
    // Al inicializar el widget
    window.netlifyIdentity.on("init", user => {
        if (user) {
            registrarUsuarioEnBackend(user);
            window.location.href = "dashboard.html";
        }
    });

    // Al hacer login exitoso
    window.netlifyIdentity.on("login", user => {
        registrarUsuarioEnBackend(user);
        window.location.href = "dashboard.html";
    });

    window.netlifyIdentity.on("error", err => console.error("Error de Identity:", err));
}

async function registrarUsuarioEnBackend(user) {
    if (!user || !user.email) return;
    const body = {
        email: user.email,
        user_metadata: user.user_metadata || {},
        auto_signup: true
    };
    try {
        await fetch('/.netlify/functions/gestionar_usuarios', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-netlify-event': 'signup'
            },
            body: JSON.stringify(body)
        });
    } catch (e) {
        console.error('No se pudo registrar el usuario en backend:', e);
    }
}