// Tâches envoyées par le site (table "jobs" de la base partagée) et exécutées par le bot.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits as P } from 'discord.js';
import { SCHEMA } from '../db/schema.mjs';
import { COLOR, ROLES } from './structure.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(process.env.DATABASE_PATH || path.resolve(here, '../data/orion.db'));
db.pragma('busy_timeout = 5000');
db.exec(SCHEMA);

const site = () => (process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');
const logo = () => `${site()}/logo.png`;
const eur = (n) => (Number(n) === 0 ? 'Gratuit' : Number(n).toFixed(2).replace('.', ',') + ' €');
const day = (s) => new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

export const getSetting = (key, fallback = null) => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!r) return fallback;
  try { return JSON.parse(r.value); } catch { return r.value; }
};
export const setSetting = (key, value) =>
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
export const addJob = (type, payload) => db.prepare('INSERT INTO jobs (type, payload) VALUES (?, ?)').run(type, JSON.stringify(payload));

class WaitMember extends Error {}

export function startJobs(client, getCfg) {
  const cfg = () => getCfg();
  const guild = () => client.guilds.cache.get(process.env.GUILD_ID);
  const staffIds = () => ROLES.filter((r) => r.staff || r.key === 'founder').map((r) => cfg().roles[r.key]).filter(Boolean);
  const channel = async (key) => guild().channels.fetch(cfg().channels[key]);

  async function log(text, color = COLOR) {
    try { (await channel('logs')).send({ embeds: [new EmbedBuilder().setColor(color).setDescription(text).setTimestamp()] }); } catch { /* rien */ }
  }

  // ----- Scripts possédés par un client -----
  function owned(discordId) {
    return db.prepare(`
      SELECT oi.product_key key, MAX(oi.name) name, MIN(o.created_at) first, MAX(p.version) version
      FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.key = oi.product_key
      WHERE o.discord_id = ? AND o.status = 'paid' GROUP BY oi.product_key ORDER BY first`).all(discordId);
  }

  function clientPanel(discordId) {
    const list = owned(discordId);
    const embed = new EmbedBuilder().setColor(COLOR).setTitle('📦 Tes scripts Orion').setThumbnail(logo())
      .setDescription(list.length
        ? list.map((s) => `**${s.name}**${s.version ? ` · v${s.version}` : ''} · acheté le ${day(s.first)}`).join('\n')
        : 'Aucun script actif.')
      .addFields({ name: 'Téléchargement', value: 'Dans ton Keymaster : portal.cfx.re → Granted assets. Les mises à jour arrivent au même endroit et sont annoncées ici.' })
      .setFooter({ text: 'Orion Scripts · salon privé', iconURL: logo() }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Keymaster').setEmoji('🔑').setURL('https://portal.cfx.re/assets/granted-assets'),
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Mon compte').setEmoji('👤').setURL(`${site()}/compte`),
    );
    if (cfg().channels.install) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Installation').setEmoji('📚').setURL(`https://discord.com/channels/${process.env.GUILD_ID}/${cfg().channels.install}`));
    return { embeds: [embed], components: [row], count: list.length };
  }

  // Catégorie avec de la place (50 salons max par catégorie Discord)
  async function customerCategory() {
    const g = guild();
    const ids = [cfg().channels.catCustomers, ...getSetting('customer_categories', [])].filter(Boolean);
    await g.channels.fetch();
    for (const id of ids) {
      const cat = g.channels.cache.get(id);
      if (cat && g.channels.cache.filter((c) => c.parentId === id).size < 50) return cat;
    }
    const first = g.channels.cache.get(cfg().channels.catCustomers);
    const cat = await g.channels.create({
      name: `📦 SALONS CLIENTS ${ids.length + 1}`, type: ChannelType.GuildCategory,
      permissionOverwrites: first ? first.permissionOverwrites.cache.map((o) => ({ id: o.id, allow: o.allow, deny: o.deny })) : [{ id: g.roles.everyone.id, deny: [P.ViewChannel] }],
    });
    setSetting('customer_categories', [...getSetting('customer_categories', []), cat.id]);
    return cat;
  }

  // Un seul salon par client : retrouvé s'il existe, recréé seulement s'il a été supprimé.
  async function ensureChannel(member) {
    const g = guild();
    const row = db.prepare('SELECT * FROM customer_channels WHERE discord_id = ?').get(member.id);
    if (row) {
      const ch = await g.channels.fetch(row.channel_id).catch(() => null);
      if (ch) return { ch, row, created: false };
    }
    const cat = await customerCategory();
    const name = `📦・${member.user.username}`.toLowerCase().replace(/[^\p{L}\p{N}・📦_-]/gu, '').slice(0, 90);
    const ch = await g.channels.create({
      name, type: ChannelType.GuildText, parent: cat.id,
      topic: `Salon privé de ${member.user.tag} · uid:${member.id}`,
      permissionOverwrites: [
        { id: g.roles.everyone.id, deny: [P.ViewChannel] },
        { id: member.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.AddReactions] },
        ...staffIds().map((id) => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.ManageMessages] })),
        { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.ManageMessages, P.EmbedLinks] },
      ],
    });
    db.prepare('INSERT INTO customer_channels (discord_id, channel_id, message_id) VALUES (?, ?, NULL) ON CONFLICT(discord_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = NULL').run(member.id, ch.id);
    return { ch, row: { discord_id: member.id, channel_id: ch.id, message_id: null }, created: true };
  }

  // Message épinglé « Tes scripts » : modifié, jamais dupliqué.
  async function refreshPanel(ch, discordId) {
    const row = db.prepare('SELECT * FROM customer_channels WHERE discord_id = ?').get(discordId);
    const { count, ...payload } = clientPanel(discordId);
    if (row?.message_id) {
      const msg = await ch.messages.fetch(row.message_id).catch(() => null);
      if (msg) { await msg.edit(payload); return count; }
    }
    const msg = await ch.send(payload);
    await msg.pin().catch(() => {});
    db.prepare('UPDATE customer_channels SET message_id = ? WHERE discord_id = ?').run(msg.id, discordId);
    return count;
  }

  async function member(discordId) {
    const m = await guild().members.fetch(discordId).catch(() => null);
    if (!m) throw new WaitMember('Le client n’est pas encore sur le serveur Discord');
    return m;
  }

  const handlers = {
    async 'purchase.completed'({ order_id, silent }) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
      if (!order || order.status !== 'paid') return;
      const names = db.prepare('SELECT name FROM order_items WHERE order_id = ?').all(order_id).map((r) => r.name);
      if (!order.discord_id) {
        await log(`💸 Achat **sans compte Discord** : ${names.join(', ')} · ${eur(order.total)} · ${order.customer || 'client inconnu'} (${order.tebex_tx})`);
        return;
      }
      const m = await member(order.discord_id);
      if (cfg().roles.client) await m.roles.add(cfg().roles.client, 'Achat Tebex');
      const { ch, created } = await ensureChannel(m);
      if (created) {
        await ch.send({ content: `<@${m.id}>`, embeds: [new EmbedBuilder().setColor(COLOR).setTitle('Bienvenue dans ton salon privé')
          .setDescription('Merci pour ton achat ! Ce salon est visible seulement par toi et l’équipe Orion. Tous tes scripts y sont listés, et chaque mise à jour y est annoncée.\n\nUne question ? Écris ici ou ouvre un ticket « Support ».')] });
      }
      await refreshPanel(ch, m.id);
      if (!silent && !created) await ch.send({ content: `<@${m.id}>`, embeds: [new EmbedBuilder().setColor(0x4ade80).setDescription(`✅ Ajouté à tes scripts : **${names.join(', ')}**`)] });
      await log(`💎 Achat : <@${m.id}> · **${names.join(', ')}** · ${eur(order.total)} → <#${ch.id}>`, 0x4ade80);
    },

    async 'purchase.revoked'({ order_id, reason }) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
      if (!order) return;
      const names = db.prepare('SELECT name FROM order_items WHERE order_id = ?').all(order_id).map((r) => r.name).join(', ');
      await log(`⚠️ ${reason === 'refunded' ? 'Remboursement' : 'Litige'} : ${order.discord_id ? `<@${order.discord_id}>` : order.customer || '?'} · ${names} (${order.tebex_tx})`, 0xff7a2f);
      if (!order.discord_id) return;
      const m = await guild().members.fetch(order.discord_id).catch(() => null);
      const row = db.prepare('SELECT * FROM customer_channels WHERE discord_id = ?').get(order.discord_id);
      const ch = row ? await guild().channels.fetch(row.channel_id).catch(() => null) : null;
      const left = ch ? await refreshPanel(ch, order.discord_id) : owned(order.discord_id).length;
      if (!left && m && cfg().roles.client) await m.roles.remove(cfg().roles.client, 'Plus aucun achat actif');
      if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(0x9aa0ad).setDescription(`La commande ${order.tebex_tx} (${names}) a été ${reason === 'refunded' ? 'remboursée' : 'contestée'} : les scripts concernés sont retirés de ta liste.`)] });
    },

    async 'customer.resync'({ discord_id }) {
      const m = await guild().members.fetch(discord_id).catch(() => null);
      if (!m) throw new Error('Ce client n’est pas sur le serveur Discord');
      const list = owned(discord_id);
      if (!list.length) {
        if (cfg().roles.client) await m.roles.remove(cfg().roles.client).catch(() => {});
        return;
      }
      if (cfg().roles.client) await m.roles.add(cfg().roles.client, 'Resynchronisation');
      const { ch } = await ensureChannel(m);
      await refreshPanel(ch, discord_id);
    },

    async 'product.announce'(p) {
      const price = p.was ? `~~${eur(p.was)}~~ **${eur(p.price)}** (−${p.pct} %)` : `**${eur(p.price)}**`;
      const embed = new EmbedBuilder().setColor(COLOR).setAuthor({ name: 'Nouveau script', iconURL: logo() })
        .setTitle(p.name).setURL(p.url).setDescription(p.desc || null)
        .addFields({ name: 'Prix', value: price, inline: true }, { name: 'Frameworks', value: 'ESX · QBCore · QBox', inline: true },
          ...(p.version ? [{ name: 'Version', value: p.version, inline: true }] : []))
        .setFooter({ text: 'Livré dans ton Keymaster juste après l’achat', iconURL: logo() }).setTimestamp();
      if (p.image) embed.setImage(p.image);
      const role = cfg().roles.notifNew;
      await (await channel('news')).send({
        content: role ? `<@&${role}>` : undefined,
        allowedMentions: { roles: role ? [role] : [] },
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Voir sur le site').setEmoji('🌐').setURL(p.url),
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Toute la boutique').setEmoji('🛒').setURL(site()),
        )],
      });
    },

    async 'promo.announce'(p) {
      const role = cfg().roles.notifPromo;
      await (await channel('promos')).send({
        content: role ? `<@&${role}>` : undefined, allowedMentions: { roles: role ? [role] : [] },
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`🏷️ ${p.title}`).setURL(p.url).setDescription(p.text).setFooter({ text: 'Réduction appliquée automatiquement au paiement', iconURL: logo() })],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('En profiter').setEmoji('🛒').setURL(p.url))],
      });
    },

    async 'script.updated'(p) {
      const notes = p.notes.split('\n').map((l) => l.trim()).filter(Boolean).map((l) =>
        l.startsWith('+') ? `🟢 ${l.slice(1).trim()}` : l.startsWith('-') ? `🔴 ${l.slice(1).trim()}` : l.startsWith('~') ? `🟠 ${l.slice(1).trim()}` : `• ${l}`).join('\n');
      const embed = () => new EmbedBuilder().setColor(COLOR).setTitle(`📝 ${p.name} · v${p.version}`).setURL(p.url).setDescription(notes)
        .setThumbnail(p.image || logo()).setFooter({ text: 'Mise à jour disponible dans ton Keymaster', iconURL: logo() }).setTimestamp();
      const role = cfg().roles.notifPatch;
      await (await channel('patchnotes')).send({ content: role ? `<@&${role}>` : undefined, allowedMentions: { roles: role ? [role] : [] }, embeds: [embed()] });
      if (cfg().channels.clientUpdates) await (await channel('clientUpdates')).send({ embeds: [embed()] }).catch(() => {});
      if (!p.notifyClients) return;
      const owners = db.prepare(`SELECT DISTINCT o.discord_id FROM orders o JOIN order_items oi ON oi.order_id = o.id
        WHERE oi.product_key = ? AND o.status = 'paid' AND o.discord_id IS NOT NULL`).all(p.key);
      for (const { discord_id } of owners) {
        const row = db.prepare('SELECT * FROM customer_channels WHERE discord_id = ?').get(discord_id);
        const ch = row ? await guild().channels.fetch(row.channel_id).catch(() => null) : null;
        if (!ch) continue;
        await ch.send({ content: `<@${discord_id}>`, embeds: [embed()] }).catch(() => {});
        await refreshPanel(ch, discord_id).catch(() => {});
      }
    },

    async 'announce.custom'(p) {
      const ch = await channel(p.channel);
      const pingId = p.ping === 'everyone' ? null : p.ping ? cfg().roles[p.ping] : null;
      const embed = new EmbedBuilder().setColor(COLOR).setTitle(p.title).setDescription(p.text).setFooter({ text: 'Orion Scripts', iconURL: logo() }).setTimestamp();
      if (p.image) embed.setImage(p.image);
      await ch.send({
        content: p.ping === 'everyone' ? '@everyone' : pingId ? `<@&${pingId}>` : undefined,
        allowedMentions: p.ping === 'everyone' ? { parse: ['everyone'] } : { roles: pingId ? [pingId] : [] },
        embeds: [embed],
        components: p.link ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('En savoir plus').setURL(p.link))] : [],
      });
    },

    async 'maintenance.changed'(p) {
      await (await channel('announcements')).send({ embeds: [new EmbedBuilder().setColor(p.on ? 0xff7a2f : 0x4ade80)
        .setTitle(p.on ? '🛠️ Boutique en maintenance' : '✅ Boutique de retour en ligne')
        .setDescription(p.on ? `${p.message || 'Le site revient très vite.'}${p.until ? `\n\nRetour prévu : **${p.until}**` : ''}\n\nTes scripts restent disponibles dans ton Keymaster.` : `La boutique est de nouveau accessible : ${site()}`)] });
    },
  };

  let running = false;
  async function tick() {
    if (running || !guild()) return;
    running = true;
    try {
      const jobs = db.prepare("SELECT * FROM jobs WHERE status = 'pending' AND run_after <= ? ORDER BY id LIMIT 5").all(Date.now());
      for (const j of jobs) {
        const fn = handlers[j.type];
        try {
          if (!fn) throw new Error(`Tâche inconnue : ${j.type}`);
          await fn(JSON.parse(j.payload || '{}'));
          db.prepare("UPDATE jobs SET status = 'done', error = NULL, done_at = CURRENT_TIMESTAMP WHERE id = ?").run(j.id);
        } catch (e) {
          if (e instanceof WaitMember) {
            db.prepare("UPDATE jobs SET status = 'waiting', error = ? WHERE id = ?").run(e.message, j.id);
            continue;
          }
          const attempts = j.attempts + 1;
          const final = attempts >= 5;
          db.prepare('UPDATE jobs SET status = ?, attempts = ?, error = ?, run_after = ? WHERE id = ?')
            .run(final ? 'error' : 'pending', attempts, String(e.message || e).slice(0, 500), Date.now() + 2 ** attempts * 10e3, j.id);
          console.error(`[job ${j.id} ${j.type}]`, e.message);
          if (final) await log(`❌ Tâche **${j.type}** #${j.id} en échec : ${String(e.message).slice(0, 300)}`, 0xff7a2f);
        }
      }
    } finally {
      running = false;
    }
  }

  setInterval(tick, 3000);
  setInterval(() => setSetting('bot_heartbeat', Date.now()), 60e3);
  setSetting('bot_heartbeat', Date.now());
  // Réveille le site toutes les 5 min : il relit Tebex et détecte les nouveaux scripts à annoncer.
  const port = process.env.SITE_PORT || 3000;
  setInterval(() => fetch(`http://127.0.0.1:${port}/api/health`).catch(() => {}), 5 * 60e3);

  return {
    // Un membre arrive : on reprend les achats qui l'attendaient.
    memberJoined() { db.prepare("UPDATE jobs SET status = 'pending', run_after = 0 WHERE status = 'waiting'").run(); },
    owned,
    clientPanel,
  };
}
