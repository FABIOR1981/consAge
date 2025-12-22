// Función para obtener la lista de usuarios desde usuarios.json

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// URL pública del archivo usuarios.json
const USUARIOS_URL = process.env.URL
  ? `${process.env.URL}/data/usuarios.json`
  : 'http://localhost:8888/data/usuarios.json';

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  let usuarios = [];
  try {
    const resp = await fetch(USUARIOS_URL);
    if (resp.ok) {
      usuarios = await resp.json();
    }
  } catch {}
  // Solo usuarios activos
  usuarios = Array.isArray(usuarios) ? usuarios.filter(u => u.activo !== false) : [];
  return {
    statusCode: 200,
    body: JSON.stringify({ usuarios })
  };
};
