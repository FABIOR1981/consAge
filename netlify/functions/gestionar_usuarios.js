const fs = require('fs');
const path = require('path');

// Usar solo un usuarios.json: en local en data/, en producción en /tmp/data/
const pathProyecto = path.resolve(__dirname, '../../');
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = IS_PROD ? '/tmp/data' : path.join(pathProyecto, 'data');
const USUARIOS_PATH = path.join(DATA_DIR, 'usuarios.json');

// Asegurar que la carpeta existe (solo si se puede escribir)
if (!IS_PROD || DATA_DIR.startsWith('/tmp')) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}


const fetch = require('node-fetch');

async function getUsuariosDesdeGitHub() {
  try {
    const repo = process.env.GITHUB_REPO || 'FABIOR1981/consAge';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const filePath = 'netlify/functions/usuarios.json';
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) return [];
    const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const fileResponse = await fetch(fileUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    });
    if (!fileResponse.ok) return [];
    const text = await fileResponse.text();
    return JSON.parse(text);
  } catch {
    return [];
  }
}

function mergeUsuarios(local, remoto) {
  const map = new Map();
  [...(Array.isArray(remoto) ? remoto : []), ...(Array.isArray(local) ? local : [])].forEach(u => {
    if (u && u.email) map.set(u.email, { ...u });
  });
  return Array.from(map.values());
}

async function syncUsuariosConGitHub(usuarios) {
  // Llama a la función serverless update-usuarios.js para sincronizar con GitHub
  try {
    const resp = await fetch(process.env.URL_UPDATE_USUARIOS || 'http://localhost:8888/.netlify/functions/update-usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: usuarios })
    });
    return await resp.json();
  } catch (e) {
    return { error: 'No se pudo sincronizar con GitHub', details: e.message };
  }
}

exports.handler = async function(event, context) {
  let body;
  try {
    body = JSON.parse(event.body);
    console.log("Body recibido en gestionar_usuarios:", body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Cuerpo inválido' })
    };
  }

  // Leer usuarios locales
  let usuariosLocales = [];
  if (fs.existsSync(USUARIOS_PATH)) {
    usuariosLocales = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  }
  // Leer usuarios remotos (GitHub)
  let usuariosRemotos = await getUsuariosDesdeGitHub();
  // Merge seguro
  let usuarios = mergeUsuarios(usuariosLocales, usuariosRemotos);

  // Validar si el usuario que realiza la acción es admin
  const esAdmin = body.solicitante && body.solicitante.rol === 'admin';

  // Alta de usuario (solo admin o automático en login)
  if (event.headers['x-netlify-event'] === 'signup') {
    const { email, user_metadata, auto_signup } = body;
    const nombre = user_metadata && user_metadata.full_name ? user_metadata.full_name : '';
    const rol = user_metadata && user_metadata.role ? user_metadata.role : '';
    // Verifica si ya existe
    const existe = usuarios.find(u => u.email === email);
    let usuarioAgregado = false;
    if (!existe) {
      // Si es admin o es alta automática (auto_signup=true), permite el alta
      if (esAdmin || auto_signup) {
        usuarios.push({ email, nombre, rol, activo: true });
        usuarioAgregado = true;
      } else {
        return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden dar de alta usuarios.' }) };
      }
    } else {
      // Si ya existe, actualiza nombre y rol si vienen en el login y no están vacíos
      existe.activo = true; // Reactiva si estaba dado de baja
      if (nombre && nombre.trim() && nombre !== existe.nombre) {
        existe.nombre = nombre;
      }
      if (rol && rol.trim() && rol !== existe.rol) {
        existe.rol = rol;
      }
    }
    // Si se agregó un usuario nuevo automáticamente, sincronizar con GitHub
    if (usuarioAgregado && auto_signup) {
      await syncUsuariosConGitHub(usuarios);
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

  // Guardar cambios solo si no estamos en producción, o si estamos en /tmp (Netlify)
  if (!IS_PROD || USUARIOS_PATH.startsWith('/tmp')) {
    fs.writeFileSync(USUARIOS_PATH, JSON.stringify(usuarios, null, 2));
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
