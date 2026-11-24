'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ExcelJS = require('exceljs');
const engine = require('./engine');
// Un solo número de versión para el health check, la API y la interfaz.
const APP_VERSION = require('../package.json').version;

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
// DATA_DIR permite montar un disco persistente en la nube (por ejemplo /var/data).
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const CATALOG_BACKUP = path.join(DATA_DIR, 'catalog.anterior.json');
const STORE_BACKUP = path.join(DATA_DIR, 'store.anterior.json');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
const AUDIT_LOG = path.join(DATA_DIR, 'audit.log');
const EXPORT_SCRIPT = path.join(ROOT, 'tools', 'export_excel.ps1');
// Retención de los Excel generados: ni por antigüedad ni por cantidad deben
// crecer sin control. EXPORT_RETENTION_DAYS=0 desactiva el límite por edad.
const EXPORT_MAX_FILES = Number(process.env.EXPORT_MAX_FILES) > 0
  ? Number(process.env.EXPORT_MAX_FILES) : 60;
const EXPORT_RETENTION_DAYS = Number.isFinite(Number(process.env.EXPORT_RETENTION_DAYS))
  ? Math.max(0, Number(process.env.EXPORT_RETENTION_DAYS)) : 7;
// Copias completas con fecha: se conservan las últimas BACKUP_RETENTION.
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_RETENTION = Number(process.env.BACKUP_RETENTION) > 0
  ? Math.floor(Number(process.env.BACKUP_RETENTION)) : 10;
// Aviso de espacio bajo. Por defecto 200 MB; se puede ajustar por entorno.
const MIN_FREE_BYTES = Number(process.env.MIN_FREE_BYTES) > 0
  ? Number(process.env.MIN_FREE_BYTES) : 200 * 1024 * 1024;
const BACKUP_FORMAT = 'cotizador-backup';
// Límites de entrada: evitan que un campo enorme termine en el JSON y en el Excel.
const MAX_QUOTE_LINES = 80;
const MAX_QUOTES = 20000;
const MAX_FIELD = { code: 60, description: 240, type: 80, marca: 80, operation: 160 };
const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';
// Autenticación básica opcional. Si no se definen, el servicio queda abierto
// (útil cuando la autenticación la pone la aplicación que lo integra).
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || '';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || '';
// Orígenes permitidos para llamar la API desde otra aplicación del navegador.
// Vacío = sin CORS. Ejemplo: "https://app.empresa.com" o "*".
const CORS_ORIGINS = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
// Si se deja la API abierta a cualquier sitio sin contraseña, cualquiera podría
// llamarla desde una página ajena. En producción se detiene el arranque.
if (CORS_ORIGINS.includes('*') && !BASIC_AUTH_USER) {
  const warning = 'CORS_ORIGIN=* sin BASIC_AUTH_* deja el cotizador abierto a cualquier sitio.';
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.error('ERROR: ' + warning + ' Arranque detenido por seguridad.');
    process.exit(1);
  }
  console.warn('ADVERTENCIA: ' + warning);
}
// Clave opcional para acciones destructivas (importar, limpiar, restaurar, borrar).
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
// Modo solo lectura: bloquea guardados sin impedir calcular ni generar Excel.
const READ_ONLY = String(process.env.READ_ONLY || '') === '1';
const TRUST_PROXY = String(process.env.TRUST_PROXY || '') === '1';
// Header del proxy que trae el nombre del usuario autenticado (solo con TRUST_PROXY=1).
const AUDIT_USER_HEADER = String(process.env.AUDIT_USER_HEADER || '').toLowerCase();

// Fail-closed en producción: sin credenciales o con CORS abierto, el servicio
// no arranca. Evita que un despliegue olvidado deje la API modificable por
// cualquier visitante.
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  const missing = [];
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASS) missing.push('BASIC_AUTH_USER y BASIC_AUTH_PASS');
  if (!ADMIN_TOKEN) missing.push('ADMIN_TOKEN');
  if (CORS_ORIGINS.includes('*')) missing.push('CORS_ORIGIN=* (no permitido)');
  if (missing.length) {
    console.error('ERROR de configuración en producción: ' + missing.join('; ') + '. Arranque detenido.');
    process.exit(1);
  }
}

// Claves válidas de los parámetros de cotización (se usan al guardar).
const PARAM_KEYS = [
  'supplementPct', 'costPerMinConf', 'costPerMinFinish', 'costPerMinPack',
  'complexityFactor', 'profitPct', 'workDays', 'hoursPerDay', 'efficiency'
];

// Si DATA_DIR apunta a un disco nuevo (Render, Docker, etc.), se siembra con el
// catálogo incluido en el proyecto para que el primer arranque tenga datos.
function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const bundledCatalog = path.join(ROOT, 'data', 'catalog.json');
  if (!fs.existsSync(CATALOG_PATH) && fs.existsSync(bundledCatalog) && CATALOG_PATH !== bundledCatalog) {
    fs.copyFileSync(bundledCatalog, CATALOG_PATH);
  }
}
ensureDataDir();

function loadCatalog() {
  const parsed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  if (!Array.isArray(parsed.operations) || !Array.isArray(parsed.references) || !parsed.parameters) {
    throw new Error('El archivo de catálogo no tiene la estructura esperada');
  }
  return parsed;
}

let catalog = loadCatalog();

let storeWarning = '';

function fileStamp() {
  return new Date().toISOString().replace(/[:.]/g, '').slice(0, 15).replace('T', '_');
}

function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
}

function storeFileIsValid(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.quotes);
  } catch (_) {
    return false;
  }
}

function normalizeStore(parsed) {
  return {
    parameters: parsed.parameters && typeof parsed.parameters === 'object' ? parsed.parameters : {},
    quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
    version: parsed.version || 1
  };
}

function readStore() {
  if (!fs.existsSync(STORE_PATH)) {
    if (fs.existsSync(STORE_BACKUP) && storeFileIsValid(STORE_BACKUP)) {
      console.warn('store.json no existía; se recuperó desde store.anterior.json');
      storeWarning = 'Faltaba el archivo de cotizaciones y se recuperó desde la copia de seguridad.';
      return normalizeStore(JSON.parse(fs.readFileSync(STORE_BACKUP, 'utf8')));
    }
    return { parameters: {}, quotes: [], version: 1 };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.quotes)) {
      throw new Error('estructura inesperada');
    }
    return normalizeStore(parsed);
  } catch (err) {
    // El archivo dañado NUNCA se borra: se aparta para poder recuperarlo a mano.
    const corruptPath = path.join(DATA_DIR, 'store.corrupt-' + fileStamp() + '.json');
    try {
      fs.renameSync(STORE_PATH, corruptPath);
    } catch (renameErr) {
      console.error('No se pudo apartar store.json dañado:', renameErr.message);
    }
    console.error('store.json dañado (' + err.message + '). Copia en', corruptPath);
    if (fs.existsSync(STORE_BACKUP) && storeFileIsValid(STORE_BACKUP)) {
      storeWarning = 'El archivo de cotizaciones estaba dañado y se recuperó la copia anterior. ' +
        'El archivo dañado quedó guardado como ' + path.basename(corruptPath) + '.';
      return normalizeStore(JSON.parse(fs.readFileSync(STORE_BACKUP, 'utf8')));
    }
    storeWarning = 'El archivo de cotizaciones estaba dañado. Se guardó una copia como ' +
      path.basename(corruptPath) + ' y se inició sin historial.';
    return { parameters: {}, quotes: [], version: 1 };
  }
}

let store = readStore();
pruneExports();
// Si nunca se hizo una copia, se crea una al arrancar para no empezar desprotegido.
if (listBackups().length === 0) writeRotatingBackup('inicial');

function saveStore() {
  store.version = (store.version || 1) + 1;
  // Antes de sobrescribir se conserva la última versión válida: es el respaldo
  // que usa la recuperación automática y el botón "Restaurar copia anterior".
  if (fs.existsSync(STORE_PATH) && storeFileIsValid(STORE_PATH)) {
    try {
      fs.copyFileSync(STORE_PATH, STORE_BACKUP);
    } catch (err) {
      console.error('No se pudo guardar el respaldo de store.json:', err.message);
    }
  }
  writeJsonAtomic(STORE_PATH, store);
}

function saveCatalog() {
  makeBackup();
  writeJsonAtomic(CATALOG_PATH, catalog);
}

function currentParameters() {
  return Object.assign({}, catalog.parameters, store.parameters || {});
}

