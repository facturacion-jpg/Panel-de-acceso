'use strict';

// Suite de la API. Levanta su propio servidor en un puerto libre y con un
// DATA_DIR temporal: no depende de que haya otro cotizador corriendo ni
// modifica las cotizaciones reales. Se ejecuta con `npm test`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'src', 'server.js');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

function startServer(port, dataDir, extraEnv) {
  const child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(port),
      HOST: '127.0.0.1',
      LAN_IP: '127.0.0.1',
      DATA_DIR: dataDir,
      NODE_ENV: 'test',
      ADMIN_TOKEN: '',
      READ_ONLY: '',
      BASIC_AUTH_USER: '',
      BASIC_AUTH_PASS: '',
      CORS_ORIGIN: ''
    }, extraEnv || {}),
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-4000); });
  child.stderrText = () => stderr;
  return child;
}

async function waitForHealth(base, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error('El servidor terminó al arrancar: ' + child.stderrText());
    }
    try {
      const res = await fetch(base + '/api/health');
      if (res.ok) return;
    } catch (_) {
      // Todavía está arrancando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('El servidor no respondió en 12 segundos: ' + child.stderrText());
}

test('API del cotizador', async () => {
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotizador-test-'));
  const exportsDir = path.join(dataDir, 'exports');
  const child = startServer(port, dataDir);
  const results = [];

  function check(name, ok, detail) {
    results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 160) });
  }

  async function req(method, url, body, opts) {
    const options = Object.assign({ method, headers: { 'Content-Type': 'application/json' } }, opts || {});
    if (body !== undefined) options.body = JSON.stringify(body);
    const response = await fetch(base + url, options);
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, type, data, headers: response.headers };
  }

  function cleanExcel() {
    if (!fs.existsSync(exportsDir)) return 0;
    const files = fs.readdirSync(exportsDir).filter((f) => /^historial_.*\.xlsx$/i.test(f));
    for (const file of files) fs.rmSync(path.join(exportsDir, file), { force: true });
    return files.length;
  }

  try {
    await waitForHealth(base, child);

    // 1. Salud y archivos estáticos
    const health = await req('GET', '/api/health');
    check('GET /api/health', health.status === 200 && health.data.ok === true, JSON.stringify(health.data));

    const index = await req('GET', '/');
    check('GET / (HTML)', index.status === 200 && index.type.includes('text/html') && index.data.includes('Cotizador de Muestras'), index.type + ' ' + index.data.length + ' bytes');

    for (const [file, mime] of [['/app.js', 'javascript'], ['/styles.css', 'text/css'], ['/engine.js', 'javascript']]) {
      const res = await req('GET', file);
      check('GET ' + file, res.status === 200 && res.type.includes(mime) && res.data.length > 1000, res.type + ' ' + res.data.length + ' bytes');
    }

    const traversal = await req('GET', '/..%2f..%2fsrc%2fserver.js');
    check('Path traversal bloqueado', traversal.status === 400 || traversal.status === 403 || traversal.status === 404, 'HTTP ' + traversal.status);

    // 2. Bootstrap
    const boot = await req('GET', '/api/bootstrap');
    check('GET /api/bootstrap', boot.status === 200 && boot.data.operations.length === 568 && boot.data.references.length === 193, `ops=${boot.data.operations.length} refs=${boot.data.references.length} quotes=${boot.data.quotes.length}`);
    check('Cotizaciones iniciales vacías', boot.status === 200 && boot.data.quotes.length === 0, 'quotes=' + boot.data.quotes.length);
    check('Versión expuesta en bootstrap', typeof boot.data.version === 'string' && boot.data.version.length > 0, 'versión=' + boot.data.version);

    const op1 = boot.data.operations[0];
    const op2 = boot.data.operations[1];
    const ref = boot.data.references.find((r) => String(r.code) === 'A0065') || boot.data.references[0];
    check('Operaciones con nombre y tiempo base', !!op1.name && Number(op1.baseSec) > 0, op1.name + ' baseSec=' + op1.baseSec);
    check('Referencia con marca', typeof ref.marca === 'string', ref.code + ' marca="' + ref.marca + '"');

    // 3. Parámetros
    const params = await req('GET', '/api/parameters');
    check('GET /api/parameters', params.status === 200 && typeof params.data.efficiency === 'number', JSON.stringify(params.data));

    const putSame = await req('PUT', '/api/parameters', { workDays: params.data.workDays });
    check('PUT /api/parameters (mismo valor)', putSame.status === 200 && putSame.data.workDays === params.data.workDays, 'workDays=' + putSame.data.workDays);

    const invalidParams = [
      ['eficiencia 5', { efficiency: 5 }],
      ['días hábiles 0', { workDays: 0 }],
      ['horas/jornada 99', { hoursPerDay: 99 }],
      ['empaque negativo', { costPerMinPack: -1 }],
      ['suplemento 1.5', { supplementPct: 1.5 }]
    ];
    for (const [label, patch] of invalidParams) {
      const res = await req('PUT', '/api/parameters', patch);
      check('PUT parameters inválido (' + label + ') → 400', res.status === 400, res.data && res.data.error);
    }

    const junk = await req('PUT', '/api/parameters', { campoInventado: 123 });
    check('PUT parameters ignora claves desconocidas', junk.status === 200 && junk.data.campoInventado === undefined, 'claves=' + Object.keys(junk.data).join(','));

    const restored = await req('PUT', '/api/parameters', { efficiency: 0.8 });
    check('Eficiencia restaurada a 0.8', restored.status === 200 && restored.data.efficiency === 0.8, 'efficiency=' + restored.data.efficiency);

    // 4. Cálculo
    const lines = [
      { operation: op1.name, quantity: 2, adjustedSec: '' },
      { operation: op2.name, quantity: 1, adjustedSec: '12.5' }
    ];
    const calc = await req('POST', '/api/calculate', { lines, reference: ref.code });
    const totals = calc.data && calc.data.totals ? calc.data.totals : {};
    check('POST /api/calculate', calc.status === 200 && totals.operaciones === 2 && totals.samTotal > 0 && totals.precioSugerido > 0, `ops=${totals.operaciones} sam=${totals.samTotal} precio=${totals.precioSugerido}`);

    const calcBad = await req('POST', '/api/calculate', { lines: [{ operation: 'NO EXISTE XYZ', quantity: 1 }] });
    check('POST /api/calculate op inválida → 400', calcBad.status === 400, calcBad.data && calcBad.data.error);

    // 5. Cotizaciones
    const created = await req('POST', '/api/quotes', {
      reference: ref.code, description: (ref.description || 'PRUEBA') + ' TEST', type: ref.type || 'Blusa', marca: 'PRUEBA-AUTO', lines
    });
    check('POST /api/quotes', created.status === 201 && created.data.id, 'id=' + (created.data && created.data.id));
    const quoteId = created.data.id;

    const list = await req('GET', '/api/quotes');
    check('GET /api/quotes incluye la nueva', list.status === 200 && list.data.some((q) => q.id === quoteId), 'total=' + list.data.length);

    const one = await req('GET', '/api/quotes/' + quoteId);
    check('GET /api/quotes/:id', one.status === 200 && one.data.marca === 'PRUEBA-AUTO' && one.data.result.totals.operaciones === 2, 'marca=' + one.data.marca);

    const missing = await req('GET', '/api/quotes/no-existe');
    check('GET cotización inexistente → 404', missing.status === 404, missing.data && missing.data.error);

    // 6. Referencias / marca
    const refs = await req('GET', '/api/references');
    check('GET /api/references', refs.status === 200 && refs.data.length === 193, 'total=' + refs.data.length);

    const original = ref.marca;
    const putBrand = await req('PUT', '/api/references/' + encodeURIComponent(ref.code), { marca: 'MARCA-TEST' });
    const afterBrand = await req('GET', '/api/references');
    const brandRow = afterBrand.data.find((r) => String(r.code) === String(ref.code)) || {};
    check('PUT /api/references/:code', putBrand.status === 200 && brandRow.marca === 'MARCA-TEST', 'marca guardada=' + brandRow.marca);

    const restoreBrand = await req('PUT', '/api/references/' + encodeURIComponent(ref.code), { marca: original });
    check('Marca restaurada', restoreBrand.status === 200 && restoreBrand.data.marca === original, 'marca="' + restoreBrand.data.marca + '"');

    const badRef = await req('PUT', '/api/references/ZZZZ999', { marca: 'x' });
    check('PUT referencia inexistente → 404', badRef.status === 404, badRef.data && badRef.data.error);

    // 7. Correo / Excel
    const summary = await req('POST', '/api/email/summary', { ids: [quoteId] });
    check('POST /api/email/summary', summary.status === 200 && summary.data.count === 1 && summary.data.totalPrice > 0, `count=${summary.data.count} total=${summary.data.totalPrice} marcas=${JSON.stringify(summary.data.byBrand)}`);

    const emptySummary = await req('POST', '/api/email/summary', { ids: [] });
    check('POST summary sin ids devuelve vacío', emptySummary.status === 200 && emptySummary.data.count === 0, 'count=' + emptySummary.data.count);

    const excel = await req('POST', '/api/email/excel', { ids: [quoteId] });
    check('POST /api/email/excel', excel.status === 200 && /^historial_.*\.xlsx$/.test(excel.data.fileName), excel.data.fileName);
    const fileName = excel.data.fileName;

    const page = await req('GET', '/api/email/download?file=' + encodeURIComponent(fileName));
    check('GET página de descarga', page.status === 200 && page.data.includes('Descargar Excel'), page.type + ' ' + page.data.length + ' bytes');

    const file = await req('GET', '/api/email/download/file?file=' + encodeURIComponent(fileName));
    const isZip = Buffer.isBuffer(file.data) && file.data.slice(0, 2).toString() === 'PK';
    check('GET archivo .xlsx', file.status === 200 && file.type.includes('spreadsheetml') && isZip, `bytes=${file.data.length}`);

    const badFile = await req('GET', '/api/email/download/file?file=..%2F..%2Fstore.json');
    check('Descarga con nombre inválido → 400', badFile.status === 400, badFile.data && badFile.data.error);

    const preview = await req('POST', '/api/email/emailjs/preview', { ids: [quoteId] });
    const html = preview.data && preview.data.message ? preview.data.message : '';
    check('POST preview EmailJS', preview.status === 200 && html.includes('<!DOCTYPE html>') && html.includes('PRUEBA-AUTO') && html.includes('Cotizaciones seleccionadas'), 'html=' + html.length + ' chars');

    // 8. Rutas no existentes
    const notFound = await req('GET', '/api/no-existe');
    check('Ruta API inexistente → 404', notFound.status === 404, notFound.data && notFound.data.error);

    const badStatic = await req('POST', '/index.html');
    check('POST a archivo estático → 405', badStatic.status === 405, 'HTTP ' + badStatic.status);

    // 9. Copias de seguridad
    const backup = await req('GET', '/api/backup/download');
    check('GET /api/backup/download', backup.status === 200 && backup.data.format === 'cotizador-backup' && backup.data.store.quotes.some((q) => q.id === quoteId), `quotes=${backup.data.store.quotes.length}`);

    const verify = await req('POST', '/api/backup/verify', backup.data);
    check('POST /api/backup/verify', verify.status === 200 && verify.data.ok, `ops=${verify.data.operations}`);

    const verifyBad = await req('POST', '/api/backup/verify', { format: 'otro' });
    check('verify rechaza copia inválida', verifyBad.status === 400 && verifyBad.data.ok === false, 'HTTP ' + verifyBad.status);

    const made = await req('POST', '/api/backup/create');
    check('POST /api/backup/create', made.status === 200 && made.data.name, 'name=' + made.data.name);

    const backupStatus = await req('GET', '/api/backup/status');
    check('GET /api/backup/status y ensayo', backupStatus.status === 200 && backupStatus.data.drill.ok && backupStatus.data.backups.length >= 1, `copias=${backupStatus.data.backups.length}`);

    // 10. Limpieza
    const del = await req('DELETE', '/api/quotes/' + quoteId);
    check('DELETE /api/quotes/:id', del.status === 200, 'HTTP ' + del.status);

    const afterDel = await req('GET', '/api/quotes');
    check('Sin cotizaciones al final', afterDel.status === 200 && afterDel.data.length === 0, 'total=' + afterDel.data.length);

    // Restauración completa desde la copia descargada.
    const restoredBackup = await req('POST', '/api/backup/restore', backup.data);
    check('POST /api/backup/restore', restoredBackup.status === 200 && restoredBackup.data.quotes >= 1, `quotes=${restoredBackup.data.quotes}`);
    const afterRestore = await req('GET', '/api/quotes');
    check('Cotización recuperada desde la copia', afterRestore.data.some((q) => q.id === quoteId), 'total=' + afterRestore.data.length);
    const delAgain = await req('DELETE', '/api/quotes/' + quoteId);
    check('Limpieza tras restauración', delAgain.status === 200);

    const deletedExcel = cleanExcel();
    const leftovers = fs.existsSync(exportsDir) ? fs.readdirSync(exportsDir).filter((f) => f.endsWith('.xlsx')) : [];
    check('Excel de prueba eliminado', leftovers.length === 0, `quedan=${leftovers.length} (borrados=${deletedExcel})`);

    for (const result of results) {
      console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? '  → ' + result.detail : ''}`);
    }
    console.log(`${results.filter((r) => r.ok).length}/${results.length} pruebas API OK`);
    assert.equal(results.filter((r) => !r.ok).length, 0, 'Hay pruebas de la API que fallaron');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => {});
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('health check funciona con autenticación básica (Render)', async () => {
  const port = await freePort();
  const base = 'http://127.0.0.1:' + port;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotizador-auth-test-'));
  const child = startServer(port, dataDir, {
    BASIC_AUTH_USER: 'prueba',
    BASIC_AUTH_PASS: 'clave'
  });
  try {
    await waitForHealth(base, child);
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 200, 'Render necesita 200 en /api/health sin credenciales');

    const blocked = await fetch(base + '/api/bootstrap');
    assert.equal(blocked.status, 401, 'El resto de la API sí debe pedir contraseña');

    const credentials = Buffer.from('prueba:clave').toString('base64');
    const allowed = await fetch(base + '/api/bootstrap', {
      headers: { Authorization: 'Basic ' + credentials }
    });
    assert.equal(allowed.status, 200, 'Con credenciales correctas debe entrar');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => {});
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
