import { guard } from '../guard';
import { getLegal } from '../../../lib/legal';
import { LEGAL_FIELDS } from '../../../content/legal';
import { saveLegal } from '../actions';
import { Flash, Head } from '../ui';

export default function Legal({ searchParams }) {
  guard('settings');
  const l = getLegal();
  return (
    <>
      <Head title="Infos légales" sub="Affichées dans les mentions légales, les CGV et la politique de confidentialité. Obligatoires pour vendre en France.">
        <a className="btn sm" href="/mentions-legales" target="_blank">Voir les mentions</a>
      </Head>
      <Flash searchParams={searchParams} />
      {l.missing.length ? <div className="flash err">⚠ À compléter : {l.missing.join(', ')}. Tant que c’est vide, les pages légales affichent « [à compléter] ».</div> : <div className="flash">✓ Tout est rempli.</div>}
      <div className="panel">
        <form action={saveLegal} className="pb frm">
          {LEGAL_FIELDS.map(([k, label, hint, req]) => (
            <label key={k} className={k === 'address' || k === 'host_address' || k === 'mediator_address' ? 'full' : ''}>
              {label}{req ? ' *' : ''} {hint ? <span className="hint">{hint}</span> : null}
              <input className="field" name={k} defaultValue={l[k] === 'Orion Scripts' && k === 'brand' ? 'Orion Scripts' : l[k]} maxLength={300} />
            </label>
          ))}
          <div className="full actions"><button className="btn pri">Enregistrer</button></div>
        </form>
      </div>
      <p className="muted" style={{ fontSize: 13.5 }}>Je ne suis pas juriste : ces pages couvrent les obligations habituelles d’une petite boutique en ligne française (LCEN, Code de la consommation, RGPD). Fais-les relire si ton activité grossit.</p>
    </>
  );
}
