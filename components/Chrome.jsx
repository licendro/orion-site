import { Brand } from './Logo';
import CookieLink from './CookieLink';

export function Footer({ discord }) {
  const year = new Date().getFullYear();
  return (
    <footer>
      <div className="wrap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Brand style={{ padding: 0 }} />
          <p className="muted" style={{ margin: 0, fontSize: 14, maxWidth: 300 }}>Studio de scripts FiveM. Paiements par Tebex, licences par Cfx.re Keymaster.</p>
        </div>
        <div><h5>Boutique</h5><a href="/scripts">Tous les scripts</a><a href="/scripts#packs">Packs</a><a href="/compte">Mes scripts</a></div>
        <div><h5>Services</h5><a href="/services#sur-mesure">Sur mesure</a><a href="/services#partenariat">Développeur partenaire</a><a href="/services#bot">Bot Discord</a><a href="/services#devis">Demander un devis</a></div>
        <div><h5>Aide</h5><a href="/docs">Documentation</a><a href="/changelog">Changelog</a><a href="/idees">Proposer une idée</a><a href="/bugs">Problèmes connus</a><a href="/essai">Serveur de test</a><a href="/faq">FAQ</a><a href="/compte">Mon compte</a></div>
        <div><h5>Communauté</h5><a href={discord} rel="noopener" target="_blank">Discord</a><a href="https://portal.cfx.re" rel="noopener" target="_blank">Keymaster</a><h5 style={{ marginTop: 18 }}>Légal</h5><a href="/mentions-legales">Mentions légales</a><a href="/cgv">CGV</a><a href="/confidentialite">Confidentialité</a><CookieLink /></div>
      </div>
      <div className="wrap legal"><span>© {year} Orion. Non affilié à Rockstar Games, Take-Two ou Cfx.re.</span><span>Paiements sécurisés par Tebex.</span></div>
    </footer>
  );
}
