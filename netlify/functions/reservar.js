// Placeholder para reservar.js. Implementa solo respuesta vacía para evitar errores 404.
exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, msg: 'Función reservar restaurada (placeholder).' })
  };
};
