// login_local.js
// Valida usuario y contraseña contra usuarios.json (local)

async function login() {
    const documento = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena').value;
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';

    if (!documento || !contrasena) {
        errorDiv.textContent = 'Por favor, complete ambos campos.';
        return;
    }

    try {
        const response = await fetch('data/usuarios.json');
        if (!response.ok) throw new Error('No se pudo cargar la base de usuarios.');
        const usuarios = await response.json();
        // Comparar contraseña en texto plano (sin hash)
        const user = usuarios.find(u => u.documento === documento && u.contrasena === contrasena);
        if (user) {
            // Guardar usuario autenticado en localStorage (sin contraseña)
            const { contrasena, ...userSinPass } = user;
            localStorage.setItem('usuarioActual', JSON.stringify(userSinPass));
            window.location.href = 'dashboard.html';
        } else {
            errorDiv.textContent = 'Documento o contraseña incorrectos.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error al validar usuario.';
    }
}
