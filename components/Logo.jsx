export function LogoMark() {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <ellipse cx="50" cy="50" rx="46" ry="18" transform="rotate(-24 50 50)" stroke="#EDEFF3" strokeWidth="4" />
      <circle cx="36" cy="56" r="6" fill="#EDEFF3" />
      <circle cx="50" cy="50" r="7" fill="#EDEFF3" />
      <circle cx="64" cy="44" r="6" fill="#EDEFF3" />
      <circle cx="64.7" cy="26.4" r="5.6" fill="#FF7A2F" />
    </svg>
  );
}

export function Brand({ style }) {
  return (
    <a className="brand" href="/" aria-label="Orion, accueil" style={style}>
      <LogoMark />
      <span>ORION</span>
    </a>
  );
}
