// Suivi des bugs : une fiche par bug (#suivi-bugs pour l'équipe, post du forum #bug-report ou ticket côté client),
// statuts, « J'ai aussi ce bug », notifications en MP, lien avec les patch notes.
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, SlashCommandBuilder,
  StringSelectMenuBuilder, PermissionFlagsBits as P,
} from 'discord.js';
import { BUG_SEVERITY, BUG_STATUS, bugLabel } from '../db/bugs.mjs';

const STATUS_CHOICES = Object.entries(BUG_STATUS).map(([value, s]) => ({ name: `${s.emoji} ${s.label}`.slice(0, 100), value }));
const SEVERITY_CHOICES = Object.entries(BUG_SEVERITY).map(([value, s]) => ({ name: `${s.emoji} ${s.label}`, value }));
const FORUM_TAG = { confirme: 'En cours', en_cours: 'En cours', corrige: 'Corrigé', publie: 'Corrigé', refuse: 'Pas un bug', doublon: 'Pas un bug' };

export const BUG_COMMANDS = [
  new SlashCommandBuilder().setName('bug').setDescription('Suivi des bugs')
    .addSubcommand((s) => s.setName('creer').setDescription('Créer la fiche d’un bug (dans un post #bug-report ou un ticket : le client est lié tout seul)')
      .addStringOption((o) => o.setName('script').setDescription('Script concerné').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('titre').setDescription('Résumé court du bug').setRequired(true).setMaxLength(120))
      .addStringOption((o) => o.setName('gravite').setDescription('Gravité').addChoices(...SEVERITY_CHOICES))
      .addStringOption((o) => o.setName('description').setDescription('Détails (sinon : le premier message du post)').setMaxLength(1500))
      .addUserOption((o) => o.setName('client').setDescription('Qui l’a signalé (sinon : auteur du post ou du ticket)')))
    .addSubcommand((s) => s.setName('statut').setDescription('Changer le statut d’un bug')
      .addIntegerOption((o) => o.setName('id').setDescription('Numéro du bug').setRequired(true).setAutocomplete(true))
      .addStringOption((o) => o.setName('statut').setDescription('Nouveau statut').setRequired(true).addChoices(...STATUS_CHOICES))
      .addStringOption((o) => o.setName('note').setDescription('Message pour le client (facultatif)').setMaxLength(500))
      .addStringOption((o) => o.setName('version').setDescription('Version qui corrige (pour « Corrigé et publié »)').setMaxLength(20))
      .addIntegerOption((o) => o.setName('doublon_de').setDescription('Numéro du bug d’origine (pour « Doublon »)')))
    .addSubcommand((s) => s.setName('voir').setDescription('Voir où en est un bug')
      .addIntegerOption((o) => o.setName('id').setDescription('Numéro du bug').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('liste').setDescription('Bugs ouverts')
      .addStringOption((o) => o.setName('script').setDescription('Filtrer par script').setAutocomplete(true))),
];

export function createBugs({ client, db, getCfg, isStaff }) {
  const cfg = () => getCfg();
  const eph = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, ...extra });
  const site = () => (process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');
  const get = (id) => db.prepare('SELECT b.*, p.name product FROM bugs b LEFT JOIN products p ON p.key = b.product_key WHERE b.id = ?').get(id);
  const followers = (id) => db.prepare('SELECT discord_id FROM bug_followers WHERE bug_id = ?').all(id).map((r) => r.discord_id);
  const fetchCh = (id) => (id ? client.channels.fetch(id).catch(() => null) : null);

  // ----- Fiche -----
  function embed(b) {
    const s = BUG_STATUS[b.status] || BUG_STATUS.nouveau;
    const sev = BUG_SEVERITY[b.severity] || BUG_SEVERITY.genant;
    const n = followers(b.id).length + (b.reporter_id ? 1 : 0);
    return new EmbedBuilder().setColor(s.color).setTitle(`🐞 Bug #${b.id} · ${b.title}`.slice(0, 256))
      .setDescription((b.description || '*Pas de description.*').slice(0, 1500))
      .addFields(
        { name: 'Statut', value: `${s.emoji} **${bugLabel(b.status, b.fixed_version)}**`, inline: true },
        { name: 'Script', value: b.product || b.product_key || '—', inline: true },
        { name: 'Gravité', value: `${sev.emoji} ${sev.label}`, inline: true },
        { name: 'Signalé par', value: b.reporter_id ? `<@${b.reporter_id}>` : '—', inline: true },
        { name: 'Joueurs concernés', value: String(Math.max(n, 1)), inline: true },
        ...(b.duplicate_of ? [{ name: 'Doublon de', value: `Bug #${b.duplicate_of}`, inline: true }] : []),
        ...(b.note ? [{ name: 'Dernière note de l’équipe', value: b.note.slice(0, 500) }] : []),
      )
      .setFooter({ text: `Suivi des bugs Orion · /bug voir ${b.id}` }).setTimestamp(new Date(String(b.updated_at).replace(' ', 'T') + 'Z'));
  }
  const staffRow = (b) => new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`orion:bug:set:${b.id}`)
    .setPlaceholder('Changer le statut…').addOptions(STATUS_CHOICES.map((c) => ({ label: BUG_STATUS[c.value].label.slice(0, 100), value: c.value, emoji: BUG_STATUS[c.value].emoji, default: c.value === b.status }))));
  const publicRow = (b) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`orion:bug:follow:${b.id}`).setStyle(ButtonStyle.Secondary).setEmoji('🙋').setLabel('J’ai aussi ce bug').setDisabled(!BUG_STATUS[b.status]?.open),
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Problèmes connus').setURL(`${site()}/bugs`),
  );

  // Met à jour (ou crée) la fiche de l'équipe et celle du post / ticket
  async function refresh(b) {
    const tracker = await fetchCh(cfg().channels.bugTracker || cfg().channels.logs);
    if (tracker) {
      const msg = b.card_message_id ? await tracker.messages.fetch(b.card_message_id).catch(() => null) : null;
      const payload = { embeds: [embed(b)], components: [staffRow(b)] };
      if (msg) await msg.edit(payload);
      else {
        const m = await tracker.send(payload);
        db.prepare('UPDATE bugs SET card_message_id = ? WHERE id = ?').run(m.id, b.id);
      }
    }
    const where = await fetchCh(b.thread_id || b.ticket_channel_id);
    if (where) {
      const msg = b.thread_message_id ? await where.messages.fetch(b.thread_message_id).catch(() => null) : null;
      const payload = { embeds: [embed(b)], components: [publicRow(b)] };
      if (msg) await msg.edit(payload).catch(() => {});
      else if (!where.archived) {
        const m = await where.send(payload).catch(() => null);
        if (m) db.prepare('UPDATE bugs SET thread_message_id = ? WHERE id = ?').run(m.id, b.id);
      }
    }
  }

  // Tags du forum #bug-report : gravité + statut
  async function tagThread(b) {
    const th = await fetchCh(b.thread_id);
    if (!th?.parent || th.parent.type !== ChannelType.GuildForum) return;
    const tags = th.parent.availableTags;
    const byName = (n) => tags.find((t) => t.name === n)?.id;
    const ids = [byName(BUG_SEVERITY[b.severity]?.label), byName(FORUM_TAG[b.status])].filter(Boolean);
    if (th.archived) await th.setArchived(false).catch(() => {});
    await th.setAppliedTags(ids).catch(() => {});
  }

  // Notifie le client, les « moi aussi » et le post / ticket d'un changement de statut
  async function notify(b, old) {
    if (old === b.status) return;
    const s = BUG_STATUS[b.status];
    const text = `${s.emoji} Le bug **#${b.id} · ${b.title}**${b.product ? ` (${b.product})` : ''} est maintenant : **${bugLabel(b.status, b.fixed_version)}**.`
      + (b.status === 'publie' ? '\nTélécharge la nouvelle version dans ton Keymaster Cfx.re.' : '')
      + (b.status === 'doublon' && b.duplicate_of ? `\nIl est suivi sous le bug #${b.duplicate_of} : tu as été ajouté à sa liste, tu seras prévenu.` : '')
      + (b.note ? `\n\n💬 ${b.note}` : '');
    const e = new EmbedBuilder().setColor(s.color).setDescription(text).setFooter({ text: 'Suivi des bugs Orion' });
    const where = await fetchCh(b.thread_id || b.ticket_channel_id);
    if (where && !where.archived) await where.send({ embeds: [e] }).catch(() => {});
    const people = [...new Set([b.reporter_id, ...followers(b.id)].filter(Boolean))];
    for (const id of people) {
      const u = await client.users.fetch(id).catch(() => null);
      await u?.send({ embeds: [e] }).catch(() => {}); // MP fermés : tant pis
    }
    if (b.thread_id && !s.open && where?.isThread?.()) await where.setLocked(true).then(() => where.setArchived(true)).catch(() => {});
  }

  // Applique un changement de statut (bot ou site)
  async function setStatus(id, status, { note, version, duplicateOf, by } = {}) {
    const b = get(id);
    if (!b) throw new Error(`Bug #${id} introuvable.`);
    const old = b.status;
    if (status === 'doublon' && duplicateOf && get(duplicateOf)) {
      // Les personnes concernées suivent maintenant le bug d'origine
      for (const who of [b.reporter_id, ...followers(b.id)].filter(Boolean)) {
        db.prepare('INSERT OR IGNORE INTO bug_followers (bug_id, discord_id) VALUES (?, ?)').run(duplicateOf, who);
      }
    }
    // Une note accompagne un changement : sans nouvelle note, l'ancienne est effacée
    db.prepare(`UPDATE bugs SET status = ?, note = CASE WHEN ? IS NOT NULL THEN ? WHEN status = ? THEN note ELSE NULL END, fixed_version = COALESCE(?, fixed_version),
      duplicate_of = COALESCE(?, duplicate_of), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(status, note || null, note || null, status, version || null, status === 'doublon' ? duplicateOf || null : null, id);
    const nb = get(id);
    await refresh(nb);
    await tagThread(nb);
    await notify(nb, old);
    if (by && old !== status) {
      db.prepare('INSERT INTO audit_logs (admin, action, target, details) VALUES (?, ?, ?, ?)').run(by, 'bug.statut', `#${id}`, `${old} → ${status}`);
    }
    return nb;
  }

  // ----- Commandes -----
  async function command(i) {
    const sub = i.options.getSubcommand();
    if (sub === 'voir') {
      const b = get(i.options.getInteger('id', true));
      if (!b) return i.reply(eph('Bug introuvable.'));
      return i.reply({ embeds: [embed(b)], flags: MessageFlags.Ephemeral });
    }
    if (!isStaff(i.member)) return i.reply(eph('Réservé à l’équipe. Pour voir un bug : `/bug voir`.'));

    if (sub === 'creer') {
      const key = i.options.getString('script', true);
      const product = db.prepare('SELECT key, name FROM products WHERE key = ? OR name = ?').get(key, key);
      if (!product) return i.reply(eph('Script inconnu : choisis-le dans la liste.'));
      const ch = i.channel;
      let reporter = i.options.getUser('client')?.id || null;
      let description = i.options.getString('description');
      let threadId = null, ticketId = null;
      if (ch.isThread() && ch.parentId === cfg().channels.bugs) {
        threadId = ch.id;
        reporter ||= ch.ownerId;
        if (!description) description = (await ch.fetchStarterMessage().catch(() => null))?.content?.slice(0, 1500) || null;
      } else {
        const m = /uid:(\d+);type:(\w+)/.exec(ch.topic || '');
        if (m) { ticketId = ch.id; reporter ||= m[1]; }
      }
      const exists = threadId && db.prepare('SELECT id FROM bugs WHERE thread_id = ?').get(threadId);
      if (exists) return i.reply(eph(`Ce post a déjà sa fiche : bug #${exists.id}.`));
      const { lastInsertRowid: id } = db.prepare(`INSERT INTO bugs (product_key, title, description, severity, status, reporter_id, thread_id, ticket_channel_id, created_by)
        VALUES (?, ?, ?, ?, 'confirme', ?, ?, ?, ?)`).run(product.key, i.options.getString('titre', true), description,
        i.options.getString('gravite') || 'genant', reporter, threadId, ticketId, i.user.tag);
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const b = get(Number(id));
      await refresh(b);
      await tagThread(b);
      await notify(b, 'nouveau');
      return i.editReply(`✅ Fiche **bug #${id}** créée${reporter ? `, <@${reporter}> sera prévenu à chaque étape` : ''}.`);
    }

    if (sub === 'statut') {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const id = i.options.getInteger('id', true);
      const status = i.options.getString('statut', true);
      const b = await setStatus(id, status, {
        note: i.options.getString('note'), version: i.options.getString('version'), duplicateOf: i.options.getInteger('doublon_de'), by: i.user.tag,
      });
      return i.editReply(`${BUG_STATUS[status].emoji} Bug #${b.id} : **${bugLabel(b.status, b.fixed_version)}**. Personnes concernées prévenues.`);
    }

    if (sub === 'liste') {
      const key = i.options.getString('script');
      const rows = db.prepare(`SELECT b.*, p.name product FROM bugs b LEFT JOIN products p ON p.key = b.product_key
        WHERE b.status IN ('nouveau','confirme','en_cours','corrige') ${key ? 'AND b.product_key = ?' : ''}
        ORDER BY CASE b.severity WHEN 'critique' THEN 0 WHEN 'genant' THEN 1 ELSE 2 END, b.id`).all(...(key ? [key] : []));
      if (!rows.length) return i.reply(eph('🎉 Aucun bug ouvert.'));
      const lines = rows.map((b) => `${BUG_SEVERITY[b.severity]?.emoji || '•'} **#${b.id}** ${b.title} · *${b.product || b.product_key}* · ${BUG_STATUS[b.status].emoji} ${BUG_STATUS[b.status].label}${b.card_message_id ? ` · [fiche](https://discord.com/channels/${i.guildId}/${cfg().channels.bugTracker}/${b.card_message_id})` : ''}`);
      return i.reply({ flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder().setColor(0xf5a524).setTitle(`🐞 ${rows.length} bug(s) ouvert(s)`).setDescription(lines.join('\n').slice(0, 4000))] });
    }
  }

  async function autocomplete(i) {
    const f = i.options.getFocused(true);
    const q = String(f.value || '').toLowerCase();
    if (f.name === 'script') {
      const rows = db.prepare("SELECT key, name FROM products WHERE IFNULL(kind,'single') <> 'subscription' ORDER BY name").all()
        .filter((r) => r.name.toLowerCase().includes(q)).slice(0, 25);
      return i.respond(rows.map((r) => ({ name: r.name, value: r.key })));
    }
    const rows = db.prepare(`SELECT id, title, status FROM bugs ORDER BY
      CASE WHEN status IN ('nouveau','confirme','en_cours','corrige') THEN 0 ELSE 1 END, id DESC LIMIT 200`).all()
      .filter((b) => `${b.id} ${b.title}`.toLowerCase().includes(q)).slice(0, 25);
    return i.respond(rows.map((b) => ({ name: `#${b.id} · ${b.title} (${BUG_STATUS[b.status]?.label || b.status})`.slice(0, 100), value: b.id })));
  }

  // ----- Boutons / menus -----
  async function component(i) {
    const [, , action, raw] = i.customId.split(':');
    const id = Number(raw);
    const b = get(id);
    if (!b) return i.reply(eph('Ce bug n’existe plus.'));
    if (action === 'follow') {
      if (!BUG_STATUS[b.status]?.open) return i.reply(eph('Ce bug est déjà clôturé.'));
      if (i.user.id === b.reporter_id) return i.reply(eph('C’est toi qui l’as signalé : tu es déjà prévenu à chaque étape.'));
      const r = db.prepare('INSERT OR IGNORE INTO bug_followers (bug_id, discord_id) VALUES (?, ?)').run(id, i.user.id);
      await i.reply(eph(r.changes ? `🙋 Noté ! Tu recevras un MP à chaque avancée du bug #${id}.` : 'Tu suis déjà ce bug.'));
      if (r.changes) await refresh(get(id)).catch(() => {});
      return;
    }
    if (action === 'set') {
      if (!isStaff(i.member)) return i.reply(eph('Réservé à l’équipe.'));
      const status = i.values[0];
      if (status === 'doublon') return i.reply(eph('Pour un doublon, utilise `/bug statut` avec `doublon_de` : les personnes concernées seront basculées sur le bug d’origine.'));
      await i.deferUpdate();
      await setStatus(id, status, { by: i.user.tag });
    }
  }

  return {
    names: new Set(['bug']),
    command, autocomplete, component, setStatus,
    jobs: {
      // Changement fait depuis l'admin du site ou par une mise à jour publiée
      async 'bug.changed'({ id, old }) {
        const b = get(id);
        if (!b) return;
        await refresh(b);
        await tagThread(b);
        await notify(b, old);
      },
    },
  };
}
