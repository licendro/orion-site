import { getSetting } from '../../../lib/db';
import { saveMaintenance } from '../actions';
import { Flash, Head } from '../ui';

export default function Maintenance({ searchParams }) {
  const on = getSetting('maintenance', false);
  return (
    <>
      <Head title="Maintenance" sub="Le site public affiche une page d’attente. Toi et les admins voyez toujours le site, et les paiements Tebex continuent d’arriver." />
      <Flash searchParams={searchParams} />
      <div className="panel">
        <h2>État : {on ? <span className="pill2 warn">Maintenance active</span> : <span className="pill2 ok">En ligne</span>}</h2>
        <form action={saveMaintenance} className="pb frm">
          <div className="full chks"><label className="chk"><input type="checkbox" name="on" defaultChecked={on} /> Activer la maintenance</label></div>
          <label className="full">Message affiché<textarea name="message" maxLength={300} defaultValue={getSetting('maintenance_message', '')} placeholder="Le site revient très vite. Vos scripts restent disponibles dans votre Keymaster." /></label>
          <label>Retour prévu <span className="hint">Texte libre</span><input className="field" name="until" maxLength={60} defaultValue={getSetting('maintenance_until', '')} placeholder="ce soir 21 h" /></label>
          <div className="chks" style={{ alignSelf: 'end' }}><label className="chk"><input type="checkbox" name="announce" /> Prévenir sur Discord (#annonces)</label></div>
          <div className="full"><button className="btn pri">Enregistrer</button></div>
        </form>
      </div>
    </>
  );
}
