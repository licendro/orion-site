'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '../../lib/auth';
import { deleteAccount } from '../../lib/account';

export async function deleteMyAccount(fd) {
  const user = getUser();
  if (!user) redirect('/');
  if (String(fd.get('confirm') || '').trim().toUpperCase() !== 'SUPPRIMER') redirect('/compte?err=confirm#donnees');
  deleteAccount(user);
  for (const c of cookies().getAll()) if (c.name.startsWith('orion')) cookies().delete(c.name);
  redirect('/?compte=supprime');
}
