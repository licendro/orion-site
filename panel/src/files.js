// Explorateur de fichiers, limité aux dossiers déclarés dans Réglages (« roots »).
// Toute demande hors de ces dossiers (../, liens symboliques…) est refusée.
import fs from 'node:fs';
import path from 'node:path';
import { config, DATA } from './config.js';

const MAX_VIEW = 2 * 1024 * 1024; // 2 Mo affichables / modifiables
const TRASH = path.join(DATA, 'corbeille');

export function resolveSafe(p, { mustExist = true } = {}) {
  const abs = path.resolve(String(p || ''));
  const roots = config().roots.map((r) => path.resolve(r));
  let real = abs;
  try { real = fs.realpathSync(abs); } catch (e) {
    if (mustExist) throw new Error('Introuvable');
    real = path.join(fs.realpathSync(path.dirname(abs)), path.basename(abs)); // nouveau fichier : on vérifie le dossier parent
  }
  const ok = roots.some((r) => { try { const rr = fs.realpathSync(r); return real === rr || real.startsWith(rr + path.sep); } catch { return false; } });
  if (!ok) throw new Error('Accès refusé : en dehors des dossiers autorisés');
  return real;
}

export function roots() {
  return config().roots.map((r) => ({ path: r, exists: fs.existsSync(r) }));
}

export function list(dir) {
  const d = resolveSafe(dir);
  const st = fs.statSync(d);
  if (!st.isDirectory()) throw new Error('Ce n’est pas un dossier');
  const items = fs.readdirSync(d, { withFileTypes: true }).map((e) => {
    const full = path.join(d, e.name);
    let s = null;
    try { s = fs.statSync(full); } catch { /* lien cassé */ }
    return { name: e.name, path: full, dir: !!s?.isDirectory(), size: s?.size ?? 0, mtime: s?.mtimeMs ?? 0, link: e.isSymbolicLink() };
  }).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
  const parent = path.dirname(d);
  let canUp = true;
  try { resolveSafe(parent); } catch { canUp = false; }
  return { path: d, parent: canUp && parent !== d ? parent : null, items };
}

const looksBinary = (buf) => buf.subarray(0, 8000).includes(0);
export function read(file) {
  const f = resolveSafe(file);
  const st = fs.statSync(f);
  if (st.isDirectory()) throw new Error('C’est un dossier');
  if (st.size > MAX_VIEW) return { path: f, size: st.size, tooBig: true };
  const buf = fs.readFileSync(f);
  if (looksBinary(buf)) return { path: f, size: st.size, binary: true };
  return { path: f, size: st.size, mtime: st.mtimeMs, content: buf.toString('utf8'), sensitive: /(^|\/)\.env/.test(f) };
}

// Enregistre un fichier texte (copie de l'ancienne version dans la corbeille du panneau)
export function write(file, content, expectedMtime) {
  const f = resolveSafe(file, { mustExist: false });
  if (fs.existsSync(f)) {
    const st = fs.statSync(f);
    if (expectedMtime && Math.abs(st.mtimeMs - expectedMtime) > 1) throw new Error('Le fichier a changé depuis que tu l’as ouvert : recharge-le.');
    backup(f);
  }
  const tmp = `${f}.panel-tmp`;
  fs.writeFileSync(tmp, String(content));
  try { fs.chmodSync(tmp, fs.existsSync(f) ? fs.statSync(f).mode : 0o644); } catch { /* rien */ }
  fs.renameSync(tmp, f);
  return fs.statSync(f).mtimeMs;
}

function backup(f) {
  fs.mkdirSync(TRASH, { recursive: true });
  const dest = path.join(TRASH, `${new Date().toISOString().replace(/[:.]/g, '-')}__${f.replace(/\//g, '__')}`);
  fs.cpSync(f, dest, { recursive: true });
  return dest;
}

export function mkdir(dir) { const d = resolveSafe(dir, { mustExist: false }); fs.mkdirSync(d, { recursive: false }); return d; }

export function rename(from, toName) {
  const f = resolveSafe(from);
  if (!/^[^/\0]{1,200}$/.test(toName) || toName === '.' || toName === '..') throw new Error('Nom invalide');
  const dest = resolveSafe(path.join(path.dirname(f), toName), { mustExist: false });
  if (fs.existsSync(dest)) throw new Error('Un élément porte déjà ce nom');
  fs.renameSync(f, dest);
  return dest;
}

// « Supprimer » = déplacer dans la corbeille du panneau (récupérable)
export function remove(p) {
  const f = resolveSafe(p);
  if (config().roots.some((r) => path.resolve(r) === f)) throw new Error('Impossible de supprimer un dossier racine');
  const dest = backup(f);
  fs.rmSync(f, { recursive: true, force: true });
  return dest;
}

export function saveUpload(dir, name, buf) {
  if (!/^[^/\0]{1,200}$/.test(name)) throw new Error('Nom de fichier invalide');
  const d = resolveSafe(dir);
  const f = resolveSafe(path.join(d, name), { mustExist: false });
  if (fs.existsSync(f)) backup(f);
  fs.writeFileSync(f, buf);
  return f;
}

export function trash() {
  try {
    return fs.readdirSync(TRASH).map((n) => ({ name: n, original: '/' + n.split('__').slice(1).join('/').replace(/^\/+/, '').replace(/\/{2,}/g, '/'), at: fs.statSync(path.join(TRASH, n)).mtimeMs }))
      .sort((a, b) => b.at - a.at).slice(0, 200);
  } catch { return []; }
}
// Nettoyage : la corbeille garde 30 jours
export function purgeTrash() {
  try {
    for (const n of fs.readdirSync(TRASH)) {
      const p = path.join(TRASH, n);
      if (Date.now() - fs.statSync(p).mtimeMs > 30 * 864e5) fs.rmSync(p, { recursive: true, force: true });
    }
  } catch { /* rien */ }
}

// Restaurer un élément de la corbeille à son emplacement d'origine (s'il est libre)
export function restore(name) {
  if (!/^[^/\0]+$/.test(name)) throw new Error('Nom invalide');
  const src = path.join(TRASH, name);
  if (!fs.existsSync(src)) throw new Error('Introuvable dans la corbeille');
  const original = '/' + name.split('__').slice(1).join('/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  const dest = resolveSafe(original, { mustExist: false });
  if (fs.existsSync(dest)) throw new Error(`Un fichier existe déjà à ${dest} : renomme-le d’abord.`);
  fs.renameSync(src, dest);
  return dest;
}
