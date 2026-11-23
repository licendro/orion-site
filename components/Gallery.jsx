'use client';

import { useState } from 'react';

// Image principale + vignettes cliquables, et vidéo YouTube en premier si fournie.
export default function Gallery({ images, video, name, pos }) {
  const yt = youtubeId(video);
  const items = [...(yt ? [{ type: 'video', id: yt }] : []), ...images.map((src) => ({ type: 'img', src }))];
  const [i, setI] = useState(0);
  const cur = items[i] || items[0];
  return (
    <div className="gal">
      <div className="frame">
        <i className="tk a"></i><i className="tk d"></i>
        {cur?.type === 'video' ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${cur.id}?rel=0`} title={`Vidéo de ${name}`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy" />
        ) : (
          <img src={cur?.src} alt={`Aperçu de ${name}`} style={{ objectPosition: i === (yt ? 1 : 0) ? pos : undefined }} />
        )}
      </div>
      {items.length > 1 ? (
        <div className="thumbs" role="tablist" aria-label="Galerie">
          {items.map((it, k) => (
            <button key={k} role="tab" aria-selected={k === i} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={it.type === 'video' ? 'Vidéo' : `Image ${k + 1}`}>
              {it.type === 'video' ? <span className="play"><img src={`https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`} alt="" /><b>▶</b></span> : <img src={it.src} alt="" loading="lazy" />}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function youtubeId(url) {
  if (!url) return null;
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}
