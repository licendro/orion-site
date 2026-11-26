import MarkdownIt from 'markdown-it';
import { KIND_LABEL } from '../lib/licences';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
// Lignes « + / ~ / - » des notes → liste à puces avec pastilles de couleur
function notesHtml(notes) {
  const lines = String(notes || '').split('\n');
  const conv = lines.map((l) => {
    const m = /^\s*([+~-])\s+(.*)$/.exec(l);
    if (!m) return l;
    const tag = m[1] === '+' ? 'add' : m[1] === '~' ? 'imp' : 'fix';
    return `- <<${tag}>>${m[2]}`;
  }).join('\n');
  return md.render(conv).replace(/&lt;&lt;(add|imp|fix)&gt;&gt;/g, (_, t) => `<i class="cdot cd-${t}"></i>`);
}
const date = (ms) => new Date(ms).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });

export function VersionEntry({ v, title, href }) {
  return (
    <article className="ver" id={`v${v.version}`}>
      <div className="ver-side">
        <a className="mono ver-n" href={`#v${v.version}`}>v{v.version}</a>
        <time>{date(v.date)}</time>
      </div>
      <div className="ver-body">
        {title ? <h3>{href ? <a href={href}>{title}</a> : title}</h3> : null}
        {v.kinds?.length ? <div className="vbadges">{v.kinds.map((k) => <span key={k} className={`vbadge k-${k}`}>{KIND_LABEL[k] || k}</span>)}</div> : null}
        <div className="md" dangerouslySetInnerHTML={{ __html: notesHtml(v.notes) }} />
      </div>
    </article>
  );
}
