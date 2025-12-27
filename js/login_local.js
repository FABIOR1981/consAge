// login_local.js
// Valida usuario y contraseña contra usuarios.json (local)

async function login() {
    const usuario = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena').value;
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';

    if (!usuario || !contrasena) {
        errorDiv.textContent = 'Por favor, complete ambos campos.';
        return;
    }

    try {
        const response = await fetch('data/usuarios.json');
        if (!response.ok) throw new Error('No se pudo cargar la base de usuarios.');
        const usuarios = await response.json();
        const user = usuarios.find(u => u.usuario === usuario && u.contrasena === contrasena);
        if (user) {
            // Redirigir o mostrar mensaje de éxito
            window.location.href = 'dashboard.html';
        } else {
            errorDiv.textContent = 'Usuario o contraseña incorrectos.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error al validar usuario.';
    }
}
