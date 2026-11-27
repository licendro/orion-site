import { guard } from '../guard';
import { db, getSetting } from '../../../lib/db';
import { saveAiSettings } from '../actions';
import { Flash, Head } from '../ui';

const DEF = { enabled: true, executor: 'claude-haiku-5-5', advisor: 'claude-opus-5-5', advisor_enabled: true, advisor_daily_limit: 15, daily_limit: 150, web_search: true, max_turns: 6, instructions: '' };

export default function AiAdmin({ searchParams }) {
  guard('ai');
  const s = { ...DEF, ...(getSetting('ai_settings', {}) || {}) };
  const keyOk = !!(process.env.ANTHROPIC_API_KEY || '').trim();
  const days = [...Array(7)].map((_, i) => new Date(Date.now() - i * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }));
  const usage = days.map((d) => ({ d, ...(getSetting(`ai_usage_${d}`, {}) || {}) }));
  const docs = db().prepare('SELECT COUNT(*) n FROM docs WHERE published = 1').get().n;
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
        </div>
        <label>Modèle qui répond<select className="field" name="executor" defaultValue={s.executor}><option value="claude-haiku-5-5">Claude Haiku 5.5 (rapide, le moins cher)</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5 (plus fort, plus cher)</option></select></label>
        <label>Conseiller<select className="field" name="advisor" defaultValue={s.advisor}><option value="claude-opus-5-5">Claude Opus 5.5</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option></select></label>
        <label>Réponses IA max par jour <span className="hint">Au-delà : assistant gratuit</span><input className="field" type="number" name="daily_limit" min="0" defaultValue={s.daily_limit} /></label>
        <label>Appels au conseiller max par jour<input className="field" type="number" name="advisor_daily_limit" min="0" defaultValue={s.advisor_daily_limit} /></label>
        <label>Réponses IA par ticket avant de passer la main<input className="field" type="number" name="max_turns" min="1" defaultValue={s.max_turns} /></label>
        <div className="full"><button className="btn pri">Enregistrer</button></div>
      </form></div>

      <div className="panel"><h2>Consommation (7 jours)</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Jour</th><th>Réponses IA</th><th>Appels Opus</th><th>Recherches web</th><th>Tokens entrée</th><th>dont en cache</th><th>Tokens sortie</th><th>Transferts</th></tr></thead>
        <tbody>{usage.map((u) => (
          <tr key={u.d}><td className="mono">{u.d}</td><td>{u.replies || 0}</td><td>{u.advisor || 0}</td><td>{u.searches || 0}</td><td>{(u.input || 0).toLocaleString('fr-FR')}</td><td>{(u.cached || 0).toLocaleString('fr-FR')}</td><td>{(u.output || 0).toLocaleString('fr-FR')}</td><td>{u.transfers || 0}</td></tr>
        ))}</tbody>
      </table></div>
      <p className="pb muted" style={{ fontSize: 13.5, margin: 0 }}>Le coût exact (facturé en dollars) est sur console.anthropic.com → Usage. Pour le limiter : garde Haiku, un plafond quotidien bas, et mets une limite de dépense mensuelle dans la console. L’IA s’appuie sur {docs} pages de doc : plus elles sont complètes (Admin → Documentation), meilleures sont ses réponses.</p></div>
    </>
  );
}
