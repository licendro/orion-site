import { getCatalog } from '../../../lib/catalog';
import { json } from '../../../lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { mode, products } = await getCatalog();
  return json({ ok: true, mode, products: products.length, time: new Date().toISOString() });
}
