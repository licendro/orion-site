import { getUser } from '../../lib/auth';
import { listIdeas } from '../../lib/ideas';
import { getCatalog } from '../../lib/catalog';
import IdeaBoard from './IdeaBoard';

export const metadata = { title: 'Idées de scripts', description: 'Proposez vos idées de scripts FiveM et votez pour celles des autres. Les plus demandées sont développées par Orion.' };

export default async function Ideas() {
  const user = getUser();
  const { products } = await getCatalog();
  const ideas = listIdeas(user?.discord_id).map(({ description, ...x }) => ({ ...x, description: description?.slice(0, 600) || '' }));
  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="head" style={{ marginBottom: 28 }}>
          <div><span className="label"><i></i>Idées de la communauté</span><h2>Vous imaginez, on développe.</h2></div>
          <p className="sub">Proposez le script qui manque à votre serveur et votez pour les idées des autres. Les plus demandées passent en développement, et vous êtes prévenu sur Discord à chaque étape.</p>
        </div>
        <IdeaBoard ideas={ideas} logged={!!user} products={products.filter((p) => !p.subscription && !p.required).map((p) => ({ key: p.key, name: p.name }))} />
      </div>
    </main>
  );
}
