'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '../../lib/auth';
import { deleteAccount } from '../../lib/account';
import { forgetMember, setLicenceIp } from '../../lib/licences';

export async function deleteMyAccount(fd) {
  const user = getUser();
  if (!user) redirect('/');
  if (String(fd.get('confirm') || '').trim().toUpperCase() !== 'SUPPRIMER') redirect('/compte?err=confirm#donnees');
  await forgetMember(user.discord_id).catch(() => {}); // licences détachées du compte, toujours valables
  deleteAccount(user);
  for (const c of cookies().getAll()) if (c.name.startsWith('orion')) cookies().delete(c.name);
  redirect('/?compte=supprime');
}

// Changer l'IP liée à une licence (1 fois tous les 7 jours, contrôlé par l'API)
export async function changeMyIp(fd) {
  const user = getUser();
  if (!user) redirect('/');
  const id = Number(fd.get('id'));
  const ip = String(fd.get('ip') || '').trim();
  let msg;
  try {
    await setLicenceIp(id, { ip: ip || null, by: 'client', discord_id: user.discord_id });
    msg = ip ? 'ok=IP modifiée' : 'ok=IP déliée : elle se liera au prochain démarrage de ton serveur';
  } catch (e) {
    msg = `err=${e.data?.next ? `Déjà changée cette semaine. Prochain changement possible le ${new Date(e.data.next).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.` : e.message}`;
  }
  redirect(`/compte?${msg.split('=')[0]}=${encodeURIComponent(msg.split('=').slice(1).join('='))}#licences`);
}