function send(res, status, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, extraHeaders || {}));
  res.end(body);
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// Modo solo lectura: se permite calcular y generar el Excel/correo, pero
// cualquier operación que escriba en disco (importar, parámetros, cotizaciones,
// referencias, copias y restauraciones) queda bloqueada. Lista blanca explícita
// para que una ruta nueva no se cuele por omisión.
function isWriteRoute(route, method) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  if (route === '/api/calculate') return false;
  if (route === '/api/email/summary' || route === '/api/email/excel' ||
      route === '/api/email/emailjs/preview') return false;
  return true;
}

// Lista blanca de autorización: toda petición que no sea de lectura requiere
// ADMIN_TOKEN. GET/HEAD/OPTIONS y /api/health (sondeo del hosting) quedan fuera.
function isAdminRoute(route, method) {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;
  if (route === '/api/health') return false;
  return true;
}

function isAuthorized(req) {
  if (!BASIC_AUTH_USER && !BASIC_AUTH_PASS) return true;
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch (_) {
    return false;
  }
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  const user = decoded.slice(0, separator);
  const pass = decoded.slice(separator + 1);
  return timingSafeEqualText(user, BASIC_AUTH_USER) && timingSafeEqualText(pass, BASIC_AUTH_PASS);
}

function applyCors(req, res) {
  if (!CORS_ORIGINS.length) return;
  const origin = String(req.headers.origin || '');
  const allowed = CORS_ORIGINS.includes('*')
    ? (origin || '*')
    : (CORS_ORIGINS.includes(origin) ? origin : '');
  if (!allowed) return;
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, X-Clear-Quotes');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Cabeceras de seguridad para todas las respuestas. El CSP permite solo el
// propio origen y los estilos en línea (la interfaz los usa). Las fuentes están
// autoalojadas en /fonts, así que no se permite ningún origen externo.
function applySecurityHeaders(res, nonce) {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'nonce-" + nonce + "'",
    "connect-src 'self' https://api.emailjs.com"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (/^https:/i.test(String(process.env.PUBLIC_BASE_URL || ''))) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

// Defensa CSRF: los navegadores no pueden falsificar el Origin ni enviar
// "application/json" sin permiso CORS; el content-type de un formulario HTML
// (text/plain, form-urlencoded, multipart) se rechaza.
function checkStateChangingRequest(req, route, method) {
  const origin = String(req.headers.origin || '');
  const referer = String(req.headers.referer || '');
  const host = String(req.headers.host || '');

  function sameSite(value) {
    if (!value) return true;
    let parsed;
    try { parsed = new URL(value); } catch (_) { return false; }
    if (parsed.host === host) return true;
    return CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(parsed.origin);
  }

  if (!sameSite(origin) || !sameSite(referer)) {
    return { status: 403, error: 'Origen no permitido' };
  }

  // DELETE no se puede falsificar desde otro sitio (siempre exige preflight),
  // así que solo se exige JSON en los métodos que llevan cuerpo.
  if (method === 'DELETE') return null;

  const type = String(req.headers['content-type'] || '').toLowerCase();
  const expected = route === '/api/import' ? 'application/octet-stream' : 'application/json';
  if (!type.startsWith(expected)) {
    return { status: 415, error: 'Tipo de contenido no permitido' };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) {
        reject(new Error('Cuerpo de solicitud demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function readRawBody(req, maxBytes) {
  const limit = maxBytes || 50 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('El archivo es demasiado grande (máximo 50 MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

function sendStaticFile(req, res, filePath) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) return send(res, 404, { error: 'No encontrado' });
    const etag = 'W/"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '"';
    const lastModified = stat.mtime.toUTCString();
    const headers = {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      // Sin esto, el navegador puede quedarse con un app.js viejo y la interfaz
      // se ve desactualizada o deja de responder (pestañas que no cambian).
      'Cache-Control': 'no-cache',
      'ETag': etag,
      'Last-Modified': lastModified
    };
    const inm = String(req.headers['if-none-match'] || '');
    const ims = String(req.headers['if-modified-since'] || '');
    const notModified = (inm && inm.split(',').map((x) => x.trim()).includes(etag))
      || (!inm && ims && Date.parse(ims) >= Math.floor(stat.mtimeMs / 1000) * 1000);
    if (notModified) {
      res.writeHead(304, headers);
      return res.end();
    }
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 404, { error: 'No encontrado' });
      res.writeHead(200, Object.assign({ 'Content-Length': data.length }, headers));
      res.end(data);
    });
  });
}

function serveStatic(req, res, pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative === '/' || relative === '') relative = '/index.html';
  if (relative === '/engine.js') {
    return sendStaticFile(req, res, path.join(__dirname, 'engine.js'));
  }
  const filePath = path.resolve(PUBLIC, '.' + relative);
  if (!filePath.startsWith(PUBLIC + path.sep) && filePath !== PUBLIC) {
    return send(res, 403, { error: 'Acceso denegado' });
  }
  return sendStaticFile(req, res, filePath);
}

function makeBackup() {
  if (fs.existsSync(CATALOG_PATH)) fs.copyFileSync(CATALOG_PATH, CATALOG_BACKUP);
  if (fs.existsSync(STORE_PATH)) fs.copyFileSync(STORE_PATH, STORE_BACKUP);
}

// ---------- Copias de seguridad completas ----------
// Una copia es un único JSON con catálogo + cotizaciones + parámetros. Se puede
// descargar, guardar en otro equipo y volver a cargar desde la interfaz.

function backupStamp() {
  return new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15).replace('T', '_');
}

function backupPayload(reason) {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    reason: reason || 'manual',
    catalog: catalog,
    store: store
  };
}

function pruneBackups() {
  try {
    const entries = fs.readdirSync(BACKUP_DIR)
      .filter((name) => /^\d{8}_\d{6}-[\w-]+\.json$/i.test(name))
      .map((name) => {
        const full = path.join(BACKUP_DIR, name);
        return { name, full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of entries.slice(BACKUP_RETENTION)) {
      fs.rmSync(old.full, { force: true });
    }
  } catch (err) {
    console.error('No se pudo ordenar las copias de seguridad:', err.message);
  }
}

function writeRotatingBackup(reason) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const safeReason = String(reason || 'manual').replace(/[^a-z0-9-]/gi, '').slice(0, 20) || 'manual';
    const name = backupStamp() + '-' + safeReason + '.json';
    writeJsonAtomic(path.join(BACKUP_DIR, name), backupPayload(reason));
    pruneBackups();
    return name;
  } catch (err) {
    console.error('No se pudo crear la copia de seguridad:', err.message);
    return null;
  }
}

function listBackups() {
  const items = [];
  try {
    for (const name of fs.readdirSync(BACKUP_DIR)) {
      if (!/^\d{8}_\d{6}-[\w-]+\.json$/i.test(name)) continue;
      const full = path.join(BACKUP_DIR, name);
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      items.push({ name, size: stat.size, createdAt: stat.mtime.toISOString() });
    }
  } catch (_) {
    return [];
  }
  return items.sort((a, b) => b.name.localeCompare(a.name));
}

// Valida un archivo de copia sin aplicarlo: es el "ensayo de restauración".
// Comprueba estructura y datos, pero no escribe nada en disco.
function validateBackup(payload) {
  const problems = [];
  if (!payload || typeof payload !== 'object') return { ok: false, problems: ['El archivo no es un JSON válido'] };
  if (payload.format !== BACKUP_FORMAT) problems.push('No es una copia del cotizador');
  const c = payload.catalog;
  const s = payload.store;
  if (!c || typeof c !== 'object' || !Array.isArray(c.operations) || !Array.isArray(c.references)) {
    problems.push('El catálogo de la copia no es válido');
  }
  if (!s || typeof s !== 'object' || !Array.isArray(s.quotes) ||
      (s.parameters && typeof s.parameters !== 'object')) {
    problems.push('Las cotizaciones de la copia no son válidas');
  }
  return {
    ok: problems.length === 0,
    problems,
    appVersion: payload.appVersion || null,
    createdAt: payload.createdAt || null,
    operations: c && Array.isArray(c.operations) ? c.operations.length : 0,
    references: c && Array.isArray(c.references) ? c.references.length : 0,
    quotes: s && Array.isArray(s.quotes) ? s.quotes.length : 0
  };
}

