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
        const hashPassword = async (pw) => {
            if (!pw) return '';
            const enc = new TextEncoder();
            const data = enc.encode(pw);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        };
        const hashed = await hashPassword(contrasena);
        const user = usuarios.find(u => u.documento === documento && u.contrasena === hashed);
        if (user) {
            // Guardar usuario en localStorage para sesión local
            localStorage.setItem('usuario_logueado', JSON.stringify(user));
            window.location.href = 'dashboard.html';
        } else {
            errorDiv.textContent = 'Documento o contraseña incorrectos.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error al validar usuario.';
    }
}
