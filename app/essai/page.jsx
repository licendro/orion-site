import { getUser } from '../../lib/auth';
import { connectUrl, counts, processQueue, queuePosition, serverStatus, sessionOf, testConfig } from '../../lib/testserver';
import { releaseSlot, reserveSlot } from './actions';
import Countdown from './Countdown';

export const metadata = { title: 'Essayer nos scripts', description: 'Testez les scripts Orion sur notre serveur FiveM avant d’acheter.' };

export default async function Essai({ searchParams }) {
  processQueue();
  const cfg = testConfig();
  const user = getUser();
  const session = user ? sessionOf(user.discord_id) : null;
  const pos = queuePosition(session);
  const { active, waiting } = counts();
  const status = cfg.enabled ? await serverStatus() : null;
  const url = connectUrl(cfg.connect);

  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ maxWidth: 880 }}>
        <span className="label"><i></i>Serveur de test</span>
        <h2>Essayez nos scripts avant d’acheter.</h2>
        <p className="sub" style={{ margin: '14px 0 28px' }}>Réservez un créneau de {cfg.minutes} minutes sur notre serveur FiveM, où tous nos scripts sont installés. Les places sont limitées : quand c’est votre tour, le bouton de connexion apparaît ici et vous recevez un message sur Discord.</p>

        {searchParams?.ok ? <div className="flash" style={{ marginBottom: 18 }}>✓ {searchParams.ok}</div> : null}
        {searchParams?.err ? <div className="flash err" style={{ marginBottom: 18 }}>⚠ {searchParams.err}</div> : null}

        <div className="stats" style={{ marginBottom: 24 }}>
          <div className="stat"><span>Serveur</span><b style={{ fontSize: 20, color: !cfg.enabled ? 'var(--ink3)' : status?.online ? '#86efac' : status ? '#ffb38a' : 'var(--ink2)' }}>{!cfg.enabled ? 'Fermé' : status?.online ? 'En ligne' : status ? 'Hors ligne' : 'Ouvert'}</b></div>
          <div className="stat"><span>Places de test libres</span><b>{cfg.enabled ? Math.max(0, cfg.slots - active) : 0} / {cfg.slots}</b></div>
          <div className="stat"><span>File d’attente</span><b>{waiting}</b></div>
          <div className="stat"><span>Joueurs connectés</span><b>{status?.online ? `${status.players} / ${status.max}` : '—'}</b></div>
        </div>

        <div className="panel"><div className="pb" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!cfg.enabled ? (
            <p style={{ margin: 0 }}>Le serveur de test ouvre bientôt. Suivez <b>#annonces</b> sur notre Discord pour être prévenu.</p>
          ) : !user ? (
            <><p style={{ margin: 0 }}>Connectez-vous avec Discord pour réserver : c’est votre compte Discord qui vous donne accès au serveur.</p>
              <div><a className="btn pri" href="/api/auth/discord?next=/essai">Se connecter avec Discord</a></div></>
          ) : session?.status === 'active' ? (
            <>
              <p style={{ margin: 0, fontSize: 18 }}>C’est votre tour ! Temps restant : <b><Countdown until={session.ends_at} /></b></p>
              <div className="actions">
                {url ? <a className="btn pri" href={url}>Se connecter au serveur</a> : <span className="warn">L’adresse du serveur n’est pas encore configurée.</span>}
                <form action={releaseSlot}><button className="btn">J’ai fini, libérer ma place</button></form>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>FiveM doit être ouvert avec le même compte Discord relié. À la fin du créneau, vous serez déconnecté automatiquement.</p>
            </>
          ) : session?.status === 'waiting' ? (
            <>
              <p style={{ margin: 0, fontSize: 18 }}>Vous êtes <b>{pos}{pos === 1 ? 'er' : 'e'}</b> dans la file. Gardez cette page ouverte ou surveillez vos messages Discord.</p>
              <form action={releaseSlot}><button className="btn">Annuler ma réservation</button></form>
            </>
          ) : (
            <><p style={{ margin: 0 }}>Une place se libère toutes les {cfg.minutes} minutes environ. Deux créneaux maximum par jour.</p>
              <form action={reserveSlot}><button className="btn pri">Réserver un créneau</button></form></>
          )}
        </div></div>
      </div>
      {session ? <meta httpEquiv="refresh" content="30" /> : null}
    </main>
  );
}