function applyBackup(payload) {
  makeBackup();
  writeJsonAtomic(CATALOG_PATH, payload.catalog);
  writeJsonAtomic(STORE_PATH, payload.store);
  catalog = loadCatalog();
  store = readStore();
  writeRotatingBackup('restaurado');
}

// Comprobación automática al arrancar: se leen del disco los mismos archivos
// que se usaron para cargar y se comparan las cantidades. No modifica nada.
function restoreDrill() {
  const problems = [];
  try {
    const c = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    if (!Array.isArray(c.operations) || c.operations.length !== catalog.operations.length ||
        !Array.isArray(c.references) || c.references.length !== catalog.references.length) {
      problems.push('El catálogo en disco no coincide con el cargado');
    }
  } catch (_) {
    problems.push('No se pudo leer el catálogo en disco');
  }
  try {
    if (fs.existsSync(STORE_PATH)) {
      const s = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (!Array.isArray(s.quotes) || s.quotes.length !== store.quotes.length) {
        problems.push('Las cotizaciones en disco no coinciden con las cargadas');
      }
    }
  } catch (_) {
    problems.push('No se pudo leer el archivo de cotizaciones en disco');
  }
  return { ok: problems.length === 0, problems, checkedAt: new Date().toISOString() };
}

function diskStatus() {
  try {
    if (typeof fs.statfsSync !== 'function') {
      return { available: false, reason: 'No disponible en esta versión de Node', low: false };
    }
    const stat = fs.statfsSync(DATA_DIR);
    const free = stat.bavail * stat.bsize;
    const total = stat.blocks * stat.bsize;
    return {
      available: true,
      freeMB: Math.round(free / 1024 / 1024),
      totalMB: Math.round(total / 1024 / 1024),
      freePct: total ? Math.round((free / total) * 100) : 0,
      low: free < MIN_FREE_BYTES
    };
  } catch (err) {
    return { available: false, reason: err.message, low: false };
  }
}

// Borra los Excel viejos o sobrantes de data/exports. Solo toca los archivos
// que genera el propio cotizador (historial_*.xlsx).
function pruneExports() {
  let entries;
  try {
    entries = fs.readdirSync(EXPORTS_DIR);
  } catch (_) {
    return;
  }
  const now = Date.now();
  const maxAge = EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = [];
  for (const name of entries) {
    if (!/^historial_[\d_T]+\.xlsx$/i.test(name)) continue;
    const full = path.join(EXPORTS_DIR, name);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      if (maxAge > 0 && now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(full);
        continue;
      }
      files.push({ full, mtime: stat.mtimeMs });
    } catch (_) { /* archivo en uso: se deja para la próxima */ }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  for (const item of files.slice(EXPORT_MAX_FILES)) {
    try { fs.unlinkSync(item.full); } catch (_) { /* se reintenta luego */ }
  }
}

// Límite de peticiones en memoria, por IP y por tipo de operación.
const rateBuckets = new Map();
let importRunning = false;

function clientIp(req) {
  if (TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'desconocido';
}

function rateLimit(req, bucket, max, windowMs) {
  const key = bucket + '|' + clientIp(req);
  const now = Date.now();
  let entry = rateBuckets.get(key);
  if (!entry || now - entry.start >= windowMs) {
    entry = { start: now, count: 0 };
    rateBuckets.set(key, entry);
  }
  entry.count += 1;
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (now - v.start >= windowMs) rateBuckets.delete(k);
    }
  }
  if (entry.count > max) {
    return Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000));
  }
  return 0;
}

function enforceRate(req, res, bucket, max, windowMs) {
  const retryAfter = rateLimit(req, bucket, max, windowMs);
  if (!retryAfter) return false;
  send(res, 429, {
    error: 'Demasiadas solicitudes. Espere ' + retryAfter + ' segundos y vuelva a intentar.'
  }, { 'Retry-After': String(retryAfter) });
  return true;
}

// Bitácora simple en JSON Lines. Se rota a audit.log.1 al pasar de 2 MB.
function audit(req, action, detail) {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ip: clientIp(req),
      user: TRUST_PROXY && AUDIT_USER_HEADER
        ? (String(req.headers[AUDIT_USER_HEADER] || '').trim().slice(0, 120) || null)
        : null,
      action,
      detail: detail == null ? null : detail
    }) + '\n';
    const size = fs.existsSync(AUDIT_LOG) ? fs.statSync(AUDIT_LOG).size : 0;
    if (size > 2 * 1024 * 1024) {
      try { fs.renameSync(AUDIT_LOG, AUDIT_LOG + '.1'); } catch (_) { /* sigue creciendo */ }
    }
    fs.appendFileSync(AUDIT_LOG, line, 'utf8');
  } catch (err) {
    console.error('No se pudo escribir audit.log:', err.message);
  }
}

function textField(value, label, max) {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
  if (text.length > max) {
    const err = new Error('El campo "' + label + '" supera el máximo de ' + max + ' caracteres');
    err.status = 400;
    throw err;
  }
  return text;
}

function validateQuotePayload(body) {
  if (Array.isArray(body.lines) && body.lines.length > MAX_QUOTE_LINES) {
    const err = new Error('Una cotización no puede tener más de ' + MAX_QUOTE_LINES + ' operaciones');
    err.status = 400;
    throw err;
  }
  return {
    reference: textField(body.reference, 'referencia', MAX_FIELD.code),
    description: textField(body.description, 'descripción', MAX_FIELD.description),
    type: textField(body.type, 'tipo', MAX_FIELD.type),
    marca: textField(body.marca, 'marca', MAX_FIELD.marca)
  };
}

function resetStore(clearQuotes) {
  const quotes = clearQuotes ? [] : store.quotes;
  store = { parameters: {}, quotes, version: (store.version || 1) + 1 };
  writeJsonAtomic(STORE_PATH, store);
}

function validateImportedCatalog(data) {
  if (!data || !Array.isArray(data.operations) || !Array.isArray(data.references) ||
      !data.parameters || !data.meta) {
    throw new Error('El Excel importado no tiene la estructura esperada (operaciones, referencias, parámetros)');
  }
  if (data.operations.length === 0) {
    throw new Error('El Excel importado no contiene operaciones en Base_operaciones');
  }
  engine.validateParams(Object.assign({}, data.parameters));
  return true;
}

function replaceCatalog(newCatalog, clearQuotes) {
  validateImportedCatalog(newCatalog);
  makeBackup();
  writeRotatingBackup('antes-importar');
  writeJsonAtomic(CATALOG_PATH, newCatalog);
  resetStore(clearQuotes);
  catalog = loadCatalog();
}

function emptyCatalog() {
  return {
    meta: {
      sourceFile: '(sin datos importados)',
      exportedAt: new Date().toISOString(),
      operationCount: 0,
      referenceCount: 0,
      historicalRows: 0,
      historicalBlankCodes: 0,
      historicalBlankSupplement: 0,
      historicalBlocks: {}
    },
    parameters: Object.assign({}, catalog.parameters),
    operations: [],
    references: [],
    goldenCase: null
  };
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function lanBaseUrl() {
  // En la nube (Render, Docker, etc.) los enlaces del correo deben usar la URL pública.
  if (process.env.PUBLIC_BASE_URL) return String(process.env.PUBLIC_BASE_URL).replace(/\/+$/, '');
  // Render expone la URL pública del servicio aunque falte PUBLIC_BASE_URL.
  // Sin esto el enlace del correo sale con la IP interna (10.x.x.x) e inaccesible.
  if (process.env.RENDER_EXTERNAL_URL) return String(process.env.RENDER_EXTERNAL_URL).replace(/\/+$/, '');
  if (process.env.LAN_IP) return 'http://' + process.env.LAN_IP + ':' + PORT;
  const addresses = [];
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const item of os.networkInterfaces()[name] || []) {
      // 192.168.137.1 es el hotspot de Windows, no la red de la empresa.
      if (item.family === 'IPv4' && !item.internal && item.address !== '192.168.137.1') {
        addresses.push({ name, address: item.address });
      }
    }
  }
  const lan =
    addresses.find((x) => /wi-?fi|wlan/i.test(x.name)) ||
    addresses.find((x) => /^192\.168\./.test(x.address)) ||
    addresses[0];
  return 'http://' + (lan ? lan.address : 'localhost') + ':' + PORT;
}

function round(value, decimals) {
  const n = Number(value);
  const d = decimals == null ? 2 : decimals;
  return Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
}

function localDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CO');
}

function numberText(value, decimals) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function moneyText(value) {
  return value == null || value === '' ? '—' : formatMoney(value);
}

