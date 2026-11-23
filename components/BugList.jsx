import { BUG_SEVERITY, BUG_STATUS, bugLabel } from '../db/bugs.mjs';

export default function BugList({ bugs, showProduct = true }) {
  return (
    <ul className="buglist">
      {bugs.map((b) => (
        <li key={b.id} className={`s-${b.status}`}>
          <span className="mono id">#{b.id}</span>
          <span className="t">{b.severity ? <span title={BUG_SEVERITY[b.severity]?.label}>{BUG_SEVERITY[b.severity]?.emoji} </span> : null}{b.title}
            {showProduct && b.product ? <small> · {b.product}</small> : null}</span>
          <span className="st">{BUG_STATUS[b.status]?.emoji} {bugLabel(b.status, b.fixed_version)}</span>
        </li>
      ))}
    </ul>
  );
}
