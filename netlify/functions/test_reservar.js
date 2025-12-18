// test_reservar.js - pruebas simuladas del handler
const fs = require('fs');
const path = require('path');

const original = fs.readFileSync(path.join(__dirname, 'reservar.js'), 'utf8');

// helper to create a handler with stubbed google behavior
function makeHandler({ conflict=false, verifyTokenOk=true, tokenEmail='a@b.com' } = {}) {
  const stub = `
const google = {
  auth: { JWT: function(){} },
  calendar: () => ({
    events: {
      list: async () => ({ data: { items: ${conflict ? "[{ id: 'existing' }]" : '[]'} } }),
      insert: async () => ({ data: { id: 'fake-event-id' } })
    }
  })
};
`;
  const replaced = original.replace("const { google } = require('googleapis');", stub);
  // monkey-patch fetch to simulate Netlify Identity when NETLIFY_SITE_URL is set
  const fakeFetch = async (url, opts) => {
    if (url.includes('/.netlify/identity/user')) {
      if (!verifyTokenOk) return { ok: false, status: 401 };
      return { ok: true, json: async () => ({ email: tokenEmail }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const module = { exports: {} };
  const wrapper = new Function('module', 'exports', 'fetch', replaced + '\nmodule.exports = exports;');
  wrapper(module, module.exports, fakeFetch);
  return module.exports.handler;
}

async function run() {
  // test 1: missing auth
  let handler = makeHandler({ conflict: false });
  let res = await handler({ httpMethod: 'POST', headers: {} });
  console.log('test1 status:', res.statusCode); // expect 401

  // test 2: missing fields but auth present - remote verification returns 401
  handler = makeHandler({ conflict: false, verifyTokenOk: false });
  res = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer badtoken' }, body: '{}' });
  console.log('test2 status:', res.statusCode); // expect 401 (verification failed)

  // test 3: missing fields but auth present - ok verification, but body missing fields -> 400
  handler = makeHandler({ conflict: false, verifyTokenOk: true });
  res = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: '{}' });
  console.log('test3 status:', res.statusCode); // expect 400

  // test 4: conflict
  handler = makeHandler({ conflict: true, verifyTokenOk: true });
  res = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify({ email:'a@b.com', consultorio:2, fecha:'2025-12-20', hora:10 }) });
  console.log('test4 status:', res.statusCode); // expect 409

  // test 5: success
  handler = makeHandler({ conflict: false, verifyTokenOk: true });
  res = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify({ email:'a@b.com', consultorio:2, fecha:'2025-12-21', hora:11 }) });
  console.log('test5 status:', res.statusCode, 'body:', res.body); // expect 200
}

run().catch(err=>{console.error(err); process.exit(1);});