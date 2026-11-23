import { redirect } from 'next/navigation';
import { can, getRole, getUser } from '../../lib/auth';

// À appeler en haut de chaque page admin : renvoie au tableau de bord si le rôle n'a pas accès.
export function guard(perm) {
  const role = getRole(getUser());
  if (!can(role, perm)) redirect(`/admin?err=${encodeURIComponent('Ton rôle ne donne pas accès à cette page.')}#flash`);
  return role;
}
