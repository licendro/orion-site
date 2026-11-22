import './globals.css';
import { headers } from 'next/headers';
import { getCatalog } from '../lib/catalog';
import { getSetting } from '../lib/db';
import { avatarUrl, discordConfigured, getUser, isAdmin } from '../lib/auth';
import { ShopProvider } from '../components/Shop';
import { Header, Footer } from '../components/Chrome';
import { Brand } from '../components/Logo';

const SITE = process.env.SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Orion Scripts · Scripts FiveM ESX, QBCore et QBox', template: '%s · Orion Scripts' },
  description: 'Scripts FiveM premium avec une interface commune : menus, ciblage, banque, garage, police. Compatibles ESX, QBCore et QBox, livrés dans votre Keymaster.',
  icons: { icon: '/favicon.svg', apple: '/logo.png' },
  openGraph: { type: 'website', siteName: 'Orion Scripts', locale: 'fr_FR', images: ['/img/garage.jpg'] },
  twitter: { card: 'summary_large_image' },
};

export const viewport = { themeColor: '#030407' };
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
    <head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=Michroma&family=JetBrains+Mono:wght@400;500&display=swap" />
    </head>
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

  return (
    <html lang="fr">
      {head}
      <body>
        <ShopProvider products={products} mode={mode} user={u} loginRequired={discordConfigured() && !user}>
          {inAdmin ? children : (
            <>
              <Header banner={banner} user={u} admin={admin} canLogin={discordConfigured()} />
              {children}
              <Footer discord={discord} />
            </>
          )}
        </ShopProvider>
      </body>
    </html>
  );
}
