export const metadata = { title: 'Mentions légales' };

export default function Legal() {
  const name = process.env.LEGAL_NAME || 'Orion Scripts';
  const email = process.env.LEGAL_EMAIL;
  const discord = process.env.DISCORD_INVITE || 'https://discord.com';
  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2>Mentions légales</h2>
        <section><h3 style={{ fontSize: 20 }}>Éditeur</h3><p className="muted">{name}{email ? ` · ${email}` : ''} · contact via <a href={discord}>notre Discord</a>.</p></section>
        <section><h3 style={{ fontSize: 20 }}>Paiements</h3><p className="muted">Les paiements sont traités par Tebex Limited, revendeur officiel des produits vendus sur ce site. Les licences sont délivrées par Cfx.re (Keymaster).</p></section>
        <section><h3 style={{ fontSize: 20 }}>Données personnelles</h3><p className="muted">La connexion Discord sert uniquement à relier vos achats à votre compte (identifiant, pseudo et avatar Discord) et à vous donner accès à notre serveur. Aucune donnée bancaire n'est stockée sur ce site. Pour supprimer vos données, contactez-nous sur Discord.</p></section>
        <section><h3 style={{ fontSize: 20 }}>Propriété</h3><p className="muted">Orion n'est affilié ni à Rockstar Games, ni à Take-Two Interactive, ni à Cfx.re. Les scripts restent la propriété d'Orion ; leur revente ou diffusion est interdite.</p></section>
      </div>
    </main>
  );
}
