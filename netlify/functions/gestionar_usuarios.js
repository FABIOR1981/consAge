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

  // Alta de usuario
  if (event.headers['x-netlify-event'] === 'signup') {
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

  // Baja lógica de usuario
  if (event.headers['x-netlify-event'] === 'delete') {
    const { email } = body;
    const usuario = usuarios.find(u => u.email === email);
    if (usuario) {
      usuario.activo = false;
    }
  }

  // Guardar cambios
  fs.writeFileSync(USUARIOS_PATH, JSON.stringify(usuarios, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
