import { getLegal, v } from '../../lib/legal';

export const metadata = { title: 'Mentions légales' };

export default function Legal() {
  const l = getLegal();
  const site = (process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');
  return (
    <main className="band legal-doc">
      <div className="wrap">
        <span className="label"><i></i>Informations légales</span>
        <h1>Mentions légales</h1>
        <p className="muted">Conformément aux articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN).</p>

        <h2>Éditeur du site</h2>
        <p>Le site <b>{site.replace(/^https?:\/\//, '')}</b> est édité par :<br />
          <b>{v(l.name)}</b>{l.brand ? <>, exerçant sous le nom commercial <b>{l.brand}</b></> : null}<br />
          {v(l.status)}<br />
          SIRET : {v(l.siret)}{l.registry ? <><br />{l.registry}</> : null}<br />
          Adresse : {v(l.address)}<br />
          E-mail : {l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : v('')}<br />
          Téléphone : {v(l.phone)}<br />
          {v(l.vat)}</p>
        <p>Directeur de la publication : {v(l.director)}.</p>

        <h2>Hébergement</h2>
        <p><b>{v(l.host_name)}</b><br />{v(l.host_address)}{l.host_phone ? <><br />Téléphone : {l.host_phone}</> : null}</p>

        <h2>Paiements et licences</h2>
        <p>Les paiements sont traités par <b>Tebex Limited</b> (Royaume-Uni), qui agit en tant que revendeur des produits vendus sur ce site. Les licences des scripts sont délivrées par la plateforme Cfx.re (Keymaster). Voir les <a href="/cgv">conditions générales de vente</a>.</p>

        <h2>Données personnelles et cookies</h2>
        <p>Voir la <a href="/confidentialite">politique de confidentialité</a>. Vous pouvez modifier vos choix de cookies à tout moment depuis le lien « Gestion des cookies » en bas de page.</p>

        <h2>Propriété intellectuelle</h2>
        <p>Les scripts, textes, visuels, logos et le code de ce site sont la propriété de l’éditeur. Toute reproduction, revente ou diffusion sans autorisation est interdite (articles L335-2 et suivants du Code de la propriété intellectuelle).</p>
        <p>{l.brand || 'Orion'} n’est affilié ni à Rockstar Games, ni à Take-Two Interactive, ni à Cfx.re. FiveM est une marque de Cfx.re ; GTA V est une marque de Rockstar Games. Ces noms sont cités uniquement pour indiquer la compatibilité des produits.</p>

        <h2>Médiation de la consommation</h2>
        <p>En cas de litige non résolu avec nous, vous pouvez recourir gratuitement au médiateur de la consommation : <b>{v(l.mediator_name)}</b>{l.mediator_url ? <> (<a href={l.mediator_url} target="_blank" rel="noopener">{l.mediator_url.replace(/^https?:\/\//, '')}</a>)</> : null}{l.mediator_address ? `, ${l.mediator_address}` : ''}.</p>
      </div>
    </main>
  );
}
