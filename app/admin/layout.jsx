import { notFound, redirect } from 'next/navigation';
import { PERMS, ROLE_LABEL, avatarUrl, getRole, getUser } from '../../lib/auth';
import { Brand } from '../../components/Logo';
import Nav from './Nav';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }) {
  const user = getUser();
  if (!user) redirect('/api/auth/discord?next=/admin');
  const role = getRole(user);
  if (!role) notFound();
  return (
    <div className="adm">
      <aside className="adm-side">
        <Brand />
        <Nav perms={PERMS[role]} />
        <div className="adm-me"><img src={avatarUrl(user)} alt="" width="26" height="26" /><span>{user.username}<br /><small className="muted">{ROLE_LABEL[role]}</small></span></div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
