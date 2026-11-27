import { guard } from '../guard';
import { db, getSetting } from '../../../lib/db';
import { deleteMemory, saveAiSettings, saveMemory } from '../actions';
import { Flash, Head } from '../ui';

const DEF = { learning: true, enabled: true, executor: 'claude-haiku-5-5', advisor: 'claude-opus-5-5', advisor_enabled: true, advisor_daily_limit: 15, daily_limit: 150, web_search: true, max_turns: 6, instructions: '' };

export default function AiAdmin({ searchParams }) {
  guard('ai');
  const s = { ...DEF, ...(getSetting('ai_settings', {}) || {}) };
  const keyOk = !!(process.env.ANTHROPIC_API_KEY || '').trim();
  const days = [...Array(7)].map((_, i) => new Date(Date.now() - i * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }));
  const usage = days.map((d) => ({ d, ...(getSetting(`ai_usage_${d}`, {}) || {}) }));
  const docs = db().prepare('SELECT COUNT(*) n FROM docs WHERE published = 1').get().n;
  const q = String(searchParams?.q || '').trim();
  const mems = db().prepare(`SELECT * FROM ai_memory ${q ? 'WHERE title LIKE ? OR content LIKE ? OR keywords LIKE ?' : ''} ORDER BY CASE status WHEN 'valide' THEN 0 ELSE 1 END, updated_at DESC LIMIT 100`)
    .all(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : []));
  const mstats = db().prepare("SELECT COUNT(*) n, SUM(status = 'valide') v, SUM(uses) u FROM ai_memory").get();
  const clients = db().prepare('SELECT COUNT(*) n FROM ai_client_notes').get().n;
  const SRC = { equipe: 'appris de l’équipe', ia_resolu: 'résolu par l’IA', manuel: 'écrit à la main' };
  return (
    <>
      <Head title="Assistant IA" sub="L’IA répond dans les tickets : Claude Haiku pour toutes les réponses, Claude Opus consulté seulement en dernier recours. Elle lit la doc, le règlement et les achats du client à la demande (pas tout à chaque message), et peut chercher sur internet." />
      <Flash searchParams={searchParams} />
      {!keyOk ? <div className="flash err">Aucune clé API : ajoute <code>ANTHROPIC_API_KEY=…</code> dans le .env du site (lu aussi par le bot), puis <code>pm2 restart orion-bot</code>. En attendant, l’assistant gratuit (recherche dans la doc) répond.</div> : null}
      <div className="panel"><form action={saveAiSettings} className="pb frm">
        <label className="full">Consignes pour l’IA <span className="hint">Ce que tu lui dirais à l’oral : ton, infos à jour, choses à ne jamais faire, promos en cours… Prioritaires sur ses consignes de base (sauf sécurité).</span>
          <textarea name="instructions" maxLength={6000} defaultValue={s.instructions} style={{ minHeight: 200 }} placeholder={'Exemples :\n- Propose toujours le serveur de test avant un achat.\n- Les délais de réponse de l’équipe sont plus longs ce week-end.\n- orn_bank 2.0 sort le 15 décembre, ne donne pas d’autre date.\n- Ne parle jamais des scripts d’autres créateurs.'} />
        </label>
        <div className="full chks">
          <label className="chk"><input type="checkbox" name="enabled" defaultChecked={s.enabled} /> IA activée</label>
          <label className="chk"><input type="checkbox" name="advisor_enabled" defaultChecked={s.advisor_enabled} /> Conseiller (Opus) en dernier recours</label>
          <label className="chk"><input type="checkbox" name="web_search" defaultChecked={s.web_search} /> Recherche internet</label>
          <label className="chk"><input type="checkbox" name="learning" defaultChecked={s.learning} /> Apprendre des tickets résolus</label>
        </div>
        <label>Modèle qui répond<select className="field" name="executor" defaultValue={s.executor}><option value="claude-haiku-5-5">Claude Haiku 5.5 (rapide, le moins cher)</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5 (plus fort, plus cher)</option></select></label>
        <label>Conseiller<select className="field" name="advisor" defaultValue={s.advisor}><option value="claude-opus-5-5">Claude Opus 5.5</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option></select></label>
        <label>Réponses IA max par jour <span className="hint">Au-delà : assistant gratuit</span><input className="field" type="number" name="daily_limit" min="0" defaultValue={s.daily_limit} /></label>
        <label>Appels au conseiller max par jour<input className="field" type="number" name="advisor_daily_limit" min="0" defaultValue={s.advisor_daily_limit} /></label>
        <label>Réponses IA par ticket avant de passer la main<input className="field" type="number" name="max_turns" min="1" defaultValue={s.max_turns} /></label>
        <div className="full"><button className="btn pri">Enregistrer</button></div>
      </form></div>

      <div className="panel"><h2>Consommation (7 jours)</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Jour</th><th>Réponses IA</th><th>Appels Opus</th><th>Recherches web</th><th>Tokens entrée</th><th>dont en cache</th><th>Tokens sortie</th><th>Appris</th><th>Transferts</th></tr></thead>
        <tbody>{usage.map((u) => (
          <tr key={u.d}><td className="mono">{u.d}</td><td>{u.replies || 0}</td><td>{u.advisor || 0}</td><td>{u.searches || 0}</td><td>{(u.input || 0).toLocaleString('fr-FR')}</td><td>{(u.cached || 0).toLocaleString('fr-FR')}</td><td>{(u.output || 0).toLocaleString('fr-FR')}</td><td>{u.learned || 0}</td><td>{u.transfers || 0}</td></tr>
        ))}</tbody>
      </table></div>
      <p className="pb muted" style={{ fontSize: 13.5, margin: 0 }}>Le coût exact (facturé en dollars) est sur console.anthropic.com → Usage. Pour le limiter : garde Haiku, un plafond quotidien bas, et mets une limite de dépense mensuelle dans la console. L’IA s’appuie sur {docs} pages de doc : plus elles sont complètes (Admin → Documentation), meilleures sont ses réponses.</p></div>

      <div className="panel" id="cerveau">
        <h2>🧠 Cerveau ({mstats.v || 0} souvenirs actifs · utilisés {mstats.u || 0} fois · {clients} profils clients)</h2>
        <p className="pb muted" style={{ fontSize: 13.5, margin: 0 }}>À la fin de chaque ticket résolu, l’IA retient ce qui peut servir à d’autres clients (problème → solution), et relie les souvenirs proches entre eux. À chaque message, seuls les souvenirs utiles lui sont envoyés : elle n’a jamais tout à relire. Elle n’apprend que de ce que l’équipe a dit ou de ce qu’un client a confirmé comme résolu. Corrige ou supprime ici tout souvenir faux.</p>
        <form className="pb actions" method="get" style={{ flexWrap: 'wrap' }}>
          <input className="field" name="q" defaultValue={q} placeholder="Chercher dans le cerveau" style={{ minWidth: 240 }} />
          <button className="btn sm">Chercher</button>
        </form>
        <div className="mems">
          {mems.length ? mems.map((m) => (
            <details key={m.id} className={`mem s-${m.status}`}>
              <summary><span className="mono">#{m.id}</span> <b>{m.title}</b> <span className="muted">· {m.kind} · {SRC[m.source] || m.source} · utilisé {m.uses}×{m.links ? ` · lié à #${m.links.split(',').join(', #')}` : ''}{m.status !== 'valide' ? ' · archivé' : ''}</span></summary>
              <form action={saveMemory} className="frm">
                <input type="hidden" name="id" value={m.id} /><input type="hidden" name="q" value={q} />
                <label className="full">Titre<input className="field" name="title" defaultValue={m.title} maxLength={120} /></label>
                <label className="full">Contenu<textarea name="content" defaultValue={m.content} maxLength={600} /></label>
                <label>Mots-clés<input className="field" name="keywords" defaultValue={m.keywords} /></label>
                <label>Liens (n° des souvenirs liés)<input className="field mono" name="links" defaultValue={m.links} /></label>
                <label>Type<select className="field" name="kind" defaultValue={m.kind}><option value="solution">Solution</option><option value="faq">Question fréquente</option><option value="fait">Fait</option></select></label>
                <label>Statut<select className="field" name="status" defaultValue={m.status === 'valide' ? 'valide' : 'archive'}><option value="valide">Actif</option><option value="archive">Archivé (plus utilisé)</option></select></label>
                <div className="full actions"><button className="btn sm pri">Enregistrer</button></div>
              </form>
              <form action={deleteMemory}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="q" value={q} /><button className="btn sm danger">Supprimer</button></form>
            </details>
          )) : <p className="pb muted">{q ? 'Aucun souvenir trouvé.' : 'Le cerveau est vide : il se remplira au fil des tickets résolus. Tu peux aussi lui apprendre des choses ci-dessous.'}</p>}
        </div>
        <form action={saveMemory} className="pb frm" style={{ borderTop: '1px solid var(--line)' }}>
          <b className="full">Apprendre quelque chose à l’IA</b>
          <label className="full">Titre<input className="field" name="title" maxLength={120} placeholder="ex. Erreur « You lack the required entitlement »" /></label>
          <label className="full">Ce qu’elle doit savoir<textarea name="content" maxLength={600} placeholder="ex. Le compte Cfx.re du serveur n’est pas celui qui a acheté : changer la clé de licence du serveur sur portal.cfx.re, puis redémarrer." /></label>
          <label>Mots-clés<input className="field" name="keywords" placeholder="entitlement escrow keymaster" /></label>
          <label>Liens (n° de souvenirs)<input className="field mono" name="links" /></label>
          <input type="hidden" name="kind" value="fait" /><input type="hidden" name="status" value="valide" />
          <div className="full"><button className="btn pri">Ajouter au cerveau</button></div>
        </form>
      </div>
    </>
  );
}
