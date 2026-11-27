// Tickets : création, fiche client, assistant automatique (recherche dans la doc), transfert au staff, prise en charge, relance et fermeture auto.
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits as P,
  SlashCommandBuilder,
} from 'discord.js';
import { HOURS_DEFAULT, isOpen, nextOpen } from '../db/support.mjs';
import { DEFAULT_MACROS } from '../db/macros.mjs';
import { COLOR, TICKETS } from './structure.js';
import { WaitMember } from './jobs.js';
import { createAgent } from './ai.js';

const AI_FOOTER = 'Assistant Orion · réponse automatique';
const IA_FOOTER = 'Assistant Orion · IA';
const STAFF_FOOTER = 'Réponse de l’équipe';
const URGENT_TYPES = ['support', 'bug'];

// /reponse : réponses toutes faites de l'équipe (gérées dans Admin → Support)
export const REPLY_COMMANDS = [
  new SlashCommandBuilder().setName('reponse').setDescription('Envoyer une réponse toute faite dans ce ticket (équipe)')
    .addStringOption((o) => o.setName('nom').setDescription('Réponse à envoyer').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('ajout').setDescription('Texte à ajouter à la fin (facultatif)').setMaxLength(500)),
];
const MAX_AI_TURNS = 3;           // au-delà, transfert automatique à l'équipe
const REMIND_AFTER = 24 * 3600e3; // relance sans réponse du client
const CLOSE_AFTER = 48 * 3600e3;  // fermeture sans réponse du client
// Sujets qui demandent toujours un humain
const HUMAN = /rembours|paiement|pay[ée]|factur|litige|chargeback|devis|tarif sur mesure|transf[ée]r.*licen|licen.*transf|r[ôo]le.*(manqu|pas re[çc]u)|pas re[çc]u|humain|staff|quelqu.un|arnaque|plainte/i;
const STOP = new Set('alors avec avoir bonjour salut merci comment dans faire fait mais mon mes pour quoi quand sont sur une des les est pas plus que qui script scripts mon ma ton tes vous nous cela cette elle ils aussi tout tous bien encore depuis marche fonctionne probleme problème aide help'.split(' '));
const words = (t) => (t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9_]{3,}/g) || []).filter((w) => !STOP.has(w));

const HELP = {
  support: 'Indique le **script**, sa **version**, ton **framework** et ce qui ne va pas (captures, erreurs F8 / console).',
  bug: 'Indique le **script** et sa **version**, ce qui se passe, comment le reproduire, et les erreurs F8 / console.',
  presale: 'Pose ta question : script concerné, ton framework, ton inventaire…',
  partner: 'Présente ton serveur : nom, nombre de joueurs, framework, et ce dont tu as besoin.',
  custom: 'Décris le script ou le bot voulu, ton framework et ton budget.',
  other: 'Explique ta demande.',
};

const baseName = (name) => name.replace(/^(?:🚨・?)?[🔴🟢🤖]?・?/u, '');

