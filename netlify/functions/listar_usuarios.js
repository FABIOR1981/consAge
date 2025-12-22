// Función para obtener la lista de usuarios desde usuarios.json
const fs = require('fs');
const path = require('path');

const USUARIOS_PATH = path.join(__dirname, '../../data/usuarios.json');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  let usuarios = [];
  if (fs.existsSync(USUARIOS_PATH)) {
    usuarios = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  }
  // (No logs)
  // Solo usuarios activos
  usuarios = usuarios.filter(u => u.activo !== false);
  return {
    statusCode: 200,
    body: JSON.stringify({ usuarios })
  };
};