const pctText = (value) =>
  value == null || value === '' ? '—' : numberText(Number(value) * 100, 2) + '%';

function quoteParameters(p) {
  const params = p || {};
  return {
    values: [
      params.supplementPct,
      params.costPerMinConf,
      params.costPerMinFinish,
      params.costPerMinPack,
      params.complexityFactor,
      params.profitPct,
      params.workDays,
      params.hoursPerDay,
      params.efficiency
    ],
    text: [
      'Suplemento ' + pctText(params.supplementPct),
      'Valor minuto confeccion ' + moneyText(params.costPerMinConf) + '/min',
      'Valor minuto terminacion ' + moneyText(params.costPerMinFinish) + '/min',
      'Empaque ' + moneyText(params.costPerMinPack) + '/min',
      'Complejidad ' + numberText(params.complexityFactor, 2),
      'Utilidad ' + pctText(params.profitPct),
      'Capacidad ' + numberText(params.workDays, 0) + ' días × ' +
        numberText(params.hoursPerDay, 1) + ' h',
      'Eficiencia ' + pctText(params.efficiency)
    ].join(' | ')
  };
}

function buildHistorySummary(ids) {
  const allQuotes = store.quotes;
  const selected = Array.isArray(ids) ? new Set(ids.map(String)) : null;
  const quotes = selected ? allQuotes.filter((q) => selected.has(String(q.id))) : allQuotes;
  const quoteRows = [];
  const detailRows = [];
  const byType = new Map();
  const byBrand = new Map();
  let totalSam = 0;
  let totalCost = 0;
  let totalPrice = 0;
  let minDate = null;
  let maxDate = null;

  for (const q of quotes) {
    const totals = q.result && q.result.totals ? q.result.totals : {};
    const lines = q.result && Array.isArray(q.result.lines) ? q.result.lines : [];
    const sam = Number(totals.samTotal) || 0;
    const cost = Number(totals.costoTransformacion) || 0;
    const price = Number(totals.precioSugerido) || 0;
    totalSam += sam;
    totalCost += cost;
    totalPrice += price;

    if (q.createdAt && (!minDate || q.createdAt < minDate)) minDate = q.createdAt;
    if (q.createdAt && (!maxDate || q.createdAt > maxDate)) maxDate = q.createdAt;

    const type = String(q.type || 'Sin tipo');
    const group = byType.get(type) || { count: 0, totalPrice: 0 };
    group.count += 1;
    group.totalPrice += price;
    byType.set(type, group);

    const brand = String(q.marca || '').trim() || 'Sin marca';
    const brandGroup = byBrand.get(brand) || { count: 0, totalPrice: 0 };
    brandGroup.count += 1;
    brandGroup.totalPrice += price;
    byBrand.set(brand, brandGroup);

    const params = quoteParameters(q.parameters);
    quoteRows.push([
      localDate(q.createdAt),
      String(q.reference || ''),
      String(q.description || ''),
      type,
      lines.length,
      round(totals.samConfeccion, 3),
      round(totals.samTerminacionEmpaque, 3),
      round(sam, 3),
      round(cost, 2),
      round(price, 2),
      ...params.values,
      params.text,
      brand
    ]);

    for (const line of lines) {
      detailRows.push([
        localDate(q.createdAt),
        String(q.reference || ''),
        String(line.operation || ''),
        String(line.block || ''),
        String(line.id || ''),
        Number(line.quantity) || 0,
        round(line.baseSec, 2),
        round(line.samMin, 3),
        round(line.cost, 2),
        Array.isArray(line.warnings) ? line.warnings.join('; ') : '',
        brand
      ]);
    }
  }

  const typeRows = Array.from(byType.entries())
    .map(([type, group]) => [type, group.count, round(group.totalPrice, 2)])
    .sort((a, b) => b[2] - a[2]);
  const brandRows = Array.from(byBrand.entries())
    .map(([brand, group]) => [brand, group.count, round(group.totalPrice, 2)])
    .sort((a, b) => b[2] - a[2]);

  return {
    count: quotes.length,
    selectedOnly: Array.isArray(ids),
    from: minDate ? localDate(minDate).split(',')[0] : '—',
    to: maxDate ? localDate(maxDate).split(',')[0] : '—',
    totalSam: round(totalSam, 3),
    totalCost: round(totalCost, 2),
    totalPrice: round(totalPrice, 2),
    avgPrice: quotes.length ? round(totalPrice / quotes.length, 2) : 0,
    byType: typeRows.map(([type, count, totalPrice]) => ({ type, count, totalPrice })),
    byBrand: brandRows.map(([brand, count, totalPrice]) => ({ brand, count, totalPrice })),
    quoteRows,
    detailRows
  };
}

