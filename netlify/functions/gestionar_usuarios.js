const fs = require('fs');
const path = require('path');

const USUARIOS_PATH = path.join(__dirname, 'usuarios.json');

exports.handler = async function(event, context) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Cuerpo inválido' })
    };
  }

  // Leer usuarios actuales
  let usuarios = [];
  if (fs.existsSync(USUARIOS_PATH)) {
    usuarios = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  }

  // Validar si el usuario que realiza la acción es admin
  const esAdmin = body.solicitante && body.solicitante.rol === 'admin';

  // Alta de usuario (solo admin)
  if (event.headers['x-netlify-event'] === 'signup') {
    if (!esAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden dar de alta usuarios.' }) };
    }
    const { email, user_metadata } = body;
    const nombre = user_metadata && user_metadata.full_name ? user_metadata.full_name : '';
    const rol = user_metadata && user_metadata.role ? user_metadata.role : '';
    // Verifica si ya existe
    const existe = usuarios.find(u => u.email === email);
    if (!existe) {
      usuarios.push({ email, nombre, rol, activo: true });
    } else {
      existe.activo = true; // Reactiva si estaba dado de baja
    }
  }

  // Baja lógica de usuario (solo admin)
  if (event.headers['x-netlify-event'] === 'delete') {
    if (!esAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden dar de baja usuarios.' }) };
    }
    const { email } = body;
    const usuario = usuarios.find(u => u.email === email);
    if (usuario) {
      usuario.activo = false;
    }
  }

  // Edición de usuario (solo admin)
  if (event.headers['x-netlify-event'] === 'edit') {
    if (!esAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden editar usuarios.' }) };
    }
    const { email, nombre, rol } = body;
    const usuario = usuarios.find(u => u.email === email);
    if (usuario) {
      if (nombre) usuario.nombre = nombre;
      if (rol) usuario.rol = rol;
    }
  }

  // Guardar cambios
  fs.writeFileSync(USUARIOS_PATH, JSON.stringify(usuarios, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
