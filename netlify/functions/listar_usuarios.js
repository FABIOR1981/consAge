const fs = require('fs');
const path = require('path');

const pathProyecto = path.resolve(__dirname, '../../');
const DATA_DIR = path.join(pathProyecto, 'data');
const USUARIOS_PATH = path.join(DATA_DIR, 'usuarios.json');

exports.handler = async function(event, context) {
  let usuarios = [];
  if (fs.existsSync(USUARIOS_PATH)) {
    usuarios = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ usuarios })
  };
};
