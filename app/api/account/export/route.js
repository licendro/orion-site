import { NextResponse } from 'next/server';
import { getUser } from '../../../../lib/auth';
import { exportData } from '../../../../lib/account';

export const dynamic = 'force-dynamic';

// Téléchargement de toutes mes données (RGPD : accès et portabilité)
export async function GET() {
  const user = getUser();
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  return new NextResponse(JSON.stringify(exportData(user), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="orion-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
