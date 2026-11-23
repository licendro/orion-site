import { OFFERS, A_LA_CARTE } from '../../content/services';
import QuoteForm, { QuoteButton } from '../../components/QuoteForm';
import { SubscribeButton } from '../../components/Shop';
import { getCatalog } from '../../lib/catalog';
import { keyOf } from '../../lib/format';
import { getUser } from '../../lib/auth';

export const metadata = {
  title: 'Services',
  description: 'Bot Discord, développeur partenaire pour votre serveur FiveM, scripts sur mesure : nos formules et nos tarifs.',
};

function Cell({ v }) {
  if (v === true) return <span className="yes" aria-label="Inclus">✓</span>;
  if (!v) return <span className="no" aria-label="Non inclus">—</span>;
  return <span className="val">{v}</span>;
}

function Offer({ o, subs }) {
  return (
    <section className="band offer" id={o.id} style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="head" style={{ marginBottom: 32 }}>
          <div><span className="label"><i></i>{o.label}</span><h2>{o.title}</h2></div>
          <p className="sub">{o.sub}</p>
        </div>
        <div className={`plans n${o.tiers.length}`}>
          {o.tiers.map((t) => (
            <article className={'plan' + (t.highlight ? ' feat' : '')} key={t.name}>
              {t.highlight ? <span className="tg">Le plus choisi</span> : <span className="tg" style={{ visibility: 'hidden' }} aria-hidden="true">·</span>}
              <h3>{t.name}</h3>
              <div className="pr"><b>{t.price}</b><span>{t.note}</span></div>
              <ul>
                {o.features.map(([k, label]) => (
                  <li key={k} className={t.features[k] ? '' : 'off'}><span>{label}</span><Cell v={t.features[k]} /></li>
                ))}
              </ul>
              {t.package && subs.has(keyOf(t.package))
                ? <SubscribeButton k={keyOf(t.package)} className={'btn' + (t.highlight ? ' pri' : '')}>S’abonner · {t.price}{t.note}</SubscribeButton>
                : <QuoteButton type={o.quote} className={'btn' + (t.highlight ? ' pri' : '')} tier={`${o.label} · ${t.name}`}>Choisir {t.name}</QuoteButton>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function Services() {
  const user = await getUser();
  const { products } = await getCatalog();
  const subs = new Set(products.filter((p) => p.subscription).map((p) => p.key));
  return (
    <main id="top">
      <section className="hero" style={{ paddingBottom: 'clamp(56px,8vw,96px)' }}>
        <div className="wrap" style={{ position: 'relative' }}>
          <span className="label"><i></i>Services</span>
          <h1 style={{ fontSize: 'clamp(40px,6.4vw,84px)' }}>Ce qu’on fait pour <span>votre serveur.</span></h1>
          <p className="sub">Les mêmes développeurs que nos scripts : bot Discord, développement au mois pour votre serveur, ou un script écrit pour vous. Tout reste cohérent avec le reste de votre serveur.</p>
          <div className="cta">
            {OFFERS.map((o) => <a key={o.id} className="btn" href={`#${o.id}`}>{o.label}</a>)}
          </div>
        </div>
      </section>

      {OFFERS.map((o) => <Offer o={o} key={o.id} subs={subs} />)}

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="carte" style={{ marginTop: 0 }}>
            <div><h3>À la carte</h3><p className="sub" style={{ fontSize: 16 }}>Pour un besoin ponctuel. Le prix final dépend de la taille du travail ; le devis est gratuit.</p></div>
            <div className="rows">
              {A_LA_CARTE.map(([a, b, c]) => <div className="rw" key={a}><b>{a}</b><span className="p">{b}</span><span className="d">{c}</span></div>)}
            </div>
          </div>

          <div className="steps">
            <div className="step"><b>Devis gratuit</b><p>Vous décrivez le besoin, on répond sous 24 h avec un prix et un délai.</p></div>
            <div className="step"><b>Acompte de 50 %</b><p>Le travail commence à la réception de l'acompte (partenariat : premier mois).</p></div>
            <div className="step"><b>Test sur votre serveur</b><p>Vous essayez avant le solde. Les retouches demandées sont incluses.</p></div>
            <div className="step"><b>Livraison</b><p>Solde réglé, fichiers livrés, corrections gratuites selon la formule.</p></div>
          </div>

          <div className="quote" id="devis">
            <div><h3>Demander un devis</h3><p className="sub" style={{ fontSize: 16 }}>Choisissez une formule ci-dessus ou décrivez votre besoin. Un ticket privé s’ouvre sur notre Discord, on vous y répond sous 24 h.</p></div>
            <QuoteForm user={user ? { username: user.username } : null} />
          </div>
        </div>
      </section>
    </main>
  );
}
