// Panneau VPS Orion : interface (une seule page, sans dépendance)
const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = (b) => (b == null ? '—' : b >= 1073741824 ? `${(b / 1073741824).toFixed(1).replace('.', ',')} Go` : `${Math.round(b / 1048576)} Mo`);
const size = (b) => (b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(0)} Ko` : mb(b));
const dur = (ms) => { const s = Math.floor(ms / 1000); if (s < 60) return `${s} s`; if (s < 3600) return `${Math.floor(s / 60)} min`; if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`; return `${Math.floor(s / 86400)} j ${Math.floor((s % 86400) / 3600)} h`; };
const date = (t) => (t ? new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const pctCls = (p) => (p > 90 ? 'bad' : p > 75 ? 'warn' : '');
const STATUS = { online: 'En ligne', stopped: 'Arrêtée', errored: 'En erreur', launching: 'Démarrage…', stopping: 'Arrêt…', 'waiting restart': 'Redémarre…' };
const COLORS = ['#ff7a2f', '#6eaaff', '#4ade80', '#c084fc', '#f5a524', '#f472b6', '#2dd4bf', '#a3e635'];

function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = text;
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), 4500);
}

async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { ...(method !== 'GET' ? { 'X-Panel': '1' } : {}), ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}), ...(raw ? { 'Content-Type': 'application/octet-stream' } : {}) },
    body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && !path.startsWith('/api/login')) { renderLogin(); throw new Error('Session expirée'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Erreur ${res.status}`);
  return j;
}

// ---------------------------------------------------------------- Connexion
function renderLogin() {
  stopTimers();
  $app.innerHTML = `<div class="login"><form class="card" id="lf">
    <div class="brand" style="padding:0"><img src="/assets/icon.svg" alt="" /><div>PANNEAU VPS<small>Orion</small></div></div>
    <label>Identifiant<input class="field" name="user" autocomplete="username" required /></label>
    <label>Mot de passe<input class="field" name="password" type="password" autocomplete="current-password" required /></label>
    <label>Code à 6 chiffres (appli d’authentification)<input class="field mono" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" /></label>
    <button class="btn pri" style="justify-content:center">Se connecter</button>
    <p class="muted" id="lerr" style="margin:0;font-size:13.5px"></p>
  </form></div>`;
  document.getElementById('lf').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await api('/api/login', { method: 'POST', body: f }); location.hash = '#/'; boot(); }
    catch (err) { document.getElementById('lerr').textContent = err.message; }
  };
}

// ---------------------------------------------------------------- Mise en page
const NAV = [['#/', '📊', 'Tableau de bord'], ['#/apps', '🧩', 'Applications'], ['#/files', '📁', 'Fichiers'], ['#/alerts', '🔔', 'Alertes'], ['#/journal', '📜', 'Journal'], ['#/settings', '⚙️', 'Réglages']];
function layout(active, inner) {
  const link = (h, ic, l) => `<a href="${h}" class="${active === h ? 'on' : ''}"><span class="ic">${ic}</span><span>${l}</span></a>`;
  $app.innerHTML = `<div class="shell">
    <aside class="side"><div class="brand"><img src="/assets/icon.svg" alt="" /><div>PANNEAU VPS<small id="host">Orion</small></div></div>
      <nav class="nav">${NAV.map((n) => link(...n)).join('')}</nav><div class="grow"></div>
      <a class="btn sm" href="#" id="logout">Se déconnecter</a></aside>
    <main class="main" id="main">${inner}</main>
    <nav class="mtab">${NAV.filter((n) => n[0] !== '#/journal').map(([h, ic, l]) => `<a href="${h}" class="${active === h ? 'on' : ''}"><span class="ic">${ic}</span>${l.split(' ')[0]}</a>`).join('')}</nav>
  </div>`;
  document.getElementById('logout').onclick = async (e) => { e.preventDefault(); await api('/api/logout', { method: 'POST', body: {} }).catch(() => {}); renderLogin(); };
}

let timers = [];
const stopTimers = () => { timers.forEach(clearInterval); timers = []; };
const every = (ms, fn) => { fn(); timers.push(setInterval(fn, ms)); };

// ---------------------------------------------------------------- Tableau de bord
function spark(hist, key, color) {
  if (hist.length < 2) return '<p class="muted" style="font-size:13px">Les courbes apparaissent après quelques minutes.</p>';
  const w = 300, h = 60, t0 = hist[0].t, t1 = hist.at(-1).t || t0 + 1;
  const pts = hist.map((p) => `${(((p.t - t0) / (t1 - t0 || 1)) * w).toFixed(1)},${(h - (p[key] / 100) * h).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function appCard(a) {
  const memPct = a.maxMemory ? Math.min(100, (a.memory / a.maxMemory) * 100) : null;
  return `<div class="card app" data-app="${esc(a.name)}">
    <div class="app-h"><span class="dot ${esc(a.status)}"></span><b>${esc(a.label)}</b><span class="muted">${esc(STATUS[a.status] || a.status)}</span></div>
    <div><div class="muted" style="font-size:12.5px;display:flex;justify-content:space-between"><span>Mémoire</span><span>${mb(a.memory)}${a.maxMemory ? ` / ${mb(a.maxMemory)}` : ' · sans limite'}</span></div>
      <div class="bar"><i class="${pctCls(memPct || 0)}" style="width:${memPct ?? 0}%"></i></div></div>
    <div class="stats"><div><span>Processeur</span>${a.cpu} %</div><div><span>Depuis</span>${a.status === 'online' ? dur(a.uptime) : '—'}</div><div><span>Redémarrages</span>${a.restarts}</div></div>
    <div class="btns">
      ${a.status === 'online' ? `<button class="btn sm" data-act="restart" data-n="${esc(a.name)}">🔄 Redémarrer</button>${a.self ? '' : `<button class="btn sm" data-act="stop" data-n="${esc(a.name)}">⏸ Arrêter</button>`}` : `<button class="btn sm pri" data-act="start" data-n="${esc(a.name)}">▶ Démarrer</button>`}
      <a class="btn sm" href="#/app/${encodeURIComponent(a.name)}">Détails →</a>
    </div></div>`;
}
async function doAction(name, act) {
  const verbs = { stop: 'arrêter', restart: 'redémarrer', start: 'démarrer', reload: 'recharger' };
  if (act !== 'start' && !confirm(`Vraiment ${verbs[act]} « ${name} » ?`)) return;
  try { await api(`/api/apps/${encodeURIComponent(name)}/${act}`, { method: 'POST', body: {} }); toast(`« ${name} » : c’est fait.`, 'ok'); route(); }
  catch (e) { toast(e.message, 'bad'); }
}
function bindAppButtons(root = document) {
  root.querySelectorAll('[data-act]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); doAction(b.dataset.n, b.dataset.act); }; });
  root.querySelectorAll('.app a').forEach((l) => { l.onclick = (e) => e.stopPropagation(); });
  root.querySelectorAll('.app[data-app]').forEach((c) => { c.onclick = () => { location.hash = `#/app/${encodeURIComponent(c.dataset.app)}`; }; });
}

async function viewDashboard() {
  layout('#/', '<div id="dash"><p class="muted">Chargement…</p></div>');
  every(5000, async () => {
    let d;
    try { d = await api('/api/overview'); } catch (e) { return; }
    const s = d.system;
    document.getElementById('host').textContent = s.hostname;
    const memP = (s.mem.used / s.mem.total) * 100;
    const diskP = s.disk ? (s.disk.used / s.disk.total) * 100 : 0;
    const swapP = s.swap.total ? (s.swap.used / s.swap.total) * 100 : 0;
    const allocated = d.apps.reduce((t, a) => t + (a.maxMemory || 0), 0);
    const groups = {};
    for (const a of d.apps) (groups[a.group] ||= []).push(a);
    const el = document.getElementById('dash');
    if (!el) return;
    el.innerHTML = `
      <div class="head"><div><h1>Tableau de bord</h1><p class="sub" style="margin:0">${esc(s.hostname)} · allumé depuis ${dur(s.uptime * 1000)} · ${s.cpus} cœurs · Node ${esc(s.node)}</p></div></div>
      ${d.jobs.length ? `<div class="notice">⏳ Mise à jour en cours : ${d.jobs.map((j) => `<a href="#/app/${encodeURIComponent(j.name)}">${esc(j.name)}</a>`).join(', ')}</div>` : ''}
      <div class="grid g4">
        <div class="card tile"><div class="k">Processeur</div><div class="v">${s.cpu} %<small> · charge ${s.load[0].toFixed(2)}</small></div><div class="bar"><i class="${pctCls(s.cpu)}" style="width:${s.cpu}%"></i></div></div>
        <div class="card tile"><div class="k">Mémoire</div><div class="v">${mb(s.mem.used)}<small> / ${mb(s.mem.total)}</small></div><div class="bar"><i class="${pctCls(memP)}" style="width:${memP}%"></i></div></div>
        <div class="card tile"><div class="k">Disque</div><div class="v">${s.disk ? mb(s.disk.free) : '—'}<small> libres</small></div><div class="bar"><i class="${pctCls(diskP)}" style="width:${diskP}%"></i></div></div>
        <div class="card tile"><div class="k">Swap</div><div class="v">${s.swap.total ? mb(s.swap.used) : 'Aucun'}<small>${s.swap.total ? ` / ${mb(s.swap.total)}` : ''}</small></div><div class="bar"><i class="${pctCls(swapP)}" style="width:${swapP}%"></i></div></div>
      </div>
      <div class="grid g2" style="margin-top:14px">
        <div class="card"><h2>Mémoire réservée aux applications</h2>
          <div class="alloc">${d.apps.filter((a) => a.maxMemory).map((a, i) => `<span style="width:${(a.maxMemory / s.mem.total) * 100}%;background:${COLORS[i % COLORS.length]}" title="${esc(a.label)} : ${mb(a.maxMemory)}">${(a.maxMemory / s.mem.total) > 0.08 ? esc(a.label.split(' ')[0]) : ''}</span>`).join('')}</div>
          <div class="legend">${d.apps.filter((a) => a.maxMemory).map((a, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(a.label)} · ${mb(a.maxMemory)}</span>`).join('')}</div>
          <p class="muted" style="font-size:13px;margin:10px 0 0">${mb(allocated)} réservés sur ${mb(s.mem.total)}${allocated > s.mem.total ? ' — ⚠ plus que la RAM du VPS : c’est possible tant qu’elles n’utilisent pas tout en même temps, sinon le swap prend le relais.' : '.'} Change la mémoire d’une application dans sa page Détails.</p>
        </div>
        <div class="card"><h2>Dernières 24 h</h2>
          <div class="muted" style="font-size:12.5px">Processeur</div>${spark(d.history, 'cpu', '#ff7a2f')}
          <div class="muted" style="font-size:12.5px;margin-top:6px">Mémoire</div>${spark(d.history, 'mem', '#6eaaff')}
          <p class="muted" style="font-size:13px;margin:8px 0 0">💾 ${s.backup ? `Dernière sauvegarde : ${esc(s.backup.name)} (${date(s.backup.at)}, ${size(s.backup.size)}) · ${s.backup.count} conservées` : 'Aucune sauvegarde trouvée dans le dossier configuré.'}</p>
        </div>
      </div>
      ${Object.entries(groups).map(([g, list]) => `<h2 style="margin:26px 0 12px">${esc(g)}</h2><div class="grid g3">${list.map(appCard).join('')}</div>`).join('') || '<p class="muted" style="margin-top:20px">Aucune application dans pm2.</p>'}`;
    bindAppButtons(el);
  });
}

// ---------------------------------------------------------------- Liste des applications
async function viewApps() {
  layout('#/apps', '<div id="apps"></div>');
  every(5000, async () => {
    let d; try { d = await api('/api/overview'); } catch { return; }
    const el = document.getElementById('apps'); if (!el) return;
    el.innerHTML = `<div class="head"><div><h1>Applications</h1><p class="sub" style="margin:0">Tout ce que pm2 fait tourner sur le VPS.</p></div></div>
      <div class="card scroll"><table class="tbl"><thead><tr><th></th><th>Application</th><th>État</th><th>Mémoire</th><th class="hide-m">Processeur</th><th class="hide-m">Depuis</th><th class="hide-m">Redémarrages</th><th></th></tr></thead><tbody>
      ${d.apps.map((a) => `<tr class="click" data-go="${esc(a.name)}"><td><span class="dot ${esc(a.status)}"></span></td><td><b>${esc(a.label)}</b><div class="muted mono" style="font-size:12px">${esc(a.name)}${a.port ? ` · port ${esc(a.port)}` : ''}</div></td>
        <td>${esc(STATUS[a.status] || a.status)}</td><td>${mb(a.memory)}${a.maxMemory ? ` <span class="muted">/ ${mb(a.maxMemory)}</span>` : ''}</td><td class="hide-m">${a.cpu} %</td>
        <td class="hide-m">${a.status === 'online' ? dur(a.uptime) : '—'}</td><td class="hide-m">${a.restarts}</td><td>›</td></tr>`).join('')}
      </tbody></table></div>`;
    el.querySelectorAll('[data-go]').forEach((r) => { r.onclick = () => { location.hash = `#/app/${encodeURIComponent(r.dataset.go)}`; }; });
  });
}

// ---------------------------------------------------------------- Détail d'une application
async function viewApp(name) {
  layout('#/apps', '<div id="ad"><p class="muted">Chargement…</p></div>');
  const el = document.getElementById('ad');
  const state = { type: 'out', offset: null, live: true, filter: '', errorsOnly: false, buf: '' };
  let a, total;
  const refresh = async () => {
    const d = await api('/api/overview');
    a = d.apps.find((x) => x.name === name); total = d.system.mem.total;
    if (!a) { el.innerHTML = '<p>Application introuvable dans pm2.</p>'; return false; }
    const h = document.getElementById('ah');
    if (h) h.innerHTML = header();
    bindAppButtons(h || el);
    bindDeploy();
    return true;
  };
  const header = () => `<div class="head"><div><h1><span class="dot ${esc(a.status)}" style="display:inline-block;margin-right:10px"></span>${esc(a.label)}</h1>
      <p class="sub" style="margin:0"><span class="mono">${esc(a.name)}</span> · ${esc(STATUS[a.status] || a.status)}${a.status === 'online' ? ` depuis ${dur(a.uptime)}` : ''} · ${a.restarts} redémarrage(s) · ${a.cpu} % processeur · ${mb(a.memory)} de RAM</p></div>
      <div class="btns">${a.status === 'online' ? `<button class="btn" data-act="restart" data-n="${esc(a.name)}">🔄 Redémarrer</button>${a.self ? '' : `<button class="btn" data-act="stop" data-n="${esc(a.name)}">⏸ Arrêter</button>`}` : `<button class="btn pri" data-act="start" data-n="${esc(a.name)}">▶ Démarrer</button>`}
      ${a.deploy ? '<button class="btn pri" id="deploy">⬆️ Mettre à jour</button>' : ''}</div></div>`;
  if (!(await refresh().catch((e) => { el.innerHTML = `<p>${esc(e.message)}</p>`; return false; }))) return;
  const git = await api(`/api/apps/${encodeURIComponent(name)}/git`).then((r) => r.git).catch(() => null);
  el.innerHTML = `<div id="ah">${header()}</div>
    <div class="grid g2">
      <div class="card"><h2>🧠 Mémoire allouée</h2>
        <p class="muted" style="font-size:13.5px;margin-top:0">Au-delà de cette limite, pm2 redémarre l’application (elle ne peut pas faire tomber tout le VPS). Utilisation actuelle : <b>${mb(a.memory)}</b>. RAM du VPS : ${mb(total)}.</p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input type="range" id="memr" min="64" max="${Math.max(512, Math.round(total / 1048576))}" step="32" value="${Math.round((a.maxMemory || 512 * 1048576) / 1048576)}" style="flex:1;min-width:160px;accent-color:#ff7a2f" />
          <input class="field mono" id="memv" style="width:110px" value="${Math.round((a.maxMemory || 512 * 1048576) / 1048576)}" /> <span class="muted">Mo</span>
          <button class="btn pri" id="memset">Appliquer</button>
        </div>
        <p class="muted" style="font-size:12.5px;margin:8px 0 0">${a.maxMemory ? `Limite actuelle : ${mb(a.maxMemory)}.` : 'Aucune limite pour l’instant.'} Appliquer redémarre l’application.</p>
      </div>
      <div class="card"><h2>📦 Infos</h2>
        <p style="margin:0;font-size:14px;line-height:1.8"><span class="muted">Dossier :</span> <a href="#/files?path=${encodeURIComponent(a.cwd || '')}" class="mono">${esc(a.cwd)}</a><br/>
        <span class="muted">Script :</span> <span class="mono">${esc(a.script)}</span><br/>
        <span class="muted">Démarrée le :</span> ${date(a.startedAt)}${a.node ? ` · Node ${esc(a.node)}` : ''}<br/>
        ${git ? `<span class="muted">Version :</span> <span class="mono">${esc(git.hash)}</span> ${esc(git.subject)} <span class="muted">(${esc(git.when)})</span>${git.dirty ? ` · <span style="color:var(--warn)">${git.dirty} fichier(s) modifié(s) sur le VPS</span>` : ''}` : '<span class="muted">Pas un dépôt git.</span>'}<br/>
        ${a.url ? `<span class="muted">Surveillé :</span> <span class="mono">${esc(a.url)}</span>` : '<span class="muted">Pas d’adresse surveillée (Réglages).</span>'}</p>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="head" style="margin-bottom:6px"><h2 style="margin:0">📜 Journaux</h2>
        <div class="btns"><input class="field" id="lf" placeholder="Filtrer…" style="width:180px;min-height:30px;padding:4px 10px" />
          <label class="chk" style="font-size:13px"><input type="checkbox" id="lerr" /> Erreurs seulement</label>
          <label class="chk" style="font-size:13px"><input type="checkbox" id="llive" checked /> En direct</label>
          <a class="btn sm" id="ldl" href="#">⬇ Télécharger</a><button class="btn sm bad" id="lflush">Vider</button></div></div>
      <div class="tabs"><button data-t="out" class="on">Sortie</button><button data-t="err">Erreurs</button></div>
      <div class="log" id="log"></div>
    </div>`;
  bindAppButtons(el);
  // Mémoire
  const r = document.getElementById('memr'), v = document.getElementById('memv');
  r.oninput = () => { v.value = r.value; };
  v.oninput = () => { r.value = v.value; };
  document.getElementById('memset').onclick = async () => {
    if (!confirm(`Limiter « ${name} » à ${v.value} Mo ? L’application va redémarrer.`)) return;
    try { await api(`/api/apps/${encodeURIComponent(name)}/memory`, { method: 'POST', body: { mb: Number(v.value) } }); toast('Mémoire mise à jour.', 'ok'); setTimeout(refresh, 1500); }
    catch (e) { toast(e.message, 'bad'); }
  };
  // Journaux
  const logEl = document.getElementById('log');
  const paint = () => {
    const lines = state.buf.split('\n').filter((l) => (!state.errorsOnly || /error|erreur|fail|exception|warn|\[err/i.test(l)) && (!state.filter || l.toLowerCase().includes(state.filter.toLowerCase())));
    const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 30;
    logEl.innerHTML = lines.slice(-2000).map((l) => {
      let h = esc(l);
      if (state.filter) h = h.replace(new RegExp(state.filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
      return /error|erreur|exception|fail/i.test(l) ? `<span class="e">${h}</span>` : /warn|attention/i.test(l) ? `<span class="w">${h}</span>` : h;
    }).join('\n') || '<span class="muted">Rien pour le moment.</span>';
    if (atBottom) logEl.scrollTop = logEl.scrollHeight;
  };
  const pull = async () => {
    if (!state.live && state.offset != null) return;
    try {
      const j = await api(`/api/apps/${encodeURIComponent(name)}/logs?type=${state.type}${state.offset != null ? `&offset=${state.offset}` : ''}`);
      if (state.offset != null && j.offset < state.offset) state.buf = '';
      state.buf = (state.buf + j.content).slice(-400000);
      state.offset = j.offset;
      if (j.content || state.offset === j.offset) paint();
    } catch { /* rien */ }
  };
  const setType = (t) => { state.type = t; state.offset = null; state.buf = ''; el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); document.getElementById('ldl').href = `/api/apps/${encodeURIComponent(name)}/logs/download?type=${t}`; pull(); };
  el.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => setType(b.dataset.t); });
  document.getElementById('lf').oninput = (e) => { state.filter = e.target.value; paint(); };
  document.getElementById('lerr').onchange = (e) => { state.errorsOnly = e.target.checked; paint(); };
  document.getElementById('llive').onchange = (e) => { state.live = e.target.checked; };
  document.getElementById('lflush').onclick = async () => {
    if (!confirm('Vider les journaux de cette application ?')) return;
    try { await api(`/api/apps/${encodeURIComponent(name)}/logs/flush`, { method: 'POST', body: {} }); state.buf = ''; state.offset = null; toast('Journaux vidés.', 'ok'); pull(); } catch (e) { toast(e.message, 'bad'); }
  };
  setType('out');
  timers.push(setInterval(pull, 2000));
  timers.push(setInterval(() => refresh().catch(() => {}), 6000));
  bindDeploy();

  function bindDeploy() {
    const b = document.getElementById('deploy');
    if (!b) return;
    b.onclick = async () => {
      if (!confirm(`Lancer la mise à jour de « ${name} » ?\n\nCommande : ${a.deploy}`)) return;
      try { const { id } = await api(`/api/apps/${encodeURIComponent(name)}/deploy`, { method: 'POST', body: {} }); showJob(id); } catch (e) { toast(e.message, 'bad'); }
    };
  }
}

function showJob(id) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="card"><div class="head" style="margin:0"><h2 style="margin:0" id="jt">⏳ Mise à jour en cours…</h2><button class="btn sm" id="jc">Fermer</button></div><div class="log" id="jo" style="height:60vh"></div></div>`;
  document.body.append(m);
  m.querySelector('#jc').onclick = () => { clearInterval(t); m.remove(); route(); };
  const t = setInterval(async () => {
    try {
      const j = await api(`/api/jobs/${encodeURIComponent(id)}`);
      const o = m.querySelector('#jo'); o.textContent = j.out; o.scrollTop = o.scrollHeight;
      if (j.status !== 'running') { clearInterval(t); m.querySelector('#jt').textContent = j.status === 'ok' ? '✅ Mise à jour terminée' : `❌ Échec (code ${j.code})`; }
    } catch { clearInterval(t); }
  }, 1500);
}

// ---------------------------------------------------------------- Fichiers
const TEXT_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|json|lua|md|txt|cfg|conf|env|ini|yml|yaml|css|html|sh|sql|log|xml|toml|example)$|^\.env|^[^.]+$/i;
async function viewFiles(params) {
  layout('#/files', '<div id="fs"><p class="muted">Chargement…</p></div>');
  const el = document.getElementById('fs');
  if (params.get('edit')) return editFile(el, params.get('edit'));
  if (params.get('trash')) return viewTrash(el);
  const { roots } = await api('/api/files/roots');
  let d;
  try { d = await api(`/api/files?path=${encodeURIComponent(params.get('path') || roots[0]?.path || '')}`); } catch (e) { el.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  const parts = d.path.split('/').filter(Boolean);
  const root = roots.find((r) => d.path === r.path || d.path.startsWith(`${r.path}/`))?.path || '';
  const crumbs = parts.map((p, i) => `/${parts.slice(0, i + 1).join('/')}`).filter((p) => p.length >= root.length);
  el.innerHTML = `<div class="head"><div><h1>Fichiers</h1><p class="sub" style="margin:0">Uniquement les dossiers autorisés dans Réglages. Les éléments supprimés ou remplacés vont dans la corbeille 30 jours.</p></div>
      <div class="btns"><select class="field" id="root" style="min-height:36px;width:auto">${roots.map((r) => `<option ${r.path === root ? 'selected' : ''}>${esc(r.path)}</option>`).join('')}</select>
      <a class="btn" href="#/files?trash=1">🗑 Corbeille</a></div></div>
    <div class="card">
      <div class="crumbs">${crumbs.map((p) => `<a href="#/files?path=${encodeURIComponent(p)}">${esc(p === root ? p : p.split('/').pop())}</a>`).join('<span class="muted">/</span>')}</div>
      <div class="btns" style="margin-bottom:10px"><button class="btn sm" id="nd">📁 Nouveau dossier</button><button class="btn sm" id="nf">📄 Nouveau fichier</button>
        <label class="btn sm" style="flex-direction:row">⬆ Envoyer<input type="file" id="up" multiple hidden /></label></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>Nom</th><th class="hide-m">Taille</th><th class="hide-m">Modifié</th><th></th></tr></thead><tbody>
        ${d.parent ? `<tr class="click" data-dir="${esc(d.parent)}"><td>⬆️ ..</td><td class="hide-m"></td><td class="hide-m"></td><td></td></tr>` : ''}
        ${d.items.map((f) => `<tr class="click" data-${f.dir ? 'dir' : 'file'}="${esc(f.path)}"><td>${f.dir ? '📁' : /\.env/.test(f.name) ? '🔐' : '📄'} ${esc(f.name)}${f.link ? ' <span class="muted">↪</span>' : ''}</td>
          <td class="hide-m muted">${f.dir ? '' : size(f.size)}</td><td class="hide-m muted">${date(f.mtime)}</td>
          <td style="white-space:nowrap;text-align:right" data-stop>${f.dir ? '' : `<a class="btn sm" href="/api/files/download?path=${encodeURIComponent(f.path)}" title="Télécharger">⬇</a>`}
            <button class="btn sm" data-ren="${esc(f.path)}" title="Renommer">✏️</button><button class="btn sm bad" data-del="${esc(f.path)}" title="Supprimer">🗑</button></td></tr>`).join('')}
        ${!d.items.length ? '<tr><td colspan="4" class="muted">Dossier vide.</td></tr>' : ''}
      </tbody></table></div></div>`;
  document.getElementById('root').onchange = (e) => { location.hash = `#/files?path=${encodeURIComponent(e.target.value)}`; };
  el.querySelectorAll('[data-dir]').forEach((r) => { r.onclick = () => { location.hash = `#/files?path=${encodeURIComponent(r.dataset.dir)}`; }; });
  el.querySelectorAll('[data-file]').forEach((r) => { r.onclick = (e) => { if (e.target.closest('[data-stop]')) return; location.hash = `#/files?edit=${encodeURIComponent(r.dataset.file)}`; }; });
  el.querySelectorAll('[data-ren]').forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); const n = prompt('Nouveau nom :', b.dataset.ren.split('/').pop()); if (!n) return; try { await api('/api/files/rename', { method: 'POST', body: { path: b.dataset.ren, name: n } }); route(); } catch (err) { toast(err.message, 'bad'); } }; });
  el.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); if (!confirm(`Supprimer « ${b.dataset.del.split('/').pop()} » ? (récupérable 30 jours dans la corbeille)`)) return; try { await api(`/api/file?path=${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' }); toast('Déplacé dans la corbeille.', 'ok'); route(); } catch (err) { toast(err.message, 'bad'); } }; });
  document.getElementById('nd').onclick = async () => { const n = prompt('Nom du dossier :'); if (!n) return; try { await api('/api/files/mkdir', { method: 'POST', body: { path: `${d.path}/${n}` } }); route(); } catch (e) { toast(e.message, 'bad'); } };
  document.getElementById('nf').onclick = async () => { const n = prompt('Nom du fichier :'); if (!n) return; try { await api('/api/file', { method: 'PUT', body: { path: `${d.path}/${n}`, content: '' } }); location.hash = `#/files?edit=${encodeURIComponent(`${d.path}/${n}`)}`; } catch (e) { toast(e.message, 'bad'); } };
  document.getElementById('up').onchange = async (e) => {
    for (const f of e.target.files) {
      try { await api(`/api/files/upload?dir=${encodeURIComponent(d.path)}&name=${encodeURIComponent(f.name)}`, { method: 'POST', raw: await f.arrayBuffer() }); toast(`« ${f.name} » envoyé.`, 'ok'); }
      catch (err) { toast(`${f.name} : ${err.message}`, 'bad'); }
    }
    route();
  };
}

async function editFile(el, file) {
  let f;
  try { f = await api(`/api/file?path=${encodeURIComponent(file)}`); } catch (e) { el.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  const back = `#/files?path=${encodeURIComponent(file.split('/').slice(0, -1).join('/') || '/')}`;
  if (f.tooBig || f.binary) {
    el.innerHTML = `<div class="head"><h1>${esc(file.split('/').pop())}</h1><div class="btns"><a class="btn" href="${back}">← Retour</a><a class="btn pri" href="/api/files/download?path=${encodeURIComponent(file)}">⬇ Télécharger</a></div></div>
      <div class="card"><p>${f.binary ? 'Fichier binaire : pas d’aperçu.' : `Fichier trop gros pour l’éditeur (${size(f.size)}).`} Tu peux le télécharger.</p></div>`;
    return;
  }
  let mtime = f.mtime;
  el.innerHTML = `<div class="head"><div><h1>${esc(file.split('/').pop())}</h1><p class="sub mono" style="margin:0">${esc(file)} · ${size(f.size)}</p></div>
      <div class="btns"><a class="btn" href="${back}">← Retour</a><button class="btn pri" id="save">💾 Enregistrer</button></div></div>
    ${f.sensitive ? '<div class="notice">🔐 Ce fichier contient des secrets (clés, mots de passe). Ne fais pas de capture d’écran, et redémarre l’application concernée après modification.</div>' : ''}
    <textarea class="editor" id="ed" spellcheck="false"></textarea>
    <p class="muted" style="font-size:12.5px">Ctrl + S pour enregistrer. L’ancienne version est gardée 30 jours dans la corbeille.</p>`;
  const ed = document.getElementById('ed');
  ed.value = f.content;
  let dirty = false;
  ed.oninput = () => { dirty = true; };
  ed.onkeydown = (e) => {
    if (e.key === 'Tab') { e.preventDefault(); const s = ed.selectionStart; ed.setRangeText('  ', s, ed.selectionEnd, 'end'); dirty = true; }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
  };
  const save = async () => {
    try { const r = await api('/api/file', { method: 'PUT', body: { path: file, content: ed.value, mtime } }); mtime = r.mtime; dirty = false; toast('Enregistré.', 'ok'); }
    catch (e) { toast(e.message, 'bad'); }
  };
  document.getElementById('save').onclick = save;
  window.onbeforeunload = () => (dirty ? true : undefined);
}

async function viewTrash(el) {
  const { items } = await api('/api/trash');
  el.innerHTML = `<div class="head"><div><h1>Corbeille</h1><p class="sub" style="margin:0">Fichiers supprimés ou anciennes versions, gardés 30 jours.</p></div><a class="btn" href="#/files">← Fichiers</a></div>
    <div class="card scroll"><table class="tbl"><thead><tr><th>Emplacement d’origine</th><th>Date</th><th></th></tr></thead><tbody>
    ${items.map((i) => `<tr><td class="mono" style="font-size:13px">${esc(i.original)}</td><td class="muted">${date(i.at)}</td><td><button class="btn sm" data-r="${esc(i.name)}">↩ Restaurer</button></td></tr>`).join('') || '<tr><td colspan="3" class="muted">La corbeille est vide.</td></tr>'}
    </tbody></table></div>`;
  el.querySelectorAll('[data-r]').forEach((b) => { b.onclick = async () => { try { const r = await api('/api/trash/restore', { method: 'POST', body: { name: b.dataset.r } }); toast(`Restauré : ${r.path}`, 'ok'); route(); } catch (e) { toast(e.message, 'bad'); } }; });
}

// ---------------------------------------------------------------- Alertes et journal
async function viewAlerts() {
  layout('#/alerts', '<div id="al"></div>');
  const d = await api('/api/alerts');
  const lv = { danger: '🔴', warn: '🟠', ok: '🟢', info: '🔵' };
  document.getElementById('al').innerHTML = `<div class="head"><div><h1>Alertes</h1><p class="sub" style="margin:0">Surveillance toutes les 30 s : plantages, redémarrages, mémoire, disque, site qui ne répond plus, sauvegardes. ${d.webhook ? 'Envoyées sur Discord.' : '⚠ Aucun webhook Discord (Réglages).'}</p></div>
    <button class="btn" id="test">Envoyer une alerte de test</button></div>
    <div class="card">${d.events.map((e) => `<div class="ev"><div>${lv[e.level] || '•'}</div><div style="flex:1;min-width:0"><b>${esc(e.title)}</b><pre>${esc(e.text)}</pre></div><div class="t">${date(e.at)}</div></div>`).join('') || '<p class="muted" style="margin:0">Aucune alerte depuis le dernier démarrage du panneau. Tout va bien.</p>'}</div>`;
  document.getElementById('test').onclick = async () => { const r = await api('/api/alerts/test', { method: 'POST', body: {} }); toast(r.sent ? 'Alerte envoyée sur Discord.' : 'Pas de webhook configuré : visible ici seulement.', r.sent ? 'ok' : ''); viewAlerts(); };
}
async function viewJournal() {
  layout('#/journal', '<div id="jr"></div>');
  const { items } = await api('/api/audit');
  document.getElementById('jr').innerHTML = `<div class="head"><div><h1>Journal</h1><p class="sub" style="margin:0">Toutes les actions faites depuis le panneau.</p></div></div>
    <div class="card scroll"><table class="tbl"><thead><tr><th>Date</th><th>Action</th><th>Détail</th></tr></thead><tbody>
    ${items.map((i) => `<tr><td class="muted" style="white-space:nowrap">${date(Date.parse(i.at))}</td><td class="mono" style="font-size:13px">${esc(i.action)}</td><td style="font-size:13.5px">${esc(i.detail)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Rien pour le moment.</td></tr>'}
    </tbody></table></div>`;
}

// ---------------------------------------------------------------- Réglages
async function viewSettings() {
  layout('#/settings', '<div id="st"></div>');
  const [s, o] = await Promise.all([api('/api/settings'), api('/api/overview')]);
  const names = [...new Set([...o.apps.map((a) => a.name), ...Object.keys(s.apps)])];
  const el = document.getElementById('st');
  el.innerHTML = `<div class="head"><div><h1>Réglages</h1></div></div>
    <form id="sf" class="grid" style="gap:14px">
      <div class="card"><h2>Applications</h2><p class="muted" style="font-size:13.5px;margin-top:0">Nom affiché, groupe, adresse surveillée (alerte si elle ne répond plus) et commande lancée par « Mettre à jour » dans le dossier de l’application.</p>
        <div class="scroll"><table class="tbl"><thead><tr><th>pm2</th><th>Nom affiché</th><th>Groupe</th><th>Adresse surveillée</th><th>Commande de mise à jour</th></tr></thead><tbody>
        ${names.map((n) => { const m = s.apps[n] || {}; return `<tr data-app="${esc(n)}"><td class="mono" style="font-size:13px">${esc(n)}</td>
          <td><input class="field" name="label" value="${esc(m.label || n)}" /></td><td><input class="field" name="group" value="${esc(m.group || 'Autres')}" style="min-width:110px" /></td>
          <td><input class="field mono" name="url" value="${esc(m.url || '')}" placeholder="http://127.0.0.1:3000/api/health" style="min-width:220px" /></td>
          <td><input class="field mono" name="deploy" value="${esc(m.deploy || '')}" placeholder="./deploy.sh" style="min-width:200px" /></td></tr>`; }).join('')}
        </tbody></table></div></div>
      <div class="card form">
        <h2 class="full" style="margin:0">Fichiers et sauvegardes</h2>
        <label class="full">Dossiers accessibles dans l’onglet Fichiers (un par ligne)<textarea class="field mono" name="roots">${esc(s.roots.join('\n'))}</textarea></label>
        <label class="full">Dossier des sauvegardes (affiché sur le tableau de bord, alerte si rien depuis 36 h)<input class="field mono" name="backupsDir" value="${esc(s.backupsDir)}" /></label>
      </div>
      <div class="card form">
        <h2 class="full" style="margin:0">Alertes Discord</h2>
        <label class="full">Webhook Discord <span class="muted">(Discord → paramètres du salon → Intégrations → Webhooks)</span><input class="field mono" name="webhook" value="${esc(s.alerts.webhook)}" placeholder="https://discord.com/api/webhooks/…" /></label>
        <label>Alerte mémoire d’une application (% de sa limite)<input class="field" type="number" name="memoryPct" value="${s.alerts.memoryPct}" /></label>
        <label>Alerte mémoire du VPS (%)<input class="field" type="number" name="systemMemPct" value="${s.alerts.systemMemPct}" /></label>
        <label>Alerte disque (%)<input class="field" type="number" name="diskPct" value="${s.alerts.diskPct}" /></label>
        <label>Heure du récap quotidien<input class="field" type="number" min="0" max="23" name="reportHour" value="${s.alerts.reportHour}" /></label>
        <label class="chk full"><input type="checkbox" name="dailyReport" ${s.alerts.dailyReport ? 'checked' : ''} /> Envoyer un récap chaque jour sur Discord</label>
      </div>
      <div><button class="btn pri">Enregistrer les réglages</button></div>
    </form>
    <form id="pf" class="card form" style="margin-top:14px">
      <h2 class="full" style="margin:0">Mot de passe</h2>
      <label>Mot de passe actuel<input class="field" type="password" name="current" autocomplete="current-password" required /></label>
      <label>Nouveau (12 caractères min.)<input class="field" type="password" name="next" autocomplete="new-password" minlength="12" required /></label>
      <div class="full"><button class="btn">Changer le mot de passe</button></div>
    </form>`;
  document.getElementById('sf').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const apps = {};
    el.querySelectorAll('tr[data-app]').forEach((r) => { apps[r.dataset.app] = Object.fromEntries([...r.querySelectorAll('input')].map((i) => [i.name, i.value])); });
    try {
      await api('/api/settings', { method: 'PUT', body: {
        apps, roots: String(fd.get('roots')).split('\n').map((x) => x.trim()).filter(Boolean), backupsDir: fd.get('backupsDir'),
        alerts: { webhook: fd.get('webhook'), memoryPct: fd.get('memoryPct'), systemMemPct: fd.get('systemMemPct'), diskPct: fd.get('diskPct'), reportHour: fd.get('reportHour'), dailyReport: fd.get('dailyReport') === 'on' },
      } });
      toast('Réglages enregistrés.', 'ok');
    } catch (err) { toast(err.message, 'bad'); }
  };
  document.getElementById('pf').onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/api/password', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Mot de passe changé.', 'ok'); e.target.reset(); } catch (err) { toast(err.message, 'bad'); }
  };
}

// ---------------------------------------------------------------- Navigation
function route() {
  stopTimers();
  window.onbeforeunload = null;
  const [p, q] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(q || '');
  if (p === '/' || p === '') return viewDashboard();
  if (p === '/apps') return viewApps();
  if (p.startsWith('/app/')) return viewApp(decodeURIComponent(p.slice(5)));
  if (p === '/files') return viewFiles(params);
  if (p === '/alerts') return viewAlerts();
  if (p === '/journal') return viewJournal();
  if (p === '/settings') return viewSettings();
  return viewDashboard();
}
async function boot() {
  try { await api('/api/me'); route(); } catch { renderLogin(); }
}
window.addEventListener('hashchange', () => { if (document.querySelector('.shell')) route(); });
boot();