export function createTickets({ client, db, getCfg, staffIds, isStaff }) {
  const cfg = () => getCfg();
  const agent = createAgent({ db });
  const eph = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, ...extra });
  const row = (id) => db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(id);
  const supportRoles = () => ['support', 'mod', 'dev'].map((k) => cfg().roles[k]).filter(Boolean);

  // ----- Horaires -----
  const hours = () => {
    const r = db.prepare("SELECT value FROM settings WHERE key = 'support_hours'").get();
    try { return { ...HOURS_DEFAULT, ...(r ? JSON.parse(r.value) : {}) }; } catch { return HOURS_DEFAULT; }
  };
  // Phrase à afficher si l'équipe n'est pas là en ce moment (sinon chaîne vide)
  function offHoursNote() {
    const h = hours();
    if (isOpen(h)) return '';
    const n = nextOpen(h);
    return `🌙 **L’équipe n’est pas disponible en ce moment**${n ? ` : elle revient <t:${Math.floor(n / 1000)}:R> (<t:${Math.floor(n / 1000)}:f>)` : ''}. ${h.note || ''}`.trim();
  }

  // ----- Statistiques -----
  const stat = {
    open(channelId, userId, type, priority = 'normal') {
      db.prepare('INSERT OR REPLACE INTO ticket_stats (channel_id, discord_id, type, priority, opened_at) VALUES (?, ?, ?, ?, ?)').run(channelId, userId, type, priority, Date.now());
    },
    first(channelId, by, staffId = null) {
      db.prepare('UPDATE ticket_stats SET first_response_at = COALESCE(first_response_at, ?), first_response_by = COALESCE(first_response_by, ?) WHERE channel_id = ?').run(Date.now(), by, channelId);
      if (staffId) db.prepare('UPDATE ticket_stats SET staff_id = COALESCE(staff_id, ?) WHERE channel_id = ?').run(staffId, channelId);
    },
    set(channelId, fields) {
      const keys = Object.keys(fields);
      db.prepare(`UPDATE ticket_stats SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE channel_id = ?`).run(...keys.map((k) => fields[k]), channelId);
    },
  };

  const buttons = (ai, urgent = false) => new ActionRowBuilder().addComponents(
    ...(ai ? [
      new ButtonBuilder().setCustomId('orion:ai:solved').setStyle(ButtonStyle.Success).setLabel('C’est résolu').setEmoji('✅'),
      new ButtonBuilder().setCustomId('orion:ai:human').setStyle(ButtonStyle.Primary).setLabel('Parler à l’équipe').setEmoji('🙋'),
    ] : []),
    ...(urgent ? [new ButtonBuilder().setCustomId('orion:ticket:urgent').setStyle(ButtonStyle.Danger).setLabel('Urgent : serveur en panne').setEmoji('🚨')] : []),
    new ButtonBuilder().setCustomId('orion:ticket:claim').setStyle(ButtonStyle.Secondary).setLabel('Prendre en charge').setEmoji('🫡'),
    new ButtonBuilder().setCustomId('orion:ticket:close').setStyle(ButtonStyle.Danger).setLabel('Fermer').setEmoji('🔒'),
  );

  // ----- Fiche client affichée dans le ticket -----
  function clientSheet(userId, member) {
    const scripts = db.prepare(`SELECT oi.name, MAX(p.version) version, MIN(o.created_at) first FROM order_items oi JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.key = oi.product_key WHERE o.discord_id = ? AND o.status = 'paid' GROUP BY oi.product_key ORDER BY first`).all(userId);
    const orders = db.prepare("SELECT COUNT(*) n, MAX(created_at) last FROM orders WHERE discord_id = ?").get(userId);
    const subs = db.prepare("SELECT name, status FROM subscriptions WHERE discord_id = ? AND status IN ('active','cancelling')").all(userId);
    const warns = db.prepare('SELECT COUNT(*) n FROM warnings WHERE discord_id = ?').get(userId).n;
    const ts = (s) => `<t:${Math.floor(Date.parse(String(s).replace(' ', 'T') + 'Z') / 1000)}:D>`;
    return new EmbedBuilder().setColor(0x2b2f3a).setTitle('📇 Fiche client')
      .addFields(
        { name: 'Scripts', value: scripts.length ? scripts.map((s) => `• **${s.name}**${s.version ? ` v${s.version}` : ''}`).join('\n').slice(0, 1000) : 'Aucun achat lié à ce Discord' },
        { name: 'Commandes', value: orders.n ? `${orders.n} (dernière ${ts(orders.last)})` : '0', inline: true },
        { name: 'Partenariat', value: subs.length ? subs.map((s) => s.name).join(', ') : '—', inline: true },
        { name: 'Membre depuis', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : '—', inline: true },
        ...(warns ? [{ name: 'Avertissements', value: String(warns), inline: true }] : []),
      );
  }

  // ----- Ouverture -----
  async function open(i) {
    const t = TICKETS.find((x) => x.value === i.values[0]);
    if (!t) return i.reply(eph('Type de ticket inconnu.'));
    if (!i.member.roles.cache.has(cfg().roles.member) && !isStaff(i.member)) return i.reply(eph(`Accepte d’abord le règlement dans <#${cfg().channels.rules}>.`));
    if (t.clientOnly && !i.member.roles.cache.has(cfg().roles.client) && !isStaff(i.member)) {
      return i.reply(eph('Ce type de ticket est réservé aux clients. Tu as acheté un script mais n’as pas le rôle ? Ouvre un ticket « Autre » avec ton numéro de commande Tebex.'));
    }
    const marker = `uid:${i.user.id};type:${t.value}`;
    const existing = i.guild.channels.cache.find((c) => c.topic?.includes(marker));
    if (existing) return i.reply(eph(`Tu as déjà un ticket ouvert pour ça : <#${existing.id}>`));

    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const ai = true;
    const channel = await createChannel(i.guild, i.user, t, ai ? '🤖' : '');
    db.prepare('INSERT INTO tickets (channel_id, discord_id, type, status, last_activity) VALUES (?, ?, ?, ?, ?)')
      .run(channel.id, i.user.id, t.value, ai ? 'ai' : 'staff', Date.now());
    stat.open(channel.id, i.user.id, t.value);
    const off = offHoursNote();

    await channel.send({
      content: `<@${i.user.id}>`,
      embeds: [
        new EmbedBuilder().setColor(COLOR).setTitle(`${t.emoji} ${t.label}`).setTimestamp()
          .setDescription(`Merci <@${i.user.id}> !\n\n${HELP[t.value]}\n\n${ai
            ? (agent.ready() ? '🤖 **L’assistant Orion (IA)** te répond tout de suite. S’il ne peut pas t’aider, il passe la main à l’équipe, ou clique sur **Parler à l’équipe**.' : '🤖 **L’assistant Orion** te propose tout de suite les pages de la doc qui correspondent à ton message. Si ça ne suffit pas, clique sur **Parler à l’équipe** : un membre du staff prendra le relais.')
            : 'L’équipe arrive.'}${off ? `\n\n${off}` : ''}${URGENT_TYPES.includes(t.value) ? '\n\n🚨 Ton serveur est **en panne à cause d’un de nos scripts** ? Clique sur **Urgent** : l’équipe est prévenue en priorité.' : ''}`),
        clientSheet(i.user.id, i.member),
      ],
      components: [buttons(ai, URGENT_TYPES.includes(t.value))],
    });
    await logTo('logs', new EmbedBuilder().setColor(COLOR).setDescription(`🎫 Ticket **${t.label}** ouvert par <@${i.user.id}> : <#${channel.id}>`).setTimestamp());
    return i.editReply(`✅ Ton ticket est ouvert : <#${channel.id}>`);
  }

  async function createChannel(guild, user, t, prefix) {
    const base = `${t.value === 'custom' || t.value === 'partner' ? 'devis' : t.value}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80) || `ticket-${t.value}`;
    return guild.channels.create({
      name: prefix ? `${prefix}・${base}` : base,
      type: ChannelType.GuildText,
      parent: cfg().channels[t.category],
      topic: `${t.emoji} ${t.label} · ${user.tag} · uid:${user.id};type:${t.value}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
        { id: user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
        ...staffIds().map((id) => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.ManageMessages] })),
        { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.EmbedLinks, P.ManageMessages] },
      ],
    });
  }

  // ----- Devis envoyé depuis le site : ticket privé avec le client dedans -----
  const QUOTE_LABEL = { 'sur-mesure': 'Script sur mesure', partenariat: 'Partenariat serveur', bot: 'Bot Discord', carte: 'Service à la carte', other: 'Autre' };
  async function quoteTicket({ quote_id }) {
    const q = db.prepare('SELECT * FROM quotes WHERE id = ?').get(quote_id);
    if (!q?.discord_id || q.channel_id) return;
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    const member = await guild.members.fetch(q.discord_id).catch(() => null);
    if (!member) throw new WaitMember('Le client n’est pas encore sur le serveur Discord');
    const t = TICKETS.find((x) => x.value === (q.type === 'partenariat' ? 'partner' : 'custom'));
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(`📝 Demande de devis · ${QUOTE_LABEL[q.type] || 'Autre'}`)
      .setDescription(q.message.slice(0, 3500))
      .addFields({ name: 'Framework', value: q.framework || '—', inline: true }, { name: 'Budget', value: q.budget || '—', inline: true })
      .setFooter({ text: `Devis n°${q.id} · envoyé depuis le site` }).setTimestamp();

    // Ticket devis déjà ouvert pour ce client : on ajoute la demande dedans
    let channel = guild.channels.cache.find((c) => c.topic?.includes(`uid:${q.discord_id};type:${t.value}`));
    const roles = supportRoles();
    if (channel) {
      await channel.send({ content: roles.map((id) => `<@&${id}>`).join(' ') || undefined, allowedMentions: { roles }, embeds: [embed] });
    } else {
      channel = await createChannel(guild, member.user, t, '🔴');
      db.prepare("INSERT INTO tickets (channel_id, discord_id, type, status, last_activity) VALUES (?, ?, ?, 'staff', ?)").run(channel.id, q.discord_id, t.value, Date.now());
      stat.open(channel.id, q.discord_id, t.value);
      stat.set(channel.id, { transferred_at: Date.now() });
      await channel.send({
        content: `<@${q.discord_id}> ${roles.map((id) => `<@&${id}>`).join(' ')}`,
        allowedMentions: { users: [q.discord_id], roles },
        embeds: [
          new EmbedBuilder().setColor(COLOR).setDescription(`Merci <@${q.discord_id}> pour ta demande de devis ! L’équipe te répond **ici** sous 24 h avec un prix et un délai. Tu peux ajouter des détails, captures ou exemples dans ce salon.${offHoursNote() ? `\n\n${offHoursNote()}` : ''}`),
          embed, clientSheet(q.discord_id, member),
        ],
        components: [buttons(false)],
      });
      await logTo('quotes', new EmbedBuilder().setColor(COLOR).setDescription(`📝 Devis n°${q.id} de <@${q.discord_id}> : <#${channel.id}>`).setTimestamp());
    }
    db.prepare("UPDATE quotes SET channel_id = ?, status = CASE WHEN status = 'nouveau' THEN 'en cours' ELSE status END WHERE id = ?").run(channel.id, q.id);
    await member.send(`📝 Ta demande de devis Orion est bien reçue. On te répond ici : <#${channel.id}>`).catch(() => {});
  }

  async function logTo(key, embed) {
    try { (await client.channels.fetch(cfg().channels[key])).send({ embeds: [embed] }); } catch { /* rien */ }
  }

  // ----- Transfert à l'équipe -----
  async function transfer(channel, why, { urgent = false } = {}) {
    const r = row(channel.id);
    if (!r || (r.status !== 'ai' && !urgent)) return;
    if (r.status === 'ai') db.prepare("UPDATE tickets SET status = 'staff' WHERE channel_id = ?").run(channel.id);
    stat.set(channel.id, { transferred_at: Date.now() });
    const isUrgent = urgent || r.priority === 'urgent';
    await channel.setName(`${isUrgent ? '🚨・' : ''}${r.status === 'claimed' ? '🟢' : '🔴'}・${baseName(channel.name)}`).catch(() => {});
    if (isUrgent) await channel.setPosition(0).catch(() => {}); // en haut de la catégorie
    const roles = supportRoles();
    const off = offHoursNote();
    await channel.send({
      content: roles.map((id) => `<@&${id}>`).join(' ') || undefined,
      allowedMentions: { roles },
      embeds: [new EmbedBuilder().setColor(isUrgent ? 0xef4444 : 0xff7a2f).setTitle(isUrgent ? '🚨 Ticket URGENT : serveur en panne' : '🙋 Ticket transféré à l’équipe')
        .setDescription(`${why}\n\nUn membre du staff va prendre le relais. L’assistant ne répond plus dans ce ticket.${off ? `\n\n${off}${isUrgent ? ' Les tickets urgents sont traités en premier.' : ''}` : ''}`)],
    });
    if (isUrgent) await logTo('logs', new EmbedBuilder().setColor(0xef4444).setDescription(`🚨 Ticket urgent : <#${channel.id}> (<@${r.discord_id}>)`).setTimestamp());
  }

  // ----- Fermeture (transcript puis suppression) -----
  async function close(channel, byId, reason) {
    const r = row(channel.id);
    const all = [];
    let before;
    for (let n = 0; n < 10; n++) {
      const batch = await channel.messages.fetch({ limit: 100, before });
      if (!batch.size) break;
      all.push(...batch.values());
      before = batch.last().id;
    }
    const lines = all.reverse().map((m) => {
      const when = new Date(m.createdTimestamp).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
      const text = [m.content, ...m.embeds.map((e) => [e.title, e.description].filter(Boolean).join(' — ')), ...m.attachments.map((a) => a.url)].filter(Boolean).join(' | ');
      return `[${when}] ${m.author.tag} : ${text}`;
    });
    try {
      const tr = await client.channels.fetch(cfg().channels.transcripts);
      await tr.send({
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`🗂️ ${baseName(channel.name)}`)
          .setDescription(`Auteur : ${r ? `<@${r.discord_id}>` : 'inconnu'}\nFermé par : ${byId ? `<@${byId}>` : 'fermeture automatique'}\nRaison : ${reason}\nMessages : ${lines.length}${r ? `\nRésolu par l’assistant : ${r.status === 'ai' ? 'oui' : 'non'}` : ''}`).setTimestamp()],
        files: [new AttachmentBuilder(Buffer.from(`Ticket ${channel.name}\n${channel.topic || ''}\n\n${lines.join('\n')}\n`, 'utf8'), { name: `${baseName(channel.name)}.txt` })],
      });
    } catch { /* salon des transcripts absent */ }
    db.prepare('DELETE FROM tickets WHERE channel_id = ?').run(channel.id);
    setTimeout(() => channel.delete('Ticket fermé').catch(() => {}), 5000);

    // Statistiques + demande de note au client (sauf fermeture pour inactivité)
    const st = db.prepare('SELECT * FROM ticket_stats WHERE channel_id = ?').get(channel.id);
    const staffSpokeIds = all.filter((m) => r && m.author.id !== r.discord_id && !m.author.bot).map((m) => m.author.id);
    const resolvedBy = /inactif/.test(reason) ? 'inactif' : staffSpokeIds.length || r?.status !== 'ai' ? 'equipe' : /résolu/.test(reason) ? 'ia' : 'client';
    if (st) {
      stat.set(channel.id, { closed_at: Date.now(), resolved_by: resolvedBy, reason, staff_id: st.staff_id || r?.claimed_by || staffSpokeIds.at(-1) || null, ai_turns: r?.ai_turns ?? st.ai_turns });
      if (r && resolvedBy !== 'inactif' && st.first_response_at) {
        const u = await client.users.fetch(r.discord_id).catch(() => null);
        await u?.send({
          embeds: [new EmbedBuilder().setColor(COLOR).setTitle('⭐ Ton avis sur notre support')
            .setDescription(`Ton ticket **${baseName(channel.name)}** est fermé. Comment s’est passée l’aide ${resolvedBy === 'ia' ? 'de l’assistant' : 'de l’équipe'} ?`)],
          components: [new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map((n) => new ButtonBuilder()
            .setCustomId(`orion:rate:${channel.id}:${n}`).setStyle(n >= 4 ? ButtonStyle.Success : n <= 2 ? ButtonStyle.Danger : ButtonStyle.Secondary).setLabel('⭐'.repeat(n))))],
        }).catch(() => {}); // MP fermés : tant pis
      }
    }

    // Le cerveau de l'IA apprend de ce ticket (en arrière-plan, 1 appel Haiku)
    if (r) {
      const transcript = all.filter((m) => !m.system).map((m) => {
        const iaMsg = m.author.id === client.user.id && [AI_FOOTER, IA_FOOTER].includes(m.embeds[0]?.footer?.text);
        const macro = m.author.id === client.user.id && String(m.embeds[0]?.footer?.text || '').startsWith(STAFF_FOOTER);
        const who = m.author.id === r.discord_id ? 'client' : iaMsg ? 'ia' : macro ? 'equipe' : m.author.bot ? null : 'equipe';
        const text = (iaMsg || macro ? m.embeds[0].description : m.content) || '';
        return who && text ? { who, text: text.slice(0, 1200) } : null;
      }).filter(Boolean);
      const staffSpoke = transcript.some((t) => t.who === 'equipe');
      const outcome = staffSpoke ? 'equipe' : /résolu/.test(reason) ? 'resolu_ia' : 'aucun';
      agent.learn({ transcript, ticketType: r.type, outcome, ownerId: r.discord_id })
        .then((x) => { if (x.learned) console.log(`[cerveau] ${x.learned} connaissance(s) apprise(s) du ticket ${channel.name}`); })
        .catch((e) => console.error('[cerveau]', e.message));
    }
  }

  // ----- Assistant automatique (recherche dans la doc, gratuit) -----
  const site = () => (process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');
  function search(text) {
    const q = [...new Set(words(text))];
    if (!q.length) return [];
    const docs = db.prepare('SELECT slug, title, summary, body FROM docs WHERE published = 1').all();
    return docs.map((d) => {
      const title = words(`${d.title} ${d.summary || ''}`), body = words(d.body);
      let score = 0;
      for (const w of q) score += title.filter((x) => x.startsWith(w)).length * 4 + Math.min(body.filter((x) => x.startsWith(w)).length, 5);
      // passage le plus pertinent : la section (## …) qui contient le plus de mots
      const sections = d.body.split(/\n(?=##\s)/);
      const best = sections.map((sec) => {
        const head = words(sec.split('\n')[0]), all = words(sec);
        const n = q.reduce((a, w) => a + (head.some((x) => x.startsWith(w)) ? 5 : 0) + Math.min(all.filter((x) => x.startsWith(w)).length, 3), 0);
        return { sec, n: /toujours bloqu|besoin d.aide/i.test(sec.split('\n')[0]) ? n / 3 : n };
      }).sort((x, y) => y.n - x.n)[0];
      return { ...d, score, excerpt: best?.n ? best.sec : '' };
    }).filter((d) => d.score >= 4).sort((x, y) => y.score - x.score).slice(0, 3);
  }
  const excerpt = (md) => md.replace(/^##+\s*(.*)$/m, '**$1**').replace(/```[\s\S]*?```/g, (c) => c.length > 500 ? '' : c).trim().slice(0, 700);

  const pending = new Map(); // on attend que le client ait fini d'écrire
  function scheduleAi(channel, text) {
    const prev = pending.get(channel.id);
    clearTimeout(prev?.t);
    const all = `${prev?.text || ''}\n${text}`;
    pending.set(channel.id, { text: all, t: setTimeout(() => { pending.delete(channel.id); replyAi(channel, all).catch((e) => console.error('[assistant]', e.message)); }, 3500) });
  }

  // Historique du ticket pour l'IA : messages du client et réponses de l'assistant
  async function history(channel, ownerId) {
    const msgs = [...(await channel.messages.fetch({ limit: 40 })).values()].reverse();
    const out = [];
    for (const m of msgs) {
      if (m.author.id === ownerId) {
        // Captures d'écran : envoyées à l'IA (elle lit les erreurs F8 / console)
        const images = [...m.attachments.values()].filter((a) => /^image\/(png|jpe?g|webp|gif)$/.test(a.contentType || '') && a.size < 5e6).map((a) => a.url);
        const others = [...m.attachments.values()].filter((a) => !images.includes(a.url)).map((a) => `[fichier joint : ${a.name}]`);
        const text = [m.content, ...others].filter(Boolean).join('\n').slice(0, 1500) || (images.length ? '(capture d’écran)' : '');
        if (text) out.push({ role: 'user', text, images });
      } else if (m.author.id === client.user.id && [AI_FOOTER, IA_FOOTER].includes(m.embeds[0]?.footer?.text)) {
        out.push({ role: 'assistant', text: (m.embeds[0].description || '').slice(0, 1500) });
      }
    }
    return out;
  }

  // Vraie IA (Claude) : Haiku répond, Opus en dernier recours
  async function replySmart(channel, r) {
    await channel.sendTyping().catch(() => {});
    const typing = setInterval(() => channel.sendTyping().catch(() => {}), 8000);
    let res;
    try { res = await agent.reply({ ownerId: r.discord_id, ticketType: r.type, history: await history(channel, r.discord_id), convo: { summary: r.ai_summary || '', summarizedN: r.ai_summary_n || 0 } }); }
    finally { clearInterval(typing); }
    if (!res) return;
    stat.first(channel.id, 'ia');
    const turns = r.ai_turns + 1;
    stat.set(channel.id, { ai_turns: turns });
    db.prepare('UPDATE tickets SET ai_turns = ?, last_activity = ?, reminded = 0, ai_summary = ?, ai_summary_n = ? WHERE channel_id = ?')
      .run(turns, Date.now(), res.convo?.summary || null, res.convo?.summarizedN || 0, channel.id);
    const sources = res.sources.length ? `\n\n**Sources :** ${res.sources.map(([url, title]) => `[${String(title).slice(0, 60)}](${url})`).join(' · ')}` : '';
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0x6eaaff).setDescription((res.text + sources).slice(0, 4000)).setFooter({ text: IA_FOOTER })],
      components: res.transfer ? [] : [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('orion:ai:solved').setStyle(ButtonStyle.Success).setLabel('C’est résolu').setEmoji('✅'),
        new ButtonBuilder().setCustomId('orion:ai:human').setStyle(ButtonStyle.Primary).setLabel('Parler à l’équipe').setEmoji('🙋'),
      )],
    });
    if (res.transfer) {
      if (res.urgent) {
        db.prepare("UPDATE tickets SET priority = 'urgent' WHERE channel_id = ?").run(channel.id);
        stat.set(channel.id, { priority: 'urgent' });
      }
      await transfer(channel, `L’assistant a transmis la demande : ${res.transfer}`, { urgent: !!res.urgent });
    } else if (turns >= agent.settings().max_turns) await transfer(channel, `L’assistant a répondu ${turns} fois sans résoudre la demande.`);
  }

  async function replyAi(channel, text) {
    const r = row(channel.id);
    if (!r || r.status !== 'ai') return;
    if (agent.ready()) {
      try { return await replySmart(channel, r); } catch (e) { console.error('[IA]', e.message); /* repli sur l'assistant gratuit */ }
    }
    if (HUMAN.test(text)) return transfer(channel, 'Cette demande (paiement, remboursement, devis, licence ou rôle) est traitée par l’équipe.');
    const hits = search(text);
    if (!hits.length) return transfer(channel, 'Je n’ai rien trouvé dans la documentation pour ta demande.');
    const turns = r.ai_turns + 1;
    db.prepare('UPDATE tickets SET ai_turns = ?, last_activity = ?, reminded = 0 WHERE channel_id = ?').run(turns, Date.now(), channel.id);
    stat.first(channel.id, 'ia');
    stat.set(channel.id, { ai_turns: turns });
    const [top, ...more] = hits;
    const desc = `Voici ce que dit la documentation :\n\n📘 **[${top.title}](${site()}/docs/${top.slug})**\n${excerpt(top.excerpt || top.body)}`
      + (more.length ? `\n\n**À voir aussi :**\n${more.map((d) => `• [${d.title}](${site()}/docs/${d.slug})`).join('\n')}` : '')
      + '\n\nÇa règle ton problème ? Sinon, précise ta demande ou clique sur **Parler à l’équipe**.';
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0x6eaaff).setDescription(desc.slice(0, 3900)).setFooter({ text: AI_FOOTER })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('orion:ai:solved').setStyle(ButtonStyle.Success).setLabel('C’est résolu').setEmoji('✅'),
        new ButtonBuilder().setCustomId('orion:ai:human').setStyle(ButtonStyle.Primary).setLabel('Parler à l’équipe').setEmoji('🙋'),
      )],
    });
    if (turns >= MAX_AI_TURNS) await transfer(channel, `L’assistant a proposé ${turns} réponses sans résoudre la demande.`);
  }

  // ----- Boutons -----
  async function button(i) {
    const r = row(i.channel.id);
    const owner = r?.discord_id || /uid:(\d+)/.exec(i.channel.topic || '')?.[1];
    const mine = i.user.id === owner;

    if (i.customId === 'orion:ai:solved') {
      if (!mine && !isStaff(i.member)) return i.reply(eph('Seul l’auteur du ticket peut le marquer résolu.'));
      await i.reply({ embeds: [new EmbedBuilder().setColor(0x4ade80).setDescription('✅ Ravi d’avoir pu aider ! Ce ticket se ferme dans 5 secondes.')] });
      return close(i.channel, i.user.id, 'résolu (assistant automatique)');
    }
    if (i.customId === 'orion:ai:human') {
      if (!mine && !isStaff(i.member)) return i.reply(eph('Seul l’auteur du ticket peut demander l’équipe.'));
      if (r?.status !== 'ai') return i.reply(eph('L’équipe est déjà prévenue, elle arrive.'));
      await i.deferUpdate();
      return transfer(i.channel, `<@${owner}> souhaite parler à un membre de l’équipe.`);
    }
    if (i.customId === 'orion:ticket:claim') {
      if (!isStaff(i.member)) return i.reply(eph('Réservé à l’équipe.'));
      db.prepare("UPDATE tickets SET status = 'claimed', claimed_by = ? WHERE channel_id = ?").run(i.user.id, i.channel.id);
      stat.set(i.channel.id, { staff_id: i.user.id });
      await i.channel.setName(`${r?.priority === 'urgent' ? '🚨・' : ''}🟢・${baseName(i.channel.name)}`).catch(() => {});
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x4ade80).setDescription(`🫡 Ticket pris en charge par <@${i.user.id}>.`)] });
    }
    if (i.customId === 'orion:ticket:urgent') {
      if (!mine && !isStaff(i.member)) return i.reply(eph('Seul l’auteur du ticket peut le marquer urgent.'));
      if (r?.priority === 'urgent') return i.reply(eph('Ton ticket est déjà marqué urgent : l’équipe est prévenue.'));
      db.prepare("UPDATE tickets SET priority = 'urgent' WHERE channel_id = ?").run(i.channel.id);
      stat.set(i.channel.id, { priority: 'urgent' });
      await i.reply(eph('🚨 C’est noté : l’équipe est prévenue en priorité. Donne un maximum de détails (script, erreur F8 / console, captures).'));
      return transfer(i.channel, `<@${owner}> signale que **son serveur est en panne**.`, { urgent: true });
    }
    if (i.customId === 'orion:ticket:close') {
      if (!isStaff(i.member) && !mine) return i.reply(eph('Seuls l’équipe ou l’auteur peuvent fermer ce ticket.'));
      await i.reply({ embeds: [new EmbedBuilder().setColor(0x9aa0ad).setDescription(`🔒 Ticket fermé par <@${i.user.id}>. Suppression dans 5 secondes…`)] });
      return close(i.channel, i.user.id, isStaff(i.member) ? 'fermé par l’équipe' : 'fermé par le client');
    }
  }

  // ----- Note du client (bouton dans le MP envoyé à la fermeture) -----
  async function rate(i) {
    const [, , channelId, n] = i.customId.split(':');
    const st = db.prepare('SELECT * FROM ticket_stats WHERE channel_id = ?').get(channelId);
    if (!st || st.discord_id !== i.user.id) return i.reply(eph('Ce ticket n’existe plus.'));
    if (st.rating) return i.update({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`Tu as déjà donné ${'⭐'.repeat(st.rating)}. Merci !`)], components: [] });
    const note = Math.max(1, Math.min(5, Number(n)));
    stat.set(channelId, { rating: note, rated_at: Date.now() });
    await i.update({ embeds: [new EmbedBuilder().setColor(0x4ade80).setDescription(`Merci pour ta note ${'⭐'.repeat(note)} !${note <= 2 ? ' Désolé que ça ne se soit pas bien passé : un responsable va regarder ton ticket.' : ''}`)], components: [] });
    if (note <= 2) await logTo('logs', new EmbedBuilder().setColor(0xef4444).setDescription(`⭐ Note basse (${note}/5) de <@${i.user.id}> pour un ticket ${st.type}${st.staff_id ? ` traité par <@${st.staff_id}>` : ' traité par l’assistant'}. Historique dans #transcripts.`).setTimestamp());
  }

  // ----- Réponses toutes faites (/reponse) -----
  async function replyCommand(i) {
    if (!isStaff(i.member)) return i.reply(eph('Réservé à l’équipe.'));
    const r = row(i.channel.id);
    if (!r) return i.reply(eph('À utiliser dans un ticket.'));
    const mac = db.prepare('SELECT * FROM ticket_macros WHERE name = ?').get(i.options.getString('nom', true));
    if (!mac) return i.reply(eph('Réponse introuvable : gère-les dans Admin → Support sur le site.'));
    const extra = i.options.getString('ajout');
    const text = (mac.content + (extra ? `\n\n${extra}` : ''))
      .replaceAll('{client}', `<@${r.discord_id}>`).replaceAll('{equipe}', i.member.displayName).replaceAll('{site}', site());
    db.prepare('UPDATE ticket_macros SET uses = uses + 1 WHERE name = ?').run(mac.name);
    db.prepare('UPDATE tickets SET last_activity = ?, reminded = 0 WHERE channel_id = ?').run(Date.now(), i.channel.id);
    stat.first(i.channel.id, 'equipe', i.user.id);
    if (r.status === 'ai') {
      db.prepare("UPDATE tickets SET status = 'claimed', claimed_by = ? WHERE channel_id = ?").run(i.user.id, i.channel.id);
      await i.channel.setName(`${r.priority === 'urgent' ? '🚨・' : ''}🟢・${baseName(i.channel.name)}`).catch(() => {});
    }
    await i.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle(mac.title).setDescription(text.slice(0, 4000))
      .setFooter({ text: `${STAFF_FOOTER} · ${i.member.displayName}`, iconURL: i.user.displayAvatarURL?.() || undefined })] });
  }
  async function replyAutocomplete(i) {
    const q = String(i.options.getFocused() || '').toLowerCase();
    const rows = db.prepare('SELECT name, title FROM ticket_macros ORDER BY uses DESC, title').all().filter((m) => `${m.name} ${m.title}`.toLowerCase().includes(q)).slice(0, 25);
    return i.respond(rows.map((m) => ({ name: m.title.slice(0, 100), value: m.name })));
  }

  // ----- Messages dans les tickets -----
  async function message(m) {
    if (m.author.bot || !m.inGuild()) return;
    const r = row(m.channel.id);
    if (!r) return;
    db.prepare('UPDATE tickets SET last_activity = ?, reminded = 0 WHERE channel_id = ?').run(Date.now(), m.channel.id);
    if (m.author.id !== r.discord_id && isStaff(m.member)) {
      stat.first(m.channel.id, 'equipe', m.author.id);
      // Le staff répond : l'IA se retire
      if (r.status === 'ai') {
        db.prepare("UPDATE tickets SET status = 'claimed', claimed_by = ? WHERE channel_id = ?").run(m.author.id, m.channel.id);
        await m.channel.setName(`${r.priority === 'urgent' ? '🚨・' : ''}🟢・${baseName(m.channel.name)}`).catch(() => {});
      }
      return;
    }
    // Le client écrit (texte ou capture d'écran) : l'assistant répond
    if (m.author.id === r.discord_id && r.status === 'ai' && (m.content || m.attachments.size)) scheduleAi(m.channel, m.content || '[capture d’écran]');
  }

  // ----- Relance et fermeture automatique -----
  async function sweep() {
    const now = Date.now();
    for (const t of db.prepare('SELECT * FROM tickets').all()) {
      const ch = await client.channels.fetch(t.channel_id).catch(() => null);
      if (!ch) { db.prepare('DELETE FROM tickets WHERE channel_id = ?').run(t.channel_id); continue; }
      const idle = now - (t.last_activity || now);
      if (idle > CLOSE_AFTER) {
        await ch.send({ embeds: [new EmbedBuilder().setColor(0x9aa0ad).setDescription('⏰ Ticket fermé automatiquement après 48 h sans réponse. Ouvre un nouveau ticket si besoin.')] }).catch(() => {});
        await close(ch, null, 'inactif 48 h');
      } else if (idle > REMIND_AFTER && !t.reminded) {
        await ch.send({ content: `<@${t.discord_id}>`, embeds: [new EmbedBuilder().setColor(0xf5a524).setDescription('⏰ Toujours besoin d’aide ? Sans réponse de ta part, ce ticket sera fermé automatiquement dans 24 h.')] }).catch(() => {});
        db.prepare('UPDATE tickets SET reminded = 1 WHERE channel_id = ?').run(t.channel_id);
      }
    }
  }

  // Tickets créés avant cette version : on les enregistre pour la relance automatique
  async function adopt(guild) {
    for (const ch of guild.channels.cache.values()) {
      const m = /uid:(\d+);type:(\w+)/.exec(ch.topic || '');
      if (m && !row(ch.id)) db.prepare("INSERT INTO tickets (channel_id, discord_id, type, status, last_activity) VALUES (?, ?, ?, 'staff', ?)").run(ch.id, m[1], m[2], Date.now());
    }
  }

  return {
    open, button, message, adopt, rate, replyCommand, replyAutocomplete,
    jobs: { 'quote.ticket': quoteTicket },
    start() {
      if (!db.prepare('SELECT COUNT(*) n FROM ticket_macros').get().n) {
        const ins = db.prepare('INSERT OR IGNORE INTO ticket_macros (name, title, content) VALUES (?, ?, ?)');
        for (const m of DEFAULT_MACROS) ins.run(...m);
      }
      setInterval(() => sweep().catch((e) => console.error('[tickets]', e.message)), 10 * 60e3);
      // Historique des tickets gardé 3 ans (politique de confidentialité)
      const purge = async () => {
        const ch = await client.channels.fetch(cfg().channels.transcripts).catch(() => null);
        if (!ch) return;
        const limit = Date.now() - 3 * 365 * 864e5;
        const batch = await ch.messages.fetch({ after: '0', limit: 50 }).catch(() => null);
        for (const m of batch?.values() || []) if (m.createdTimestamp < limit) await m.delete().catch(() => {});
      };
      setInterval(() => purge().catch(() => {}), 24 * 3600e3);
    },
  };
}
