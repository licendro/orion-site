'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  ['/admin', 'Tableau de bord'],
  ['sep', 'Boutique'],
  ['/admin/produits', 'Produits'],
  ['/admin/promotions', 'Promotions'],
  ['/admin/codes', 'Codes promo'],
  ['/admin/commandes', 'Commandes'],
  ['/admin/clients', 'Clients'],
  ['sep', 'Discord'],
  ['/admin/mises-a-jour', 'Mises à jour'],
  ['/admin/annonces', 'Annonces'],
  ['sep', 'Site'],
  ['/admin/devis', 'Devis'],
  ['/admin/maintenance', 'Maintenance'],
  ['/admin/reglages', 'Réglages'],
  ['/admin/journal', 'Journal'],
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="adm-nav" aria-label="Admin">
      {LINKS.map(([href, label], i) =>
        href === 'sep' ? <span className="sep" key={i}>{label}</span> : (
          <a key={href} href={href} className={(href === '/admin' ? path === href : path.startsWith(href)) ? 'on' : ''}>{label}</a>
        ))}
      <span className="sep">&nbsp;</span>
      <a href="/">← Voir le site</a>
    </nav>
  );
}
