import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viteCli = resolve(projectRoot, 'node_modules/vite/bin/vite.js');
const auditoriasViteCli = resolve(projectRoot, 'apps/auditorias/node_modules/vite/bin/vite.js');
const tallasViteCli = resolve(projectRoot, 'apps/tallas/node_modules/vite/bin/vite.js');
const telasViteCli = resolve(projectRoot, 'apps/telas/node_modules/vite/bin/vite.js');
const panelPort = Number(process.env.PANEL_PORT) || 5173;
const children = [];
let stopping = false;

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32' && child.pid) {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.unref();
    } else if (!child.killed) {
      child.kill();
    }
  }
  setTimeout(() => process.exit(exitCode), 150);
}

function start(label, cli, cwd, args = [], waitUntilReady = false) {
  let panelPortInUse = false;
  let resolveReady;
  let rejectReady;
  let ready = false;
  const readyPromise = waitUntilReady
    ? new Promise((resolveReadyPromise, rejectReadyPromise) => {
        resolveReady = resolveReadyPromise;
        rejectReady = rejectReadyPromise;
      })
    : null;
  const child = spawn(process.execPath, [cli, ...args], {
    cwd,
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true,
  });
  children.push(child);

  for (const [stream, output] of [['stdout', process.stdout], ['stderr', process.stderr]]) {
    child[stream].on('data', (chunk) => {
      const message = chunk.toString();
      if (label === 'panel' && new RegExp(`Port ${panelPort} is already in use`, 'i').test(message)) {
        panelPortInUse = true;
      }
      if (readyPromise && !ready && /\bready in\b/i.test(message)) {
        ready = true;
        resolveReady();
      }
      for (const line of message.split(/(?<=\n)/)) {
        if (line) output.write(`[${label}] ${line}`);
      }
    });
  }

  child.on('error', (error) => {
    if (readyPromise && !ready) rejectReady(error);
    console.error(`[${label}] No se pudo iniciar Vite:`, error.message);
    stopAll(1);
  });
  child.on('exit', (code) => {
    if (readyPromise && !ready) rejectReady(new Error(`${label} terminÃ³ antes de quedar listo.`));
    if (!stopping) {
      if (label === 'panel' && panelPortInUse) {
        console.log(`[panel] Ya hay un servidor en ${panelPort}; se reutilizará el que está abierto.`);
        return;
      }
      console.error(`[${label}] Vite terminó${code == null ? '' : ` (código ${code})`}.`);
      stopAll(code || 1);
    }
  });
  return readyPromise;
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

Promise.all([
  start('Auditorías', auditoriasViteCli, resolve(projectRoot, 'apps/auditorias'), ['--force', '--base=/auditorias/'], true),
  start('Tallas', tallasViteCli, resolve(projectRoot, 'apps/tallas'), ['--force', '--base=/tallas/'], true),
  start('Telas', telasViteCli, resolve(projectRoot, 'apps/telas'), ['--force', '--base=/telas/'], true),
]).then(() => {
  if (stopping) return;
  console.log(`[panel] Aplicativos listos; iniciando el portal en el puerto ${panelPort}.`);
  start('panel', viteCli, projectRoot);
}).catch((error) => {
  console.error('[panel] No se iniciará el portal porque algún aplicativo no quedó listo:', error.message);
  stopAll(1);
});
