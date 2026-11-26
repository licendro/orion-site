'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  ['/admin', 'Tableau de bord', 'dashboard'],
  ['sep', 'Boutique'],
  ['/admin/produits', 'Produits', 'products'],
  ['/admin/promotions', 'Promotions', 'promotions'],
  ['/admin/codes', 'Codes promo', 'codes'],
  ['/admin/commandes', 'Commandes', 'orders'],
  ['/admin/clients', 'Clients', 'clients'],
  ['sep', 'Discord'],
  ['/admin/licences', 'Licences', 'licences'],
  ['/admin/mises-a-jour', 'Mises à jour', 'updates'],
  ['/admin/annonces', 'Annonces', 'announcements'],
  ['sep', 'Site'],
  ['/admin/docs', 'Documentation', 'docs'],
  ['/admin/bugs', 'Bugs', 'bugs'],
  ['/admin/idees', 'Idées', 'ideas'],
  ['/admin/devis', 'Devis', 'quotes'],
  ['/admin/essai', 'Serveur de test', 'test'],
  ['/admin/maintenance', 'Maintenance', 'maintenance'],
  ['/admin/equipe', 'Équipe', 'team'],
  ['/admin/reglages', 'Réglages', 'settings'],
  ['/admin/legal', 'Infos légales', 'settings'],
  ['/admin/journal', 'Journal', 'journal'],
];

export default function Nav({ perms = [] }) {
  const path = usePathname();
  // Liens autorisés pour ce rôle, sans intertitre vide
  const kept = LINKS.filter(([h, , perm]) => h === 'sep' || perms.includes(perm));
  const allowed = kept.filter(([h], i) => h !== 'sep' || (kept[i + 1] && kept[i + 1][0] !== 'sep'));
  return (
    <nav className="adm-nav" aria-label="Admin">
      {allowed.map(([href, label], i) =>
        href === 'sep' ? <span className="sep" key={i}>{label}</span> : (
          <a key={href} href={href} className={(href === '/admin' ? path === href : path.startsWith(href)) ? 'on' : ''}>{label}</a>
        ))}
      <span className="sep">&nbsp;</span>
      <a href="/">← Voir le site</a>
    </nav>
  );
}
