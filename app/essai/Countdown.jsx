'use client';

import { useEffect, useState } from 'react';

export default function Countdown({ until }) {
  const [left, setLeft] = useState(Math.max(0, until - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, until - Date.now());
      setLeft(l);
      if (l === 0) { clearInterval(t); window.location.reload(); }
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  const m = Math.floor(left / 60e3), s = Math.floor((left % 60e3) / 1000);
  return <span className="mono">{m}:{String(s).padStart(2, '0')}</span>;
}
