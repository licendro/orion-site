import BugList from '../../components/BugList';
import { knownBugs, recentFixes } from '../../lib/bugs';

export const metadata = { title: 'Problèmes connus', description: 'Les bugs connus des scripts Orion, leur avancement et les dernières corrections.' };

export default function KnownIssues() {
  const open = knownBugs();
  const fixed = recentFixes();
  const discord = process.env.DISCORD_INVITE || '#';
  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ maxWidth: 900 }}>
        <div className="head" style={{ marginBottom: 28 }}>
          <div><span className="label"><i></i>Suivi des bugs</span><h2>Problèmes connus.</h2></div>
          <p className="sub">Ce qu’on corrige en ce moment, en toute transparence. Vous avez le même problème ? Cliquez « J’ai aussi ce bug » sous sa fiche dans #bug-report sur notre Discord : vous serez prévenu dès qu’il est corrigé.</p>
        </div>
        {open.length ? <BugList bugs={open} /> : <div className="empty">Aucun problème connu en ce moment. 🎉</div>}
        {fixed.length ? (<>
          <h3 style={{ margin: '40px 0 14px' }}>Corrigés récemment</h3>
          <BugList bugs={fixed.map((b) => ({ ...b, status: 'publie' }))} />
        </>) : null}
        <p className="muted" style={{ marginTop: 32 }}>Un bug qui n’est pas listé ? Signalez-le dans <b>#bug-report</b> ou ouvrez un ticket sur <a href={discord} target="_blank" rel="noopener">notre Discord</a>.</p>
      </div>
    </main>
  );
}
