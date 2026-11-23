import { getDocs } from '../../lib/docs';
import DocsSearch from './DocsSearch';

export const metadata = { title: 'Documentation', description: 'Installer, configurer et mettre à jour les scripts Orion. Guides, compatibilité, dépannage.' };

export default async function DocsIndex() {
  const { docs, categories } = await getDocs();
  const list = docs.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary || '', category: d.category }));
  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap">
        <div className="head" style={{ marginBottom: 32 }}>
          <div><span className="label"><i></i>Documentation</span><h2>Tout pour installer et utiliser nos scripts.</h2></div>
          <p className="sub">Guides pas à pas, compatibilité, dépannage, et une page par script. Introuvable ici ? Ouvrez un ticket sur notre Discord.</p>
        </div>
        <DocsSearch docs={list} categories={categories} />
      </div>
    </main>
  );
}
