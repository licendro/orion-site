'use client';

import { useEffect, useState } from 'react';
import { allowed, getConsent, setConsent } from '../lib/consent';

// Image principale + vignettes cliquables, et vidéo YouTube en premier si fournie.
export default function Gallery({ images, video, name, pos }) {
  const yt = youtubeId(video);
  const items = [...(yt ? [{ type: 'video', id: yt }] : []), ...images.map((src) => ({ type: 'img', src }))];
  const [i, setI] = useState(0);
  // YouTube seulement avec accord (bandeau cookies ou clic sur « Lire la vidéo »)
  const [yt0k, setYtOk] = useState(false);
  useEffect(() => {
    setYtOk(allowed('youtube'));
    const on = (e) => setYtOk(!!e.detail?.youtube);
    window.addEventListener('orion:consent', on);
    return () => window.removeEventListener('orion:consent', on);
  }, []);
  const acceptYt = () => setConsent({ ...(getConsent() || { ref: false }), youtube: true });
  const cur = items[i] || items[0];
  return (
    <div className="gal">
      <div className="frame">
        <i className="tk a"></i><i className="tk d"></i>
        {cur?.type === 'video' && !yt0k ? (
          <div className="ytgate">
            <button className="btn pri" onClick={acceptYt}>▶ Lire la vidéo</button>
            <p>La vidéo est hébergée par YouTube (Google), qui peut déposer des cookies quand vous la lancez. <a href="/confidentialite#cookies">En savoir plus</a></p>
          </div>
        ) : cur?.type === 'video' ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${cur.id}?rel=0`} title={`Vidéo de ${name}`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy" />
        ) : (
          <img src={cur?.src} alt={`Aperçu de ${name}`} style={{ objectPosition: i === (yt ? 1 : 0) ? pos : undefined }} />
        )}
      </div>
      {items.length > 1 ? (
        <div className="thumbs" role="tablist" aria-label="Galerie">
          {items.map((it, k) => (
            <button key={k} role="tab" aria-selected={k === i} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={it.type === 'video' ? 'Vidéo' : `Image ${k + 1}`}>
              {it.type === 'video' ? <span className="play">{yt0k ? <img src={`https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`} alt="" /> : null}<b>▶</b></span> : <img src={it.src} alt="" loading="lazy" />}
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
