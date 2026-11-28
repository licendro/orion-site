// État du VPS, applications pm2, actions autorisées. Aucune commande libre : uniquement des appels prévus.
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { config } from './config.js';

const run = promisify(execFile);
const PM2 = process.env.PM2_BIN || 'pm2';
export const SELF = process.env.PANEL_NAME || 'orion-panel';

// ---------- Système ----------
let lastCpu = os.cpus().map((c) => c.times);
function cpuPct() {
  const now = os.cpus().map((c) => c.times);
  let idle = 0, total = 0;
  now.forEach((t, i) => {
    const p = lastCpu[i] || t;
    const d = (k) => t[k] - p[k];
    const tot = d('user') + d('nice') + d('sys') + d('idle') + d('irq');
    idle += d('idle'); total += tot;
  });
  lastCpu = now;
  return total ? Math.round((1 - idle / total) * 100) : 0;
}
function meminfo() {
  try {
    const m = Object.fromEntries(fs.readFileSync('/proc/meminfo', 'utf8').split('\n').filter(Boolean).map((l) => { const [k, v] = l.split(':'); return [k, parseInt(v, 10) * 1024]; }));
    return { total: m.MemTotal, available: m.MemAvailable, swapTotal: m.SwapTotal, swapFree: m.SwapFree };
  } catch { return { total: os.totalmem(), available: os.freemem(), swapTotal: 0, swapFree: 0 }; }
}
async function disk() {
  try {
    const { stdout } = await run('df', ['-B1', '-P', '/'], { timeout: 5000 });
    const [, size, used, avail] = stdout.trim().split('\n')[1].split(/\s+/);
    return { total: Number(size), used: Number(used), free: Number(avail) };
  } catch { return null; }
}
function lastBackup() {
  const dir = config().backupsDir;
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.(db|sqlite|tar\.gz|zip|sql)$/.test(f))
      .map((f) => ({ f, s: fs.statSync(path.join(dir, f)) })).sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
    return files[0] ? { name: files[0].f, at: files[0].s.mtimeMs, size: files[0].s.size, count: files.length } : null;
  } catch { return null; }
}
export async function systemStats() {
  const m = meminfo();
  return {
    hostname: os.hostname(), uptime: os.uptime(), cpus: os.cpus().length, cpu: cpuPct(), load: os.loadavg(),
    mem: { total: m.total, used: m.total - m.available }, swap: { total: m.swapTotal, used: m.swapTotal - m.swapFree },
    disk: await disk(), backup: lastBackup(), node: process.version,
  };
}

// ---------- Applications pm2 ----------
export async function apps() {
  const { stdout } = await run(PM2, ['jlist'], { timeout: 15000, maxBuffer: 20 * 1024 * 1024 });
  const list = JSON.parse(stdout.slice(stdout.indexOf('[')));
  const meta = config().apps;
  return list.map((p) => {
    const e = p.pm2_env || {};
    return {
      name: p.name, id: p.pm_id, pid: p.pid, status: e.status, cpu: p.monit?.cpu ?? 0, memory: p.monit?.memory ?? 0,
      maxMemory: Number(e.max_memory_restart) || null, restarts: e.restart_time || 0, unstable: e.unstable_restarts || 0,
      uptime: e.status === 'online' ? Date.now() - e.pm_uptime : 0, startedAt: e.pm_uptime, cwd: e.pm_cwd, script: e.pm_exec_path,
      outLog: e.pm_out_log_path, errLog: e.pm_err_log_path, node: e.node_version, port: e.env?.PORT || null,
      label: meta[p.name]?.label || p.name, group: meta[p.name]?.group || 'Autres', url: meta[p.name]?.url || '',
      deploy: meta[p.name]?.deploy || '', self: p.name === SELF,
    };
  });
}

// Mémorisé par la surveillance : arrêts voulus (pas d'alerte) et redémarrages faits depuis le panneau
export const intent = { stopped: new Set(), restartedAt: new Map() };

const NAME = /^[A-Za-z0-9_.-]{1,64}$/;
export async function action(name, act) {
  if (!NAME.test(name)) throw new Error('Nom d’application invalide');
  if (!['start', 'stop', 'restart', 'reload'].includes(act)) throw new Error('Action inconnue');
  if (name === SELF && act === 'stop') throw new Error('Le panneau ne peut pas s’arrêter lui-même (utilise Cockpit ou SSH).');
  if (act === 'stop') intent.stopped.add(name); else { intent.stopped.delete(name); intent.restartedAt.set(name, Date.now()); }
  await run(PM2, [act, name], { timeout: 60000 });
  await run(PM2, ['save'], { timeout: 20000 }).catch(() => {});
}

// Mémoire allouée à une application : pm2 la redémarre si elle dépasse cette limite
export async function setMemory(name, mb) {
  if (!NAME.test(name)) throw new Error('Nom d’application invalide');
  mb = Math.round(Number(mb));
  if (!(mb >= 64 && mb <= 32768)) throw new Error('Limite entre 64 Mo et 32 Go');
  intent.restartedAt.set(name, Date.now());
  await run(PM2, ['restart', name, '--max-memory-restart', `${mb}M`, '--update-env'], { timeout: 60000 });
  await run(PM2, ['save'], { timeout: 20000 }).catch(() => {});
}

// ---------- Mises à jour (commande définie dans Réglages, jamais saisie librement ailleurs) ----------
const jobs = new Map();
export function deploy(name) {
  const app = config().apps[name];
  if (!app?.deploy) throw new Error('Aucune commande de mise à jour pour cette application (Réglages).');
  return apps().then((list) => {
    const a = list.find((x) => x.name === name);
    const cwd = app.cwd || a?.cwd;
    if (!cwd || !fs.existsSync(cwd)) throw new Error('Dossier de l’application introuvable');
    const id = `${name}-${Date.now()}`;
    const job = { id, name, cmd: app.deploy, cwd, out: '', status: 'running', started: Date.now(), ended: null, code: null };
    jobs.set(id, job);
    intent.restartedAt.set(name, Date.now() + 10 * 60e3); // pas d'alerte « redémarrage » pendant la mise à jour
    const p = spawn('bash', ['-lc', app.deploy], { cwd, env: { ...process.env, FORCE_COLOR: '0' } });
    const add = (d) => { job.out = (job.out + d.toString()).slice(-200000); };
    p.stdout.on('data', add); p.stderr.on('data', add);
    p.on('close', (code) => { job.status = code === 0 ? 'ok' : 'error'; job.code = code; job.ended = Date.now(); intent.restartedAt.set(name, Date.now()); });
    setTimeout(() => { if (job.status === 'running') { p.kill('SIGTERM'); add('\n[Arrêté : plus de 15 minutes]\n'); } }, 15 * 60e3);
    for (const [k, j] of jobs) if (j.ended && Date.now() - j.ended > 3600e3) jobs.delete(k);
    return job;
  });
}
export const job = (id) => jobs.get(id);
export const runningJobs = () => [...jobs.values()].filter((j) => j.status === 'running');

// Dernier commit git de l'application (si c'est un dépôt)
export async function gitInfo(cwd) {
  try {
    const { stdout } = await run('git', ['-C', cwd, 'log', '-1', '--format=%h|%s|%cr|%an'], { timeout: 5000 });
    const [hash, subject, when, author] = stdout.trim().split('|');
    const st = await run('git', ['-C', cwd, 'status', '--porcelain'], { timeout: 5000 });
    return { hash, subject, when, author, dirty: st.stdout.trim().split('\n').filter(Boolean).length };
  } catch { return null; }
}
