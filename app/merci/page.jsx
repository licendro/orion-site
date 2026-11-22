import ClearCart from './ClearCart';

export const metadata = { title: 'Merci pour votre achat', robots: { index: false } };

export default function Merci() {
  const discord = process.env.DISCORD_INVITE || 'https://discord.com';
  return (
    <main className="wrap center">
      <ClearCart />
      <span className="label" style={{ marginBottom: 0 }}><i></i>Paiement confirmé</span>
      <h2>Merci, c'est dans votre Keymaster.</h2>
      <p className="sub" style={{ margin: 0 }}>Vos scripts apparaissent sur portal.cfx.re, dans « Granted assets », sur le compte FiveM utilisé au paiement. Rejoignez le Discord pour l'installation et le support.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <a className="btn pri" href="https://portal.cfx.re/assets/granted-assets" target="_blank" rel="noopener">Ouvrir le Keymaster</a>
        <a className="btn" href={discord} target="_blank" rel="noopener">Rejoindre le Discord</a>
      </div>
    </main>
  );
}
