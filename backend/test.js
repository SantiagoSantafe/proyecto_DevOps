const assert = require('assert');
const http = require('http');
const express = require('express');

// App aislada (sin MongoDB) que espeja las rutas de server.js
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('🚀 API funcionando correctamente'));
app.get('/nombres', (req, res) => res.json([]));
app.post('/nombres', (req, res) => {
  if (!req.body || !req.body.nombre) {
    return res.status(400).json({ error: "El campo 'nombre' es requerido" });
  }
  res.json({ nombre: req.body.nombre });
});

const PORT = 3099;
const server = app.listen(PORT, runTests);

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost', port: PORT, path, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  const total = 4;

  try {
    const r1 = await get('/');
    assert.strictEqual(r1.status, 200);
    assert.ok(r1.body.includes('API funcionando'));
    console.log('✅ Test 1 PASSED: GET / → 200 OK con mensaje de salud');
    passed++;

    const r2 = await get('/nombres');
    assert.strictEqual(r2.status, 200);
    assert.ok(Array.isArray(JSON.parse(r2.body)));
    console.log('✅ Test 2 PASSED: GET /nombres → 200 retorna array');
    passed++;

    const r3 = await post('/nombres', {});
    assert.strictEqual(r3.status, 400);
    assert.ok(r3.body.error);
    console.log('✅ Test 3 PASSED: POST /nombres sin cuerpo → 400 Bad Request');
    passed++;

    const r4 = await post('/nombres', { nombre: 'Santiago' });
    assert.strictEqual(r4.status, 200);
    assert.strictEqual(r4.body.nombre, 'Santiago');
    console.log('✅ Test 4 PASSED: POST /nombres con payload válido → 200 OK');
    passed++;
  } catch (err) {
    console.error('❌ Test FAILED:', err.message);
  } finally {
    server.close();
    console.log(`\nResultado: ${passed}/${total} tests pasaron`);
    process.exit(passed === total ? 0 : 1);
  }
}
