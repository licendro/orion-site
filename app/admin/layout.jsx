import { notFound, redirect } from 'next/navigation';
import { avatarUrl, getUser, isAdmin } from '../../lib/auth';
import { Brand } from '../../components/Logo';
import Nav from './Nav';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }) {
  const user = getUser();
  if (!user) redirect('/api/auth/discord?next=/admin');
  if (!isAdmin(user)) notFound();
  return (
    <div className="adm">
      <aside className="adm-side">
        <Brand />
        <Nav />
        <div className="adm-me"><img src={avatarUrl(user)} alt="" width="26" height="26" />{user.username}</div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
