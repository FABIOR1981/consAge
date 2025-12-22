// Utilidad para validar el token de Netlify Identity (Auth0 como proveedor externo)
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const IDENTITY_JWKS_URI = process.env.IDENTITY_JWKS_URI; // Debes configurar esta variable en Netlify

const client = jwksClient({
  jwksUri: IDENTITY_JWKS_URI
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function(err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

async function validateIdentityToken(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  try {
    return await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {}, (err, decoded) => {
        if (err) return resolve(null);
        resolve(decoded);
      });
    });
  } catch {
    return null;
  }
}

module.exports = { validateIdentityToken };