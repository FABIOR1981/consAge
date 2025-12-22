// utils/validateAuth0Token.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
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

async function validateAuth0Token(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  try {
    return await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        audience: AUTH0_AUDIENCE,
        issuer: `https://${AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
      }, (err, decoded) => {
        if (err) return resolve(null);
        resolve(decoded);
      });
    });
  } catch {
    return null;
  }
}

module.exports = { validateAuth0Token };