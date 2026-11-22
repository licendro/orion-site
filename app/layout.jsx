import './globals.css';
import { getCatalog } from '../lib/catalog';
import { ShopProvider } from '../components/Shop';
import { Header, Footer } from '../components/Chrome';

const SITE = process.env.SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Orion Scripts · Scripts FiveM ESX, QBCore et QBox', template: '%s · Orion Scripts' },
  description: 'Scripts FiveM premium avec une interface commune : menus, ciblage, banque, garage, police. Compatibles ESX, QBCore et QBox, livrés dans votre Keymaster.',
  icons: { icon: '/favicon.svg' },
  openGraph: { type: 'website', siteName: 'Orion Scripts', locale: 'fr_FR', images: ['/img/garage.jpg'] },
  twitter: { card: 'summary_large_image' },
};

export const viewport = { themeColor: '#030407' };

export const revalidate = 300;

export default async function RootLayout({ children }) {
  const { products, mode } = await getCatalog();
  const banner = process.env.TOP_BANNER || (mode === 'demo' ? 'Boutique en préparation · ouverture des paiements très bientôt' : mode === 'error' ? 'Catalogue momentanément indisponible, réessayez dans quelques minutes.' : '');
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=Michroma&family=JetBrains+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <ShopProvider products={products} mode={mode}>
          <Header banner={banner} />
          {children}
          <Footer discord={process.env.DISCORD_INVITE || 'https://discord.com'} />
        </ShopProvider>
      </body>
    </html>
  );
}
