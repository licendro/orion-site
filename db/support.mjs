// Horaires du support (partagés par le site et le bot). Heure de Paris.
export const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
export const HOURS_DEFAULT = {
  enabled: false,
  // Par jour (0 = dimanche) : plages « HH:MM-HH:MM », séparées par des virgules ; vide = fermé
  slots: { 0: '14:00-22:00', 1: '18:00-22:00', 2: '18:00-22:00', 3: '14:00-22:00', 4: '18:00-22:00', 5: '18:00-23:00', 6: '14:00-23:00' },
  note: 'Nous sommes une petite équipe : en dehors de ces horaires, l’assistant répond et l’équipe prend le relais dès son retour.',
};

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function parisNow(ts) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { day: WD[p.weekday], min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
const ranges = (str) => String(str || '').split(',').map((r) => /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(r)).filter(Boolean)
  .map((m) => [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]);

export function isOpen(h, ts = Date.now()) {
  if (!h?.enabled) return true;
  const { day, min } = parisNow(ts);
  return ranges(h.slots?.[day]).some(([a, b]) => (b > a ? min >= a && min < b : min >= a || min < b));
}
// Prochaine ouverture (pas de 15 min, 8 jours max)
export function nextOpen(h, ts = Date.now()) {
  if (!h?.enabled || isOpen(h, ts)) return ts;
  let t = Math.ceil(ts / 9e5) * 9e5;
  for (let i = 0; i < 8 * 96; i++, t += 9e5) if (isOpen(h, t)) return t;
  return null;
}
export const hoursText = (h) => DAYS.map((d, i) => [d, h.slots?.[i]]).filter(([, s]) => ranges(s).length).map(([d, s]) => `${d} : ${s.replace(/-/g, '–').replace(/,/g, ', ')}`).join('\n');
