// Tickets : création, fiche client, assistant automatique (recherche dans la doc), transfert au staff, prise en charge, relance et fermeture auto.
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits as P,
} from 'discord.js';
import { COLOR, TICKETS } from './structure.js';
import { WaitMember } from './jobs.js';
import { createAgent } from './ai.js';

const AI_FOOTER = 'Assistant Orion · réponse automatique';
const IA_FOOTER = 'Assistant Orion · IA';
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

const baseName = (name) => name.replace(/^[🔴🟢🤖]・?/u, '');

export function createTickets({ client, db, getCfg, staffIds, isStaff }) {
  const cfg = () => getCfg();
  const agent = createAgent({ db });
  const eph = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, ...extra });
  const row = (id) => db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(id);
  const supportRoles = () => ['support', 'mod', 'dev'].map((k) => cfg().roles[k]).filter(Boolean);

  const buttons = (ai) => new ActionRowBuilder().addComponents(
    ...(ai ? [
      new ButtonBuilder().setCustomId('orion:ai:solved').setStyle(ButtonStyle.Success).setLabel('C’est résolu').setEmoji('✅'),
      new ButtonBuilder().setCustomId('orion:ai:human').setStyle(ButtonStyle.Primary).setLabel('Parler à l’équipe').setEmoji('🙋'),
    ] : []),
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

    await channel.send({
      content: `<@${i.user.id}>`,
      embeds: [
        new EmbedBuilder().setColor(COLOR).setTitle(`${t.emoji} ${t.label}`).setTimestamp()
          .setDescription(`Merci <@${i.user.id}> !\n\n${HELP[t.value]}\n\n${ai
            ? (agent.ready() ? '🤖 **L’assistant Orion (IA)** te répond tout de suite. S’il ne peut pas t’aider, il passe la main à l’équipe, ou clique sur **Parler à l’équipe**.' : '🤖 **L’assistant Orion** te propose tout de suite les pages de la doc qui correspondent à ton message. Si ça ne suffit pas, clique sur **Parler à l’équipe** : un membre du staff prendra le relais.')
            : 'L’équipe arrive.'}`),
        clientSheet(i.user.id, i.member),
      ],
      components: [buttons(ai)],
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
      await channel.send({
        content: `<@${q.discord_id}> ${roles.map((id) => `<@&${id}>`).join(' ')}`,
        allowedMentions: { users: [q.discord_id], roles },
        embeds: [
          new EmbedBuilder().setColor(COLOR).setDescription(`Merci <@${q.discord_id}> pour ta demande de devis ! L’équipe te répond **ici** sous 24 h avec un prix et un délai. Tu peux ajouter des détails, captures ou exemples dans ce salon.`),
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
  async function transfer(channel, why) {
    const r = row(channel.id);
    if (!r || r.status !== 'ai') return;
    db.prepare("UPDATE tickets SET status = 'staff' WHERE channel_id = ?").run(channel.id);
    await channel.setName(`🔴・${baseName(channel.name)}`).catch(() => {});
    const roles = supportRoles();
    await channel.send({
      content: roles.map((id) => `<@&${id}>`).join(' ') || undefined,
      allowedMentions: { roles },
      embeds: [new EmbedBuilder().setColor(0xff7a2f).setTitle('🙋 Ticket transféré à l’équipe')
        .setDescription(`${why}\n\nUn membre du staff va prendre le relais. L’assistant automatique ne répond plus dans ce ticket.`)],
    });
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

    // Le cerveau de l'IA apprend de ce ticket (en arrière-plan, 1 appel Haiku)
    if (r) {
      const transcript = all.filter((m) => !m.system).map((m) => {
        const iaMsg = m.author.id === client.user.id && [AI_FOOTER, IA_FOOTER].includes(m.embeds[0]?.footer?.text);
        const who = m.author.id === r.discord_id ? 'client' : iaMsg ? 'ia' : m.author.bot ? null : 'equipe';
        const text = (iaMsg ? m.embeds[0].description : m.content) || '';
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
        const text = [m.content, ...m.attachments.map((a) => `[pièce jointe : ${a.name}]`)].filter(Boolean).join('\n').slice(0, 1500);
        if (text) out.push({ role: 'user', text });
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
    const turns = r.ai_turns + 1;
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
    if (res.transfer) await transfer(channel, `L’assistant a transmis la demande : ${res.transfer}`);
    else if (turns >= agent.settings().max_turns) await transfer(channel, `L’assistant a répondu ${turns} fois sans résoudre la demande.`);
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
      await i.channel.setName(`🟢・${baseName(i.channel.name)}`).catch(() => {});
      return i.reply({ embeds: [new EmbedBuilder().setColor(0x4ade80).setDescription(`🫡 Ticket pris en charge par <@${i.user.id}>.`)] });
    }
    if (i.customId === 'orion:ticket:close') {
      if (!isStaff(i.member) && !mine) return i.reply(eph('Seuls l’équipe ou l’auteur peuvent fermer ce ticket.'));
      await i.reply({ embeds: [new EmbedBuilder().setColor(0x9aa0ad).setDescription(`🔒 Ticket fermé par <@${i.user.id}>. Suppression dans 5 secondes…`)] });
      return close(i.channel, i.user.id, isStaff(i.member) ? 'fermé par l’équipe' : 'fermé par le client');
    }
  }

  // ----- Messages dans les tickets -----
  async function message(m) {
    if (m.author.bot || !m.inGuild()) return;
    const r = row(m.channel.id);
    if (!r) return;
    db.prepare('UPDATE tickets SET last_activity = ?, reminded = 0 WHERE channel_id = ?').run(Date.now(), m.channel.id);
    if (m.author.id !== r.discord_id && isStaff(m.member)) {
      // Le staff répond : l'IA se retire
      if (r.status === 'ai') {
        db.prepare("UPDATE tickets SET status = 'claimed', claimed_by = ? WHERE channel_id = ?").run(m.author.id, m.channel.id);
        await m.channel.setName(`🟢・${baseName(m.channel.name)}`).catch(() => {});
      }
      return;
    }
    if (m.author.id === r.discord_id && r.status === 'ai' && m.content) scheduleAi(m.channel, m.content);
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
    open, button, message, adopt,
    jobs: { 'quote.ticket': quoteTicket },
    start() {
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
