import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { getProduct } from '../../../lib/catalog';
import { uploadsDir } from '../../../lib/uploads';
import { eur } from '../../../lib/format';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Script Orion';

// Image locale → data URL (Satori ne lit pas le disque), image distante → URL telle quelle.
function src(img) {
  try {
    if (img.startsWith('/uploads/')) return dataUrl(path.join(uploadsDir(), path.basename(img)));
    if (img.startsWith('/')) return dataUrl(path.join(process.cwd(), 'public', img));
  } catch { return null; }
  return img;
}
function dataUrl(file) {
  const ext = path.extname(file).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;
}

export default async function OgImage({ params }) {
  const p = await getProduct(params.slug);
  const name = p?.name || 'Orion Scripts';
  const bg = p ? src(p.img) : null;
  const logo = dataUrl(path.join(process.cwd(), 'public', 'logo.png'));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#030407', color: '#EDEFF3', fontFamily: 'sans-serif' }}>
        {bg ? <img src={bg} width={1200} height={630} style={{ position: 'absolute', inset: 0, width: 1200, height: 630, objectFit: 'cover', opacity: 0.55 }} /> : null}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'linear-gradient(90deg, rgba(3,4,7,.96) 0%, rgba(3,4,7,.75) 45%, rgba(3,4,7,.15) 100%)' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <img src={logo} width={64} height={64} style={{ borderRadius: 12 }} />
            <div style={{ fontSize: 30, letterSpacing: 10 }}>ORION</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
            <div style={{ fontSize: 26, color: '#FF7A2F' }}>{p?.catName || 'Scripts FiveM'}</div>
            <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{name}</div>
            {p?.desc ? <div style={{ fontSize: 30, color: '#B4B9C4', lineHeight: 1.3 }}>{p.desc.slice(0, 110)}</div> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            {p ? <div style={{ fontSize: 44, fontWeight: 700 }}>{eur(p.price)}</div> : null}
            {p?.was ? <div style={{ fontSize: 30, color: '#7E8492', textDecoration: 'line-through' }}>{eur(p.was)}</div> : null}
            {p?.was ? <div style={{ fontSize: 26, background: '#FF7A2F', color: '#120700', padding: '4px 12px' }}>−{p.pct} %</div> : null}
            <div style={{ fontSize: 24, color: '#7E8492', marginLeft: 'auto' }}>ESX · QBCore · QBox</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
