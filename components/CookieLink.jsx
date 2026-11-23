'use client';
export default function CookieLink() {
  return <a href="#cookies" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('orion:cookies')); }}>Gestion des cookies</a>;
}
