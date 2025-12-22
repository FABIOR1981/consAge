const fs = require('fs');
const path = require('path');

// Usar solo un usuarios.json: en local en data/, en producción SIEMPRE en /tmp/data/
const pathProyecto = path.resolve(__dirname, '../../');
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = IS_PROD ? '/tmp/data' : path.join(pathProyecto, 'data');
const USUARIOS_PATH = path.join(DATA_DIR, 'usuarios.json');



const fetch = require('node-fetch');

async function getUsuariosDesdeGitHub() {
  try {
    const repo = process.env.GITHUB_REPO || 'FABIOR1981/consAge';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const filePath = 'data/usuarios.json';
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
  const base = Array.isArray(remoto) ? [...remoto] : [];
  const nuevos = Array.isArray(local) ? local : [];
  for (const nuevo of nuevos) {
    if (!nuevo || !nuevo.email) continue;
    const idx = base.findIndex(u => u.email === nuevo.email);
    if (idx === -1) {
      base.push({ ...nuevo });
    } else {
      if (nuevo.nombre && nuevo.nombre !== base[idx].nombre) {
        base[idx].nombre = nuevo.nombre;
      }
      if (nuevo.rol && nuevo.rol !== base[idx].rol) {
        base[idx].rol = nuevo.rol;
      }
      if (typeof nuevo.activo === 'boolean') {
        base[idx].activo = nuevo.activo;
      }
    }
  }
  console.log('DEBUG mergeUsuarios - resultado:', JSON.stringify(base));
  return base;
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
  console.log('DEBUG gestionar_usuarios - usuariosLocales:', JSON.stringify(usuariosLocales));
  console.log('DEBUG gestionar_usuarios - usuariosRemotos:', JSON.stringify(usuariosRemotos));
  // Merge seguro
  let usuarios = mergeUsuarios(usuariosLocales, usuariosRemotos);

  // Validar si el usuario que realiza la acción es admin
  // Si el rol es vacío, se considera 'usuario' (no admin)
  const rolSolicitante = body.solicitante && typeof body.solicitante.rol === 'string' && body.solicitante.rol.trim() !== ''
    ? body.solicitante.rol.trim()
    : 'usuario';
  const esAdmin = rolSolicitante === 'admin';

  // Alta de usuario (solo admin o automático en login)
  if (event.headers['x-netlify-event'] === 'signup') {
    const { email, user_metadata, auto_signup } = body;
    const nombre = user_metadata && user_metadata.full_name ? user_metadata.full_name : '';
    const rol = user_metadata && (user_metadata.role || user_metadata.roles) ? (user_metadata.role || user_metadata.roles) : '';
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

  // (Eliminado: nunca escribir usuarios.json desde la función serverless)

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
