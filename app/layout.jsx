// Polices hébergées sur notre serveur (aucune requête vers Google : conforme RGPD)
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/inter-tight/700.css';
import '@fontsource/michroma/400.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './globals.css';
import { headers } from 'next/headers';
import { getCatalog } from '../lib/catalog';
import { db, getSetting } from '../lib/db';
import { avatarUrl, discordConfigured, getUser, isAdmin } from '../lib/auth';
import { ShopProvider } from '../components/Shop';
import { Footer } from '../components/Chrome';
import NavBar from '../components/NavBar';
import Consent from '../components/Consent';
import { Brand } from '../components/Logo';
import SpaceLayer from '../components/Space';

const SITE = process.env.SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Orion Scripts · Scripts FiveM ESX, QBCore et QBox', template: '%s · Orion Scripts' },
  description: 'Scripts FiveM premium avec une interface commune : menus, ciblage, banque, garage, police. Compatibles ESX, QBCore et QBox, livrés dans votre Keymaster.',
  icons: { icon: '/favicon.svg', apple: '/logo.png' },
  openGraph: { type: 'website', siteName: 'Orion Scripts', locale: 'fr_FR', images: ['/img/garage.jpg'] },
  twitter: { card: 'summary_large_image' },
};

export const viewport = { themeColor: '#030407', viewportFit: 'cover' };
export const dynamic = 'force-dynamic';

function Maintenance({ message, until, discord }) {
  return (
    <main className="wrap center" style={{ minHeight: '100vh' }}>
      <Brand />
      <span className="label" style={{ marginBottom: 0 }}><i></i>Maintenance</span>
      <h2>On améliore la boutique.</h2>
      <p className="sub" style={{ margin: 0 }}>{message || 'Le site revient très vite. Vos scripts restent disponibles dans votre Keymaster.'}</p>
      {until ? <p className="muted mono" style={{ margin: 0 }}>Retour prévu : {until}</p> : null}
      <a className="btn" href={discord} target="_blank" rel="noopener">Suivre sur Discord</a>
    </main>
  );
}

export default async function RootLayout({ children }) {
  const user = getUser();
  const admin = isAdmin(user);
  const discord = process.env.DISCORD_INVITE || 'https://discord.com';
  const path = headers().get('x-orion-path') || '';
  const maintenance = getSetting('maintenance', false);
  const inAdmin = path.startsWith('/admin');

  const head = (
    <head />
  );

  if (maintenance && !admin) {
    return (
      <html lang="fr">{head}<body><Maintenance message={getSetting('maintenance_message', '')} until={getSetting('maintenance_until', '')} discord={discord} /></body></html>
    );
  }

  const { products, mode } = await getCatalog();
  const custom = getSetting('top_banner', '');
  const banner = maintenance && admin
    ? '⚠ Maintenance active : seuls les admins voient le site.'
    : custom || process.env.TOP_BANNER || (mode === 'demo' ? 'Boutique en préparation · ouverture des paiements très bientôt' : mode === 'error' ? 'Catalogue momentanément indisponible, réessayez dans quelques minutes.' : '');
  const u = user ? { name: user.username, avatar: avatarUrl(user) } : null;
  const owned = user ? db().prepare(`SELECT DISTINCT oi.product_key k FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE (o.user_id = ? OR o.discord_id = ?) AND o.status = 'paid'`).all(user.id, user.discord_id).map((r) => r.k) : [];

  return (
    <html lang="fr">
      {head}
      <body className={inAdmin ? 'adm' : 'site'}>
        <SpaceLayer off={inAdmin} />
        <ShopProvider products={products} mode={mode} user={u} owned={owned} loginRequired={discordConfigured() && !user}>
          {inAdmin ? children : (
            <>
              <NavBar user={u} admin={admin} canLogin={discordConfigured()} discord={discord} />
              {banner ? <div className="demo">{banner}</div> : null}
              {children}
              <Footer discord={discord} />
              <Consent />
            </>
          )}
        </ShopProvider>
      </body>
    </html>
  );
}
