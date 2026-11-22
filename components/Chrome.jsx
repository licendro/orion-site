import { Brand } from './Logo';
import { CartButton } from './Shop';

export function Header({ banner }) {
  return (
    <>
      {banner ? <div className="demo">{banner}</div> : null}
      <header className="nav">
        <div className="wrap">
          <Brand />
          <nav className="links" aria-label="Sections">
            <a href="/#plateforme">Plateforme</a>
            <a href="/#scripts">Scripts</a>
            <a href="/#pack">Packs</a>
            <a href="/#services">Services</a>
            <a href="/#faq">FAQ</a>
          </nav>
          <div className="navr">
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer({ discord }) {
  const year = new Date().getFullYear();
  return (
    <footer>
      <div className="wrap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Brand style={{ padding: 0 }} />
          <p className="muted" style={{ margin: 0, fontSize: 14, maxWidth: 300 }}>Studio de scripts FiveM. Paiements par Tebex, licences par Cfx.re Keymaster.</p>
        </div>
        <div><h5>Boutique</h5><a href="/#scripts">Tous les scripts</a><a href="/#pack">Packs</a><a href="/#plateforme">Plateforme</a></div>
        <div><h5>Services</h5><a href="/#services">Sur mesure</a><a href="/#services">Partenariat serveur</a><a href="/#services">Bot Discord</a><a href="/#devis">Demander un devis</a></div>
        <div><h5>Aide</h5><a href="/#faq">FAQ</a><a href="/#faq">Installation</a><a href="/#faq">Mises à jour</a></div>
        <div><h5>Communauté</h5><a href={discord} rel="noopener" target="_blank">Discord</a><a href="https://portal.cfx.re" rel="noopener" target="_blank">Keymaster</a></div>
      </div>
      <div className="wrap legal"><span>© {year} Orion. Non affilié à Rockstar Games, Take-Two ou Cfx.re.</span><span>Paiements sécurisés par Tebex.</span></div>
    </footer>
  );
}