function formatMoney(value) {
  return '$ ' + round(value, 2).toLocaleString('es-CO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

// El template de EmailJS no siempre declara UTF-8: convertir los caracteres
// no ASCII a entidades numéricas evita el signo ? dentro de un triángulo.
function emailSafe(value) {
  return String(value).replace(/[^\x00-\x7F]/g, (ch) => '&#' + ch.charCodeAt(0) + ';');
}

function buildEmailBody(summary, options) {
  const linkUrl = options && options.linkUrl ? String(options.linkUrl) : '';
  const quotes = Array.isArray(summary.quoteRows) ? summary.quoteRows : [];
  const maxQuotes = 40;
  const shownQuotes = quotes.slice(0, maxQuotes);

  const cell = (value, align, bg, bold) =>
    '<td style="padding:6px 10px;border-bottom:1px solid #e1e9e2' +
    (align ? ';text-align:' + align : '') +
    (bg ? ';background:' + bg : '') +
    (bold ? ';font-weight:700' : '') + '">' +
    escapeHtml(String(value === '' || value == null ? '—' : value)) + '</td>';

  // Una sola tabla: cada cotización con su referencia, agrupada por tipo,
  // con subtotal por tipo y total general.
  const groupMap = new Map();
  for (const q of shownQuotes) {
    const type = String(q[3] || 'Sin tipo');
    if (!groupMap.has(type)) groupMap.set(type, []);
    groupMap.get(type).push(q);
  }
  const groups = Array.from(groupMap.entries()).map(([type, rows]) => ({
    type,
    rows,
    sam: rows.reduce((s, q) => s + (Number(q[7]) || 0), 0),
    cost: rows.reduce((s, q) => s + (Number(q[8]) || 0), 0),
    price: rows.reduce((s, q) => s + (Number(q[9]) || 0), 0)
  })).sort((a, b) => b.price - a.price);

  const tableRows = groups.map((g) => {
    const header = '<tr>' +
      '<td colspan="8" style="padding:8px 10px;background:#fff4bf;color:#8a6a00;font-weight:700">' +
      escapeHtml(g.type) + ' · ' + g.rows.length +
      (g.rows.length === 1 ? ' cotización' : ' cotizaciones') + '</td></tr>';
    const detail = g.rows.map((q) =>
      '<tr>' +
      cell(q[1]) + cell(q[2]) + cell(q[3]) + cell(q[20]) +
      cell(q[4], 'right') +
      cell(round(q[7], 3), 'right') +
      cell(formatMoney(q[8]), 'right') +
      cell(formatMoney(q[9]), 'right') +
      '</tr>'
    ).join('');
    const subtotal = '<tr>' +
      cell('Subtotal ' + g.type, null, '#f8f6f0', true).replace('<td ', '<td colspan="5" ') +
      cell(round(g.sam, 3), 'right', '#f8f6f0', true) +
      cell(formatMoney(g.cost), 'right', '#f8f6f0', true) +
      cell(formatMoney(g.price), 'right', '#f8f6f0', true) +
      '</tr>';
    return header + detail + subtotal;
  }).join('');

  const totalRow = quotes.length
    ? '<tr>' +
      cell('TOTAL · ' + summary.count + (summary.count === 1 ? ' cotización' : ' cotizaciones'),
        null, '#eaf4ed', true).replace('<td ', '<td colspan="5" ') +
      cell(summary.totalSam, 'right', '#eaf4ed', true) +
      cell(formatMoney(summary.totalCost), 'right', '#eaf4ed', true) +
      cell(formatMoney(summary.totalPrice), 'right', '#eaf4ed', true) +
      '</tr>'
    : '';
  const quotesHidden = quotes.length > shownQuotes.length
    ? '<p style="color:#8a6a00;font-size:12px;margin:6px 0 0">Y ' + (quotes.length - shownQuotes.length) +
      ' cotizaciones más con su referencia en el Excel.</p>'
    : '';
  const detailBlock = quotes.length
    ? '<h3 style="color:#8a6a00;font-size:14px;margin:18px 0 8px">Detalle de cotizaciones</h3>' +
      '<table style="border-collapse:collapse;width:100%;font-size:12px">' +
      '<thead><tr style="background:#2d4036;color:#fff">' +
      '<th style="padding:8px 10px;text-align:left">Referencia</th>' +
      '<th style="padding:8px 10px;text-align:left">Descripción</th>' +
      '<th style="padding:8px 10px;text-align:left">Tipo</th>' +
      '<th style="padding:8px 10px;text-align:left">Marca</th>' +
      '<th style="padding:8px 10px;text-align:right">Ops.</th>' +
      '<th style="padding:8px 10px;text-align:right">SAM (min)</th>' +
      '<th style="padding:8px 10px;text-align:right">Costo</th>' +
      '<th style="padding:8px 10px;text-align:right">Precio sugerido</th></tr></thead>' +
      '<tbody>' + tableRows + totalRow + '</tbody></table>' + quotesHidden
    : '';
  const brandSummary = Array.isArray(summary.byBrand) && summary.byBrand.length
    ? '<p style="margin:0 0 8px"><strong>Marcas:</strong> ' +
      summary.byBrand.map((b) => escapeHtml(b.brand) + ' (' + b.count + ')').join(' · ') + '</p>'
    : '';

  const kpi = (label, value) =>
    '<td style="padding:12px;background:#f8f6f0;border:1px solid #e1e9e2;border-radius:8px">' +
    '<div style="font-size:11px;color:#536258;text-transform:uppercase">' + label + '</div>' +
    '<div style="font-size:16px;font-weight:700;color:#171717">' + value + '</div></td>';

  const intro = linkUrl
    ? 'Generado automáticamente por el Cotizador Web. Para obtener el Excel, abre el botón siguiente y pulsa «Descargar Excel» en la página que se abre.'
    : 'Generado automáticamente por el Cotizador Web. El detalle completo se adjunta en el archivo Excel.';
  const linkBlock = linkUrl
    ? '<p style="margin:20px 0 8px"><a href="' + escapeHtml(linkUrl) + '" ' +
      'style="background:#f2c400;color:#171717;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:700">' +
      'Abrir descarga del Excel</a></p>' +
      '<p style="color:#536258;font-size:12px;word-break:break-all">Si el botón no funciona, copia este enlace y ábrelo en el navegador: ' +
      escapeHtml(linkUrl) + '</p>'
    : '';
  const footer = linkUrl
    ? 'El enlace estará disponible mientras el servicio del cotizador esté en línea.'
    : 'Adjunto: historial de cotizaciones en formato Excel (resumen, cotizaciones y detalle de operaciones).';

  return emailSafe('<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:20px;font-family:Segoe UI,Arial,sans-serif;color:#171717">' +
    '<h2 style="color:#8a6a00;margin:0 0 6px">' +
    (summary.selectedOnly ? 'Cotizaciones seleccionadas' : 'Historial de cotizaciones') + '</h2>' +
    '<p style="color:#536258;margin:0 0 18px">' + intro + '</p>' +
    '<table style="border-collapse:separate;border-spacing:8px 0;margin-bottom:20px"><tr>' +
    kpi('Cotizaciones', summary.count) +
    kpi('SAM total', summary.totalSam + ' min') +
    kpi('Costo total', formatMoney(summary.totalCost)) +
    kpi('Precio sugerido', formatMoney(summary.totalPrice)) +
    '</tr></table>' +
    '<p style="margin:0 0 8px"><strong>Período:</strong> ' + escapeHtml(summary.from) + ' al ' + escapeHtml(summary.to) +
    ' &nbsp;·&nbsp; <strong>Precio sugerido promedio:</strong> ' + formatMoney(summary.avgPrice) + '</p>' +
    brandSummary +
    detailBlock +
    linkBlock +
    '<p style="color:#536258;font-size:12px;margin-top:20px">' + footer + '</p>' +
    '</body></html>');
}

const EXCEL_MONEY = '#,##0.00';
const EXCEL_PERCENT = '0%';

function fillExcelRow(ws, rowNumber, values, options) {
  const opts = options || {};
  values.forEach((value, index) => {
    const cell = ws.getCell(rowNumber, index + 1);
    cell.value = value == null ? null : value;
    if (opts.bold) cell.font = { bold: true };
    if (opts.numFmts && opts.numFmts[index]) cell.numFmt = opts.numFmts[index];
  });
}

function autoWidth(ws, minWidth, maxWidth) {
  ws.columns.forEach((column) => {
    let width = minWidth;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const text = cell.value == null ? '' : String(cell.value);
      if (text.length > width) width = text.length;
    });
    column.width = Math.min(width + 2, maxWidth);
  });
}

// Genera el Excel en Node puro (sin PowerShell ni Excel instalado) para que
// funcione igual en Windows, Linux, Docker y Render.
async function generateHistoryExcel(providedSummary) {
  const summary = providedSummary || buildHistorySummary();
  const generatedAt = new Date().toISOString();
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  pruneExports();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '_');
  const suffix = String(Date.now() % 1000).padStart(3, '0');
  const fileName = 'historial_' + stamp + '_' + suffix + '.xlsx';
  const outPath = path.join(EXPORTS_DIR, fileName);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cotizador de Muestras';
  workbook.created = new Date();

  // ---------- Hoja 1: Resumen ----------
  const ws1 = workbook.addWorksheet('Resumen');
  ws1.getCell('A1').value = 'HISTORIAL DE COTIZACIONES';
  ws1.getCell('A1').font = { bold: true, size: 14 };

  const summaryRows = [
    ['Generado', localDate(generatedAt), null],
    ['Cotizaciones', summary.count, '0'],
    ['Desde', summary.from, null],
    ['Hasta', summary.to, null],
    ['SAM total (min)', summary.totalSam, '0.000'],
    ['Costo total', summary.totalCost, EXCEL_MONEY],
    ['Precio sugerido total', summary.totalPrice, EXCEL_MONEY],
    ['Precio sugerido promedio', summary.avgPrice, EXCEL_MONEY]
  ];
  let r = 3;
  for (const [label, value, numFmt] of summaryRows) {
    const labelCell = ws1.getCell(r, 1);
    labelCell.value = label;
    labelCell.font = { bold: true };
    const valueCell = ws1.getCell(r, 2);
    valueCell.value = value == null ? null : value;
    if (numFmt) valueCell.numFmt = numFmt;
    r++;
  }

  r++;
  ws1.getCell(r, 1).value = 'Por tipo de prenda';
  ws1.getCell(r, 1).font = { bold: true };
  r++;
  ['Tipo', 'Cotizaciones', 'Precio sugerido'].forEach((value, index) => {
    const cell = ws1.getCell(r, index + 1);
    cell.value = value;
    cell.font = { bold: true };
  });
  r++;
  for (const item of summary.byType) {
    fillExcelRow(ws1, r, [item.type, item.count, item.totalPrice], { numFmts: [null, '0', EXCEL_MONEY] });
    r++;
  }

  r++;
  ws1.getCell(r, 1).value = 'Por marca';
  ws1.getCell(r, 1).font = { bold: true };
  r++;
  ['Marca', 'Cotizaciones', 'Precio sugerido'].forEach((value, index) => {
    const cell = ws1.getCell(r, index + 1);
    cell.value = value;
    cell.font = { bold: true };
  });
  r++;
  for (const item of summary.byBrand) {
    fillExcelRow(ws1, r, [item.brand, item.count, item.totalPrice], { numFmts: [null, '0', EXCEL_MONEY] });
    r++;
  }
  autoWidth(ws1, 12, 50);

  // ---------- Hoja 2: Cotizaciones ----------
  const ws2 = workbook.addWorksheet('Cotizaciones');
  const headers2 = ['Fecha', 'Referencia', 'Descripción', 'Tipo', 'Operaciones',
    'SAM conf.', 'SAM term.+emp.', 'SAM total', 'Costo', 'Precio sugerido',
    'Suplemento (%)', 'Valor minuto confeccion', 'Valor minuto terminacion',
    'Costo empaque ($/min)', 'Factor complejidad', 'Utilidad (%)',
    'Días hábiles/mes', 'Horas/jornada', 'Eficiencia (%)', 'Parámetros usados', 'Marca'];
  fillExcelRow(ws2, 1, headers2, { bold: true });
  const formats2 = [null, null, null, null, '0', '0.000', '0.000', '0.000',
    EXCEL_MONEY, EXCEL_MONEY, EXCEL_PERCENT, EXCEL_MONEY, EXCEL_MONEY, EXCEL_MONEY,
    '0.00', EXCEL_PERCENT, '0', '0.0', EXCEL_PERCENT, null, null];
  summary.quoteRows.forEach((row, index) => {
    fillExcelRow(ws2, index + 2, row, { numFmts: formats2 });
  });
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  autoWidth(ws2, 10, 60);

  // ---------- Hoja 3: Detalle operaciones ----------
  const ws3 = workbook.addWorksheet('Detalle operaciones');
  const headers3 = ['Fecha', 'Referencia', 'Operación', 'Bloque', 'ID', 'Cantidad',
    'Base (s)', 'SAM (min)', 'Costo', 'Alertas', 'Marca'];
  fillExcelRow(ws3, 1, headers3, { bold: true });
  const formats3 = [null, null, null, null, null, '0', '0.00', '0.000', EXCEL_MONEY, null, null];
  summary.detailRows.forEach((row, index) => {
    fillExcelRow(ws3, index + 2, row, { numFmts: formats3 });
  });
  ws3.views = [{ state: 'frozen', ySplit: 1 }];
  autoWidth(ws3, 10, 60);

  await workbook.xlsx.writeFile(outPath);
  return { fileName, outPath, summary };
}

