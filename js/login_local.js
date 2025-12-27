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
            try {
                localStorage.setItem('usuarioActual', JSON.stringify(userSinPass));
                sessionStorage.setItem('usuarioActual', JSON.stringify(userSinPass)); // Fallback
                console.log('[LOGIN] Guardado usuarioActual:', userSinPass);
                // Verificar inmediatamente si se guardó correctamente
                const testUser = localStorage.getItem('usuarioActual');
                console.log('[LOGIN] Leído de localStorage:', testUser);
                if (!testUser) {
                    errorDiv.textContent = 'No se pudo guardar el usuario en localStorage.';
                    return;
                }
                // Pequeño delay para asegurar persistencia antes de redirigir
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 100);
            } catch (e) {
                errorDiv.textContent = 'Error guardando usuario en localStorage.';
            }
        } else {
            errorDiv.textContent = 'Documento o contraseña incorrectos.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error al validar usuario.';
    }
}
