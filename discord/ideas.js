// Idées de scripts des joueurs : forum #suggestions + /idee + site (jdev-hub.fr/idees).
// Un post = une idée, votes 👍 / 👎 par boutons (partagés avec le site), statuts, MP aux votants quand ça avance.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, ModalBuilder,
  SlashCommandBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { IDEA_KIND, IDEA_STATUS, IDEA_TAG } from '../db/ideas.mjs';

export const IDEA_COMMANDS = [
  new SlashCommandBuilder().setName('idee').setDescription('Proposer une idée de script (formulaire rapide)'),
  new SlashCommandBuilder().setName('idees').setDescription('Les idées les plus demandées'),
];

const cooldown = new Map(); // 1 idée / 10 min / membre

export function createIdeas({ client, db, getCfg, isStaff }) {
  const cfg = () => getCfg();
  const eph = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, ...extra });
  const site = () => (process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');
  const get = (id) => db.prepare(`SELECT i.*, p.name product,
    (SELECT COUNT(*) FROM idea_votes v WHERE v.idea_id = i.id AND v.value > 0) up,
    (SELECT COUNT(*) FROM idea_votes v WHERE v.idea_id = i.id AND v.value < 0) down
    FROM ideas i LEFT JOIN products p ON p.key = i.product_key WHERE i.id = ?`).get(id);
  const forum = () => client.channels.fetch(cfg().channels.suggestions).catch(() => null);

  function embed(x) {
    const s = IDEA_STATUS[x.status] || IDEA_STATUS.nouvelle;
    const k = IDEA_KIND[x.kind] || IDEA_KIND.script;
    const released = x.released_key && db.prepare('SELECT name FROM products WHERE key = ?').get(x.released_key);
    return new EmbedBuilder().setColor(s.color).setTitle(`${k.emoji} Idée #${x.id} · ${x.title}`.slice(0, 256))
      .setDescription((x.description || '*Pas de détails.*').slice(0, 1800))
      .addFields(
        { name: 'Statut', value: `${s.emoji} **${s.label}**`, inline: true },
        { name: 'Votes', value: `👍 ${x.up} · 👎 ${x.down}`, inline: true },
        { name: 'Proposée par', value: x.author_id ? `<@${x.author_id}>` : x.author_name || '—', inline: true },
        ...(x.product ? [{ name: 'Script concerné', value: x.product, inline: true }] : []),
        ...(released ? [{ name: 'Disponible', value: `[${released.name}](${site()}/scripts/${x.released_key})`, inline: true }] : []),
        ...(x.note ? [{ name: 'Réponse de l’équipe', value: x.note.slice(0, 500) }] : []),
      )
      .setFooter({ text: `Votez aussi sur ${site().replace(/^https?:\/\//, '')}/idees` });
  }
  const row = (x) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`orion:idea:up:${x.id}`).setStyle(ButtonStyle.Success).setEmoji('👍').setLabel(String(x.up)).setDisabled(!IDEA_STATUS[x.status]?.open),
    new ButtonBuilder().setCustomId(`orion:idea:down:${x.id}`).setStyle(ButtonStyle.Secondary).setEmoji('👎').setLabel(String(x.down)).setDisabled(!IDEA_STATUS[x.status]?.open),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Toutes les idées').setURL(`${site()}/idees`),
  );
  const staffRow = (x) => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`orion:idea:set:${x.id}`)
    .setPlaceholder('Équipe : changer le statut…').addOptions(Object.entries(IDEA_STATUS).map(([value, s]) => ({ label: s.label, value, emoji: s.emoji, default: value === x.status }))));

  const tagIds = (th, x) => {
    const tags = th.parent?.availableTags || [];
    const byName = (n) => tags.find((t) => t.name === n)?.id;
    return [byName((IDEA_KIND[x.kind] || IDEA_KIND.script).tag), byName(IDEA_TAG[x.status])].filter(Boolean);
  };

  async function refresh(id) {
    const x = get(id);
    if (!x?.thread_id) return;
    const th = await client.channels.fetch(x.thread_id).catch(() => null);
    if (!th) return;
    const msg = x.card_message_id ? await th.messages.fetch(x.card_message_id).catch(() => null) : null;
    const payload = { embeds: [embed(x)], components: [row(x), staffRow(x)] };
    if (msg) await msg.edit(payload).catch(() => {});
    else if (!th.archived) {
      const m = await th.send(payload).catch(() => null);
      if (m) db.prepare('UPDATE ideas SET card_message_id = ? WHERE id = ?').run(m.id, id);
    }
  }

  // Idée envoyée depuis le site (ou /idee) : on crée le post du forum
  async function publish(id) {
    const x = get(id);
    if (!x || x.thread_id) return;
    const f = await forum();
    if (!f || f.type !== ChannelType.GuildForum) throw new Error('Forum #suggestions introuvable (relance npm run setup)');
    const th = await f.threads.create({
      name: x.title.slice(0, 100),
      appliedTags: tagIds({ parent: f }, x),
      message: { content: x.author_id ? `Idée proposée par <@${x.author_id}>${x.source === 'site' ? ' depuis le site' : ''}.` : undefined, allowedMentions: { parse: [] }, embeds: [embed(x)], components: [row(x), staffRow(x)] },
    });
    db.prepare('UPDATE ideas SET thread_id = ?, card_message_id = ? WHERE id = ?').run(th.id, th.id, id);
  }

  // Changement de statut : forum, carte, MP à l'auteur et aux votants 👍
  async function changed(id, old) {
    const x = get(id);
    if (!x) return;
    await refresh(id);
    const th = x.thread_id ? await client.channels.fetch(x.thread_id).catch(() => null) : null;
    if (th?.isThread()) {
      if (th.archived) await th.setArchived(false).catch(() => {});
      await th.setAppliedTags(tagIds(th, x)).catch(() => {});
    }
    if (old === x.status) return;
    const s = IDEA_STATUS[x.status];
    const released = x.released_key && db.prepare('SELECT name FROM products WHERE key = ?').get(x.released_key);
    const text = `${s.emoji} L’idée **#${x.id} · ${x.title}** est maintenant : **${s.label}**.`
      + (released ? `\n👉 [${released.name}](${site()}/scripts/${x.released_key})` : '')
      + (x.note ? `\n\n💬 ${x.note}` : '');
    const e = new EmbedBuilder().setColor(s.color).setDescription(text).setFooter({ text: 'Idées de la communauté Orion' });
    if (th && !th.archived) await th.send({ embeds: [e] }).catch(() => {});
    const people = new Set([x.author_id, ...db.prepare('SELECT discord_id FROM idea_votes WHERE idea_id = ? AND value > 0').all(id).map((r) => r.discord_id)].filter(Boolean));
    for (const uid of people) {
      const u = await client.users.fetch(uid).catch(() => null);
      await u?.send({ embeds: [e] }).catch(() => {});
    }
    if (!s.open && th?.isThread()) await th.setLocked(true).then(() => th.setArchived(true)).catch(() => {});
  }

  // Post créé à la main dans #suggestions : on l'enregistre et on ajoute la carte de vote
  async function threadCreated(th, newly) {
    if (!newly || th.parentId !== cfg().channels.suggestions || th.ownerId === client.user.id) return;
    if (db.prepare('SELECT 1 FROM ideas WHERE thread_id = ?').get(th.id)) return;
    await new Promise((r) => setTimeout(r, 1500)); // le premier message arrive juste après le post
    const starter = await th.fetchStarterMessage().catch(() => null);
    const names = th.appliedTags.map((tid) => th.parent?.availableTags.find((t) => t.id === tid)?.name);
    const kind = names.includes('Amélioration') ? 'amelioration' : names.some((n) => n === 'Site' || n === 'Discord') ? 'autre' : 'script';
    const owner = await client.users.fetch(th.ownerId).catch(() => null);
    const { lastInsertRowid } = db.prepare(`INSERT INTO ideas (title, description, kind, author_id, author_name, thread_id, source) VALUES (?, ?, ?, ?, ?, ?, 'discord')`)
      .run(th.name.slice(0, 120), starter?.content?.slice(0, 1800) || null, kind, th.ownerId, owner?.username || null, th.id);
    await refresh(Number(lastInsertRowid));
  }

  async function vote(i, id, value) {
    const x = get(id);
    if (!x) return i.reply(eph('Cette idée n’existe plus.'));
    if (!IDEA_STATUS[x.status]?.open) return i.reply(eph('Les votes sont fermés pour cette idée.'));
    const cur = db.prepare('SELECT value FROM idea_votes WHERE idea_id = ? AND discord_id = ?').get(id, i.user.id);
    if (cur?.value === value) db.prepare('DELETE FROM idea_votes WHERE idea_id = ? AND discord_id = ?').run(id, i.user.id); // re-clic = retire le vote
    else db.prepare('INSERT INTO idea_votes (idea_id, discord_id, value) VALUES (?, ?, ?) ON CONFLICT(idea_id, discord_id) DO UPDATE SET value = excluded.value').run(id, i.user.id, value);
    const nx = get(id);
    return i.update({ embeds: [embed(nx)], components: [row(nx), staffRow(nx)] });
  }

  async function command(i) {
    if (i.commandName === 'idees') {
      const top = db.prepare(`SELECT i.id, i.title, i.status, i.thread_id, COALESCE(SUM(v.value), 0) score FROM ideas i LEFT JOIN idea_votes v ON v.idea_id = i.id
        WHERE i.status IN ('nouvelle','etude','prevue','dev') GROUP BY i.id ORDER BY score DESC, i.id DESC LIMIT 10`).all();
      if (!top.length) return i.reply(eph(`Aucune idée pour l’instant. Lance-toi avec **/idee** ou sur ${site()}/idees !`));
      return i.reply({ flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder().setColor(0xf5a524).setTitle('💡 Idées les plus demandées')
        .setDescription(top.map((x, n) => `**${n + 1}.** ${x.thread_id ? `<#${x.thread_id}>` : x.title} · ${x.score >= 0 ? '+' : ''}${x.score} · ${IDEA_STATUS[x.status].emoji} ${IDEA_STATUS[x.status].label}`).join('\n'))
        .setFooter({ text: `Toutes les idées : ${site()}/idees` })] });
    }
    // /idee : formulaire en 2 champs
    const modal = new ModalBuilder().setCustomId('orion:idea:modal').setTitle('Proposer une idée').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Ton idée en une phrase').setStyle(TextInputStyle.Short)
        .setMinLength(5).setMaxLength(100).setPlaceholder('ex. Un script de fourrière avec dépanneuse').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Détails (facultatif)').setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1500).setPlaceholder('Ce que le script ferait, pour quel job, ton framework…').setRequired(false)),
    );
    return i.showModal(modal);
  }

  async function modal(i) {
    if (!i.member.roles.cache.has(cfg().roles.member) && !isStaff(i.member)) return i.reply(eph(`Accepte d’abord le règlement dans <#${cfg().channels.rules}>.`));
    const last = cooldown.get(i.user.id) || 0;
    if (Date.now() - last < 10 * 60e3 && !isStaff(i.member)) return i.reply(eph('Une idée toutes les 10 minutes maximum. Merci pour ton enthousiasme !'));
    cooldown.set(i.user.id, Date.now());
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const { lastInsertRowid } = db.prepare(`INSERT INTO ideas (title, description, kind, author_id, author_name, source) VALUES (?, ?, 'script', ?, ?, 'discord')`)
      .run(i.fields.getTextInputValue('title').trim(), i.fields.getTextInputValue('description').trim() || null, i.user.id, i.user.username);
    const id = Number(lastInsertRowid);
    db.prepare('INSERT OR IGNORE INTO idea_votes (idea_id, discord_id, value) VALUES (?, ?, 1)').run(id, i.user.id);
    await publish(id);
    return i.editReply(`💡 Merci ! Ton idée est en ligne : <#${get(id).thread_id}>. Tu recevras un MP quand elle avancera.`);
  }

  async function component(i) {
    const [, , action, raw] = i.customId.split(':');
    if (action === 'modal') return modal(i);
    const id = Number(raw);
    if (action === 'up') return vote(i, id, 1);
    if (action === 'down') return vote(i, id, -1);
    if (action === 'set') {
      if (!isStaff(i.member)) return i.reply(eph('Réservé à l’équipe.'));
      const x = get(id);
      if (!x) return i.reply(eph('Cette idée n’existe plus.'));
      const status = i.values[0];
      if (status === 'sortie') return i.reply(eph(`Pour « Disponible », passe par le site (Admin → Idées) pour lier le script sorti : ${site()}/admin/idees/${id}`));
      await i.deferUpdate();
      db.prepare("UPDATE ideas SET status = ?, note = CASE WHEN status = ? THEN note ELSE NULL END, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, status, id);
      db.prepare('INSERT INTO audit_logs (admin, action, target, details) VALUES (?, ?, ?, ?)').run(i.user.tag, 'idée.statut', `#${id}`, `${x.status} → ${status}`);
      return changed(id, x.status);
    }
  }

  return {
    names: new Set(['idee', 'idees']),
    command, component, threadCreated,
    jobs: {
      async 'idea.publish'({ id }) { await publish(id); },
      async 'idea.refresh'({ id }) { await refresh(id); },
      async 'idea.changed'({ id, old }) { await changed(id, old); },
    },
  };
}