// Estado real del servicio: no basta con que el proceso esté vivo; tiene que
// poder escribir en la carpeta de datos y tener el catálogo y el store legibles.
function checkHealth() {
  const problems = [];
  let dataDirWritable = false;
  try {
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    dataDirWritable = true;
  } catch (_) {
    problems.push('No se puede escribir en la carpeta de datos');
  }

  const catalogLoaded = !!(catalog && catalog.operations.length && catalog.references.length);
  if (!catalogLoaded) problems.push('El catálogo no está cargado');

  let storeLoaded = false;
  try {
    storeLoaded = Array.isArray(JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')).quotes);
  } catch (_) {
    // El archivo se crea al guardar la primera cotización: eso no es un error.
    storeLoaded = !fs.existsSync(STORE_PATH) && Array.isArray(store.quotes);
  }
  if (!storeLoaded) problems.push('No se pudo leer el archivo de cotizaciones');

  const disk = diskStatus();
  if (disk.low) problems.push('Queda poco espacio libre en el disco');

  return {
    ok: problems.length === 0,
    degraded: !!storeWarning,
    version: APP_VERSION,
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    operations: catalog.operations.length,
    references: catalog.references.length,
    quotes: store.quotes.length,
    dataDirWritable,
    catalogLoaded,
    storeLoaded,
    disk,
    warning: storeWarning || null,
    problems
  };
}

async function handleApi(req, res, url) {
  const route = url.pathname;
  const method = req.method;

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const rejection = checkStateChangingRequest(req, route, method);
    if (rejection) return send(res, rejection.status, { error: rejection.error });
  }

  if (READ_ONLY && isWriteRoute(route, method)) {
    return send(res, 503, { error: 'La aplicación está en modo solo lectura. No se pueden guardar cambios.' });
  }

  if (ADMIN_TOKEN && isAdminRoute(route, method) &&
      !timingSafeEqualText(String(req.headers['x-admin-token'] || ''), ADMIN_TOKEN)) {
    return send(res, 401, { error: 'Se requiere la clave de administrador para esta acción.' });
  }

  if (route === '/api/health' && method === 'GET') {
    const health = checkHealth();
    return send(res, health.ok ? 200 : 503, health);
  }

  if (route === '/api/import' && method === 'POST') {
    // La importación usa Excel COM en Windows. En Linux/Render se reemplaza
    // data/catalog.json por el catálogo ya exportado.
    if (process.platform !== 'win32') {
      return send(res, 501, {
        error: 'La importación desde Excel solo está disponible en Windows. En este entorno, reemplace el archivo data/catalog.json con el catálogo ya exportado.'
      });
    }
    if (enforceRate(req, res, 'import', 5, 10 * 60 * 1000)) return;
    if (importRunning) {
      return send(res, 409, { error: 'Ya hay una importación en curso. Espere a que termine.' });
    }
    const fileName = path.basename(String(url.searchParams.get('filename') || 'importado.xlsx'));
    if (!/\.xlsx$/i.test(fileName)) {
      return send(res, 400, { error: 'Solo se admiten archivos .xlsx (sin macros)' });
    }
    const clearQuotes = String(req.headers['x-clear-quotes'] || '1') === '1';
    const bytes = await readRawBody(req);
    if (!bytes.length) return send(res, 400, { error: 'No se recibió ningún archivo' });
    // Un .xlsx es un ZIP: firma "PK" y entradas obligatorias. Se rechaza
    // vbaProject.bin para no abrir nunca un libro con macros en el equipo Windows.
    const contains = (text) => bytes.indexOf(Buffer.from(text, 'latin1')) >= 0;
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b ||
        !contains('[Content_Types].xml') || !contains('xl/workbook.xml') ||
        contains('xl/vbaProject.bin')) {
      return send(res, 400, { error: 'El archivo recibido no es un Excel .xlsx válido o contiene macros' });
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotizador-import-'));
    importRunning = true;
    const tmpXlsm = path.join(tmpDir, fileName);
    const tmpJson = path.join(tmpDir, 'catalog.json');
    try {
      fs.writeFileSync(tmpXlsm, bytes);
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', EXPORT_SCRIPT,
        '-Source', tmpXlsm, '-Out', tmpJson
      ], { maxBuffer: 10 * 1024 * 1024, timeout: 180000 });
      const imported = JSON.parse(fs.readFileSync(tmpJson, 'utf8'));
      imported.meta.sourceFile = fileName;
      replaceCatalog(imported, clearQuotes);
      audit(req, 'catalog.import', {
        file: fileName,
        operations: imported.operations.length,
        references: imported.references.length,
        quotesCleared: clearQuotes
      });
      return send(res, 200, {
        ok: true,
        message: String(stdout || 'Importación completada').trim(),
        sourceFile: fileName,
        operations: imported.operations.length,
        references: imported.references.length,
        quotesCleared: clearQuotes
      });
    } catch (err) {
      const detail = String(err.stderr || '').trim();
      console.error('Error al importar Excel:', err.message, detail);
      // Los errores de PowerShell incluyen rutas internas: no se envían al cliente.
      const safeMessage = err.stderr
        ? 'No se pudo leer el Excel. Verifique que el archivo no esté dañado, protegido con contraseña o abierto en otro programa.'
        : (err.message || 'No se pudo importar el Excel');
      return send(res, 400, { error: safeMessage });
    } finally {
      importRunning = false;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  if (route === '/api/import/clear' && method === 'POST') {
    const body = await readBody(req).catch(() => ({}));
    const clearQuotes = body.clearQuotes !== false;
    makeBackup();
    writeRotatingBackup('antes-limpiar');
    const next = emptyCatalog();
    writeJsonAtomic(CATALOG_PATH, next);
    resetStore(clearQuotes);
    catalog = loadCatalog();
    audit(req, 'catalog.clear', { quotesCleared: clearQuotes });
    return send(res, 200, { ok: true, operations: 0, references: 0, quotesCleared: clearQuotes });
  }

  if (route === '/api/import/restore' && method === 'POST') {
    if (enforceRate(req, res, 'restore', 5, 10 * 60 * 1000)) return;
    if (!fs.existsSync(CATALOG_BACKUP)) {
      return send(res, 400, { error: 'No hay una copia anterior para restaurar' });
    }
    writeRotatingBackup('antes-restaurar');
    if (fs.existsSync(CATALOG_PATH)) fs.copyFileSync(CATALOG_PATH, CATALOG_PATH + '.pre-restore');
    if (fs.existsSync(STORE_PATH)) fs.copyFileSync(STORE_PATH, STORE_PATH + '.pre-restore');
    fs.copyFileSync(CATALOG_BACKUP, CATALOG_PATH);
    if (fs.existsSync(STORE_BACKUP)) fs.copyFileSync(STORE_BACKUP, STORE_PATH);
    catalog = loadCatalog();
    store = readStore();
    audit(req, 'catalog.restore', {
      operations: catalog.operations.length,
      references: catalog.references.length
    });
    return send(res, 200, { ok: true, operations: catalog.operations.length, references: catalog.references.length });
  }

  // ---------- Copias de seguridad ----------
  if (route === '/api/backup/status' && method === 'GET') {
    return send(res, 200, {
      backups: listBackups(),
      retention: BACKUP_RETENTION,
      minFreeMB: Math.round(MIN_FREE_BYTES / 1024 / 1024),
      disk: diskStatus(),
      drill: restoreDrill(),
      current: {
        operations: catalog.operations.length,
        references: catalog.references.length,
        quotes: store.quotes.length
      }
    });
  }

  if (route === '/api/backup/download' && method === 'GET') {
    const name = 'cotizador-respaldo-' + backupStamp() + '.json';
    return send(res, 200, backupPayload('descarga'), {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + name + '"'
    });
  }

  if (route === '/api/backup/create' && method === 'POST') {
    if (enforceRate(req, res, 'backup', 10, 10 * 60 * 1000)) return;
    const name = writeRotatingBackup('manual');
    if (!name) return send(res, 500, { error: 'No se pudo crear la copia de seguridad' });
    audit(req, 'backup.create', { name });
    return send(res, 200, { ok: true, name, backups: listBackups() });
  }

  if (route === '/api/backup/verify' && method === 'POST') {
    const payload = await readBody(req);
    const result = validateBackup(payload);
    return send(res, result.ok ? 200 : 400, result);
  }

  if (route === '/api/backup/restore' && method === 'POST') {
    if (enforceRate(req, res, 'backup', 10, 10 * 60 * 1000)) return;
    const payload = await readBody(req);
    const check = validateBackup(payload);
    if (!check.ok) return send(res, 400, { error: 'La copia no es válida: ' + check.problems.join(' ') });
    applyBackup(payload);
    audit(req, 'backup.restore', {
      operations: catalog.operations.length,
      references: catalog.references.length,
      quotes: check.quotes
    });
    return send(res, 200, {
      ok: true,
      operations: catalog.operations.length,
      references: catalog.references.length,
      quotes: store.quotes.length
    });
  }

  if (route === '/api/bootstrap' && method === 'GET') {
    return send(res, 200, {
      meta: catalog.meta,
      importInfo: {
        catalogBackup: fs.existsSync(CATALOG_BACKUP),
        storeBackup: fs.existsSync(STORE_BACKUP)
      },
      warning: storeWarning || null,
      version: APP_VERSION,
      readOnly: READ_ONLY,
      adminTokenRequired: !!ADMIN_TOKEN,
      parameters: currentParameters(),
      operations: catalog.operations,
      references: catalog.references,
      quotes: store.quotes.map((q) => ({
        id: q.id,
        createdAt: q.createdAt,
        reference: q.reference,
        description: q.description,
        type: q.type,
        marca: q.marca || '',
        totalSam: q.result && q.result.totals ? q.result.totals.samTotal : 0,
        totalCost: q.result && q.result.totals ? q.result.totals.costoTransformacion : 0,
        suggestedPrice: q.result && q.result.totals ? q.result.totals.precioSugerido : 0,
        lines: q.lines ? q.lines.length : 0
      }))
    });
  }

  if (route === '/api/parameters' && method === 'GET') {
    return send(res, 200, currentParameters());
  }

  if (route === '/api/parameters' && method === 'PUT') {
    const body = await readBody(req);
    // Solo se aceptan las claves conocidas para no guardar campos basura.
    const patch = {};
    for (const key of PARAM_KEYS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
    }
    const merged = Object.assign({}, currentParameters(), patch);
    try {
      engine.validateParams(merged);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
    store.parameters = Object.assign({}, store.parameters, patch);
    saveStore();
    audit(req, 'parameters.update', { keys: Object.keys(patch) });
    return send(res, 200, currentParameters());
  }

  if (route === '/api/calculate' && method === 'POST') {
    const body = await readBody(req);
    if (Array.isArray(body.lines) && body.lines.length > MAX_QUOTE_LINES) {
      return send(res, 400, { error: 'Una cotización no puede tener más de ' + MAX_QUOTE_LINES + ' operaciones' });
    }
    try {
      const result = engine.calculateQuote(body.lines || [], currentParameters(), catalog.operations, {
        reference: body.reference
      });
      return send(res, 200, result);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
  }

  if (route === '/api/quotes' && method === 'GET') {
    return send(res, 200, store.quotes);
  }

  if (route === '/api/quotes' && method === 'POST') {
    const body = await readBody(req);
    let fields;
    try {
      fields = validateQuotePayload(body);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
    if (store.quotes.length >= MAX_QUOTES) {
      return send(res, 400, {
        error: 'El historial alcanzó el máximo de ' + MAX_QUOTES + ' cotizaciones. Elimine las que ya no use.'
      });
    }
    // El cálculo SIEMPRE se hace en el servidor: no se acepta un resultado
    // enviado por el cliente (podría traer precios manipulados).
    let result;
    try {
      result = engine.calculateQuote(body.lines || [], currentParameters(), catalog.operations, {
        reference: fields.reference
      });
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
    const quote = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reference: fields.reference,
      description: fields.description,
      type: fields.type,
      marca: fields.marca,
      parameters: currentParameters(),
      lines: result.lines,
      result
    };
    store.quotes.unshift(quote);
    saveStore();
    audit(req, 'quote.create', {
      id: quote.id,
      reference: quote.reference,
      marca: quote.marca,
      price: result.totals ? result.totals.precioSugerido : null
    });
    return send(res, 201, quote);
  }

  const quoteMatch = route.match(/^\/api\/quotes\/([^/]+)$/);
  if (quoteMatch) {
    const quote = store.quotes.find((q) => q.id === quoteMatch[1]);
    if (!quote) return send(res, 404, { error: 'Cotización no encontrada' });
    if (method === 'GET') return send(res, 200, quote);
    if (method === 'DELETE') {
      store.quotes = store.quotes.filter((q) => q.id !== quote.id);
      saveStore();
      audit(req, 'quote.delete', { id: quote.id, reference: quote.reference });
      return send(res, 200, { ok: true });
    }
  }

  if (route === '/api/email/summary' && (method === 'GET' || method === 'POST')) {
    let ids = null;
    if (method === 'POST') {
      const body = await readBody(req);
      ids = Array.isArray(body.ids) ? body.ids : null;
    } else {
      const raw = url.searchParams.get('ids');
      if (raw != null) ids = raw.split(',').filter(Boolean);
    }
    return send(res, 200, buildHistorySummary(ids));
  }

  if (route === '/api/email/excel' && method === 'POST') {
    if (enforceRate(req, res, 'excel', 12, 5 * 60 * 1000)) return;
    try {
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids : null;
      const summary = buildHistorySummary(ids);
      if (summary.count === 0) {
        return send(res, 400, { error: 'Seleccione al menos una cotización para generar el Excel.' });
      }
      const generated = await generateHistoryExcel(summary);
      return send(res, 200, {
        ok: true,
        fileName: generated.fileName,
        url: '/api/email/download?file=' + encodeURIComponent(generated.fileName),
        count: generated.summary.count
      });
    } catch (err) {
      console.error('Error al generar Excel:', err.message);
      return send(res, 500, { error: 'No se pudo generar el Excel. Intente de nuevo.' });
    }
  }

  // La página intermedia evita que Chrome bloquee la descarga directa por HTTP.
  // El navegador descarga el archivo como Blob, sin instalar certificados.
  if (route === '/api/email/download' && method === 'GET') {
    const name = path.basename(String(url.searchParams.get('file') || ''));
    if (!/^historial_[\d_T]+\.xlsx$/i.test(name)) {
      return send(res, 400, { error: 'Nombre de archivo inválido' });
    }
    if (!fs.existsSync(path.join(EXPORTS_DIR, name))) {
      return send(res, 404, { error: 'El archivo ya no existe' });
    }
    const jsName = JSON.stringify(name);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Descargar Excel del historial</title><style>' +
      'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f0f7fa;' +
      'font-family:"Segoe UI",Arial,sans-serif;color:#171717;padding:20px}' +
      '.card{background:#f8f6f0;border:1px solid #e1e9e2;border-radius:14px;padding:28px;' +
      'max-width:460px;width:100%;box-shadow:0 8px 30px rgba(24,37,29,.08)}' +
      'h1{color:#8a6a00;font-size:20px;margin:0 0 10px}' +
      'p{color:#536258;font-size:13px;margin:0 0 18px;word-break:break-all}' +
      'button{background:#f2c400;color:#171717;border:0;border-radius:8px;padding:12px 18px;' +
      'font-size:15px;font-weight:700;cursor:pointer;width:100%}' +
      'button:hover{background:#dfb500}button:disabled{opacity:.6;cursor:wait}' +
      '#msg{margin:14px 0 0;font-size:12px;min-height:16px}' +
      '</style></head><body><div class="card">' +
      '<h1>Descargar historial de cotizaciones</h1>' +
      '<p>Archivo: <strong>' + name + '</strong></p>' +
      '<button id="btn" type="button">Descargar Excel</button>' +
      '<p id="msg"></p></div><script nonce="' + res.cspNonce + '">' +
      'var nombre = ' + jsName + ';' +
      'document.getElementById("btn").addEventListener("click", async function () {' +
      '  var btn = this; btn.disabled = true;' +
      '  document.getElementById("msg").textContent = "Preparando el archivo...";' +
      '  try {' +
      '    var r = await fetch("/api/email/download/file?file=" + encodeURIComponent(nombre));' +
      '    if (!r.ok) throw new Error("HTTP " + r.status);' +
      '    var blob = await r.blob();' +
      '    var a = document.createElement("a");' +
      '    a.href = URL.createObjectURL(blob);' +
      '    a.download = nombre;' +
      '    document.body.appendChild(a); a.click(); a.remove();' +
      '    document.getElementById("msg").textContent = "Descarga iniciada.";' +
      '  } catch (e) {' +
      '    document.getElementById("msg").textContent = "No se pudo descargar: " + e.message;' +
      '  } finally { btn.disabled = false; }' +
      '});</script></body></html>');
  }

  if (route === '/api/email/download/file' && method === 'GET') {
    const name = path.basename(String(url.searchParams.get('file') || ''));
    if (!/^historial_[\d_T]+\.xlsx$/i.test(name)) {
      return send(res, 400, { error: 'Nombre de archivo inválido' });
    }
    const filePath = path.join(EXPORTS_DIR, name);
    if (!fs.existsSync(filePath)) {
      return send(res, 404, { error: 'El archivo ya no existe' });
    }
    res.writeHead(200, {
      'Content-Type': MIME['.xlsx'],
      'Content-Disposition': 'attachment; filename="' + name + '"',
      'Content-Length': fs.statSync(filePath).size,
      'X-Content-Type-Options': 'nosniff'
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  if (route === '/api/email/emailjs/preview' && method === 'POST') {
    if (enforceRate(req, res, 'excel', 12, 5 * 60 * 1000)) return;
    const body = await readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids : null;
    const summary = buildHistorySummary(ids);
    if (summary.count === 0) {
      return send(res, 400, { error: 'Seleccione al menos una cotización para enviar.' });
    }
    try {
      const generated = await generateHistoryExcel(summary);
      const downloadUrl = lanBaseUrl() + '/api/email/download?file=' + encodeURIComponent(generated.fileName);
      return send(res, 200, {
        ok: true,
        fileName: generated.fileName,
        downloadUrl,
        message: buildEmailBody(summary, { linkUrl: downloadUrl }),
        count: summary.count
      });
    } catch (err) {
      console.error('Error al preparar el correo:', err.message);
      return send(res, 500, { error: 'No se pudo preparar el correo. Intente de nuevo.' });
    }
  }

  if (route === '/api/references' && method === 'GET') {
    return send(res, 200, catalog.references);
  }

  const referenceMatch = route.match(/^\/api\/references\/([^/]+)$/);
  if (referenceMatch && method === 'PUT') {
    const code = decodeURIComponent(referenceMatch[1]);
    const ref = catalog.references.find((r) => String(r.code) === code);
    if (!ref) return send(res, 404, { error: 'Referencia no encontrada' });
    const body = await readBody(req);
    let marca;
    try {
      marca = textField(body.marca, 'marca', MAX_FIELD.marca);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
    ref.marca = marca;
    saveCatalog();
    audit(req, 'reference.brand', { code, marca });
    return send(res, 200, { ok: true, code, marca: ref.marca });
  }

  return send(res, 404, { error: 'Ruta no encontrada' });
}

const server = http.createServer(async (req, res) => {
  try {
    const cspNonce = crypto.randomBytes(16).toString('base64');
    res.cspNonce = cspNonce;
    applySecurityHeaders(res, cspNonce);
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    // El health check de Render no envía credenciales. Se excluye solo esta
    // lectura de la autenticación para que el semáforo del hosting funcione.
    const isHealthProbe = url.pathname === '/api/health' &&
      (req.method === 'GET' || req.method === 'HEAD');
    if (!isHealthProbe && !isAuthorized(req)) {
      // Bloqueo temporal tras varios intentos fallidos (fuerza bruta).
      const retryAfter = rateLimit(req, 'login', 20, 15 * 60 * 1000);
      if (retryAfter) {
        return send(res, 429, {
          error: 'Demasiados intentos de acceso. Espere ' + retryAfter + ' segundos y vuelva a intentar.'
        }, { 'Retry-After': String(retryAfter) });
      }
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Cotizador", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end('Autenticación requerida');
    }
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, { error: 'Método no permitido' });
    }
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    // No se exponen rutas internas ni mensajes del sistema al cliente.
    if (!res.headersSent) return send(res, 500, { error: 'Error interno del servidor' });
    res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log('========================================');
  console.log(` COTIZADOR WEB v${APP_VERSION}`);
  console.log('========================================');
  console.log(` URL local:      http://localhost:${PORT}`);
  console.log(` URL en red:     ${lanBaseUrl()}`);
  console.log(` Escuchando en:  ${HOST}:${PORT}`);
  console.log(` Datos en:       ${DATA_DIR}`);
  console.log(` Autenticación:  ${BASIC_AUTH_USER ? 'básica activa' : 'sin contraseña (la pone otra app)'}`);
  console.log(` Modo:           ${READ_ONLY ? 'SOLO LECTURA' : 'lectura y escritura'}`);
  console.log(` Clave admin:    ${ADMIN_TOKEN ? 'requerida para acciones peligrosas' : 'no configurada'}`);
  console.log(` Catálogo:       ${catalog.operations.length} operaciones / ${catalog.references.length} referencias`);
  console.log(` Cotizaciones:   ${store.quotes.length}`);
  console.log(` CORS:           ${CORS_ORIGINS.length ? CORS_ORIGINS.join(', ') : 'desactivado'}`);
  console.log(` Excel:          máx. ${EXPORT_MAX_FILES} archivos / ${EXPORT_RETENTION_DAYS} días`);
  console.log(` Copias:         ${listBackups().length} / ${BACKUP_RETENTION} en ${BACKUP_DIR}`);
  const disk = diskStatus();
  console.log(` Disco:          ${disk.available ? disk.freeMB + ' MB libres de ' + disk.totalMB + ' MB' : 'no disponible'}${disk.low ? ' (POCO ESPACIO)' : ''}`);
  const drill = restoreDrill();
  console.log(` Ensayo restore: ${drill.ok ? 'OK' : 'FALLÓ: ' + drill.problems.join('; ')}`);
  if (storeWarning) console.log(` AVISO:          ${storeWarning}`);
  if (!process.env.PUBLIC_BASE_URL && !process.env.RENDER_EXTERNAL_URL) {
    console.log(' AVISO:          Falta PUBLIC_BASE_URL; los enlaces del correo usarán una dirección interna.');
  }
  console.log(' Para detener:   Ctrl + C');
  console.log('========================================');
});

// Apagado ordenado: se deja de aceptar peticiones nuevas y se espera a que
// terminen las que ya estaban en curso. Los datos se escriben en disco en cada
// cambio, así que al cerrar no queda nada pendiente de guardar.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[${new Date().toISOString()}] Apagado ordenado solicitado (${signal}).`);
  const finish = (code) => {
    console.log(`[${new Date().toISOString()}] Cotizador detenido. Datos guardados en ${DATA_DIR}.`);
    process.exit(code);
  };
  const forceTimer = setTimeout(() => {
    console.error('Hay conexiones que no cerraron a tiempo; se fuerza el apagado.');
    finish(1);
  }, 10000);
  forceTimer.unref();
  server.close(() => {
    clearTimeout(forceTimer);
    finish(0);
  });
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
