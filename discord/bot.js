// Bot Orion (première version) : validation du règlement, rôles de notification, tickets, logs.
// Lancer :  npm start   (en continu avec PM2 : pm2 start npm --name orion-bot -- start)
import 'dotenv/config';
import fs from 'node:fs';
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, Events,
  GatewayIntentBits, MessageFlags, PermissionFlagsBits as P,
} from 'discord.js';
import { COLOR, NOTIF_ROLES, ROLES, TICKETS } from './structure.js';

const CONFIG = new URL('./config.json', import.meta.url);
const loadCfg = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
if (!fs.existsSync(CONFIG)) {
  console.error('✗ discord/config.json absent : lance d’abord « npm run setup ».');
  process.exit(1);
}
let cfg = loadCfg();
fs.watchFile(CONFIG, { interval: 5000 }, () => { try { cfg = loadCfg(); } catch { /* fichier en cours d'écriture */ } });

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const staffIds = () => ROLES.filter((r) => r.staff || r.key === 'founder').map((r) => cfg.roles[r.key]).filter(Boolean);
const isStaff = (member) => member.permissions.has(P.Administrator) || staffIds().some((id) => member.roles.cache.has(id));
const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });

async function logTo(guild, key, embed) {
  try {
    const ch = await guild.channels.fetch(cfg.channels[key]);
    await ch.send({ embeds: [embed] });
  } catch { /* salon absent */ }
}

client.once(Events.ClientReady, (c) => {
  console.log(`✓ Bot connecté : ${c.user.tag}`);
  c.user.setPresence({ activities: [{ name: 'jdev-hub.fr', type: 3 }], status: 'online' });
});

// Arrivées / départs
client.on(Events.GuildMemberAdd, (m) => {
  if (m.guild.id !== process.env.GUILD_ID) return;
  logTo(m.guild, 'logs', new EmbedBuilder().setColor(0x4ade80).setAuthor({ name: m.user.tag, iconURL: m.user.displayAvatarURL() })
    .setDescription(`📥 <@${m.id}> a rejoint le serveur\nCompte créé <t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`).setTimestamp());
});
client.on(Events.GuildMemberRemove, (m) => {
  if (m.guild.id !== process.env.GUILD_ID) return;
  logTo(m.guild, 'logs', new EmbedBuilder().setColor(0x9aa0ad).setAuthor({ name: m.user.tag, iconURL: m.user.displayAvatarURL() })
    .setDescription(`📤 <@${m.id}> a quitté le serveur`).setTimestamp());
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.inGuild()) return;

    // Règlement accepté → rôle Membre
    if (i.isButton() && i.customId === 'orion:verify') {
      if (i.member.roles.cache.has(cfg.roles.member)) return i.reply(ephemeral('Tu as déjà accepté le règlement. Bienvenue !'));
      await i.member.roles.add(cfg.roles.member, 'Règlement accepté');
      return i.reply(ephemeral(`✅ Bienvenue ! Tu as maintenant accès au serveur. Choisis tes notifications dans <#${cfg.channels.roles}>.`));
    }

    // Rôles de notification
    if (i.isButton() && i.customId.startsWith('orion:notif:')) {
      const key = i.customId.slice('orion:notif:'.length);
      const n = NOTIF_ROLES.find((r) => r.key === key);
      const roleId = cfg.roles[key];
      if (!n || !roleId) return i.reply(ephemeral('Ce rôle n’existe plus.'));
      if (i.member.roles.cache.has(roleId)) {
        await i.member.roles.remove(roleId);
        return i.reply(ephemeral(`🔕 Tu ne recevras plus les notifications **${n.label}**.`));
      }
      await i.member.roles.add(roleId);
      return i.reply(ephemeral(`🔔 Tu recevras les notifications **${n.label}**.`));
    }

    // Ouverture d'un ticket
    if (i.isStringSelectMenu() && i.customId === 'orion:ticket') {
      const t = TICKETS.find((x) => x.value === i.values[0]);
      if (!t) return i.reply(ephemeral('Type de ticket inconnu.'));
      if (!i.member.roles.cache.has(cfg.roles.member) && !isStaff(i.member)) {
        return i.reply(ephemeral(`Accepte d’abord le règlement dans <#${cfg.channels.rules}>.`));
      }
      if (t.clientOnly && !i.member.roles.cache.has(cfg.roles.client) && !isStaff(i.member)) {
        return i.reply(ephemeral('Ce type de ticket est réservé aux clients. Tu as acheté un script mais n’as pas le rôle ? Ouvre un ticket « Autre » avec ton numéro de commande Tebex.'));
      }
      const marker = `uid:${i.user.id};type:${t.value}`;
      const existing = i.guild.channels.cache.find((c) => c.topic?.includes(marker));
      if (existing) return i.reply(ephemeral(`Tu as déjà un ticket ouvert pour ça : <#${existing.id}>`));

      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const name = `${t.value}-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || `ticket-${t.value}`;
      const channel = await i.guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: cfg.channels[t.category],
        topic: `${t.emoji} ${t.label} · ${i.user.tag} · ${marker}`,
        permissionOverwrites: [
          { id: i.guild.roles.everyone.id, deny: [P.ViewChannel] },
          { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
          ...staffIds().map((id) => ({ id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.ManageMessages] })),
          { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageChannels, P.EmbedLinks] },
        ],
      });
      const help = {
        support: 'Indique le **script**, sa **version**, ton **framework** et ce qui ne va pas (captures, erreurs F8 / console).',
        bug: 'Indique le **script** et sa **version**, ce qui se passe, comment le reproduire, et les erreurs F8 / console.',
        presale: 'Pose ta question : script concerné, ton framework, ton inventaire…',
        partner: 'Présente ton serveur : nom, nombre de joueurs, framework, et ce dont tu as besoin. Formules de 20 à 200 € par mois.',
        custom: 'Décris le script ou le bot voulu, ton framework et ton budget. Devis gratuit sous 24 h.',
        other: 'Explique ta demande, on te répond vite.',
      }[t.value];
      await channel.send({
        content: `<@${i.user.id}>`,
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`${t.emoji} ${t.label}`).setDescription(`Merci <@${i.user.id}>, l’équipe arrive.\n\n${help}`).setTimestamp()],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('orion:ticket:claim').setStyle(ButtonStyle.Secondary).setLabel('Prendre en charge').setEmoji('🙋'),
          new ButtonBuilder().setCustomId('orion:ticket:close').setStyle(ButtonStyle.Danger).setLabel('Fermer').setEmoji('🔒'),
        )],
      });
      logTo(i.guild, 'logs', new EmbedBuilder().setColor(COLOR).setDescription(`🎫 Ticket **${t.label}** ouvert par <@${i.user.id}> : <#${channel.id}>`).setTimestamp());
      return i.editReply(`✅ Ton ticket est ouvert : <#${channel.id}>`);
    }

    // Prise en charge
    if (i.isButton() && i.customId === 'orion:ticket:claim') {
      if (!isStaff(i.member)) return i.reply(ephemeral('Réservé à l’équipe.'));
      return i.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`🙋 Ticket pris en charge par <@${i.user.id}>.`)] });
    }

    // Fermeture : transcript dans #transcripts puis suppression
    if (i.isButton() && i.customId === 'orion:ticket:close') {
      const owner = /uid:(\d+)/.exec(i.channel.topic || '')?.[1];
      if (!isStaff(i.member) && i.user.id !== owner) return i.reply(ephemeral('Seuls l’équipe ou l’auteur peuvent fermer ce ticket.'));
      await i.reply({ embeds: [new EmbedBuilder().setColor(0x9aa0ad).setDescription(`🔒 Ticket fermé par <@${i.user.id}>. Suppression dans 5 secondes…`)] });

      const all = [];
      let before;
      for (let n = 0; n < 10; n++) {
        const batch = await i.channel.messages.fetch({ limit: 100, before });
        if (!batch.size) break;
        all.push(...batch.values());
        before = batch.last().id;
      }
      const lines = all.reverse().map((m) => {
        const when = new Date(m.createdTimestamp).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
        const text = [m.content, ...m.embeds.map((e) => [e.title, e.description].filter(Boolean).join(' — ')), ...m.attachments.map((a) => a.url)].filter(Boolean).join(' | ');
        return `[${when}] ${m.author.tag} : ${text}`;
      });
      const file = new AttachmentBuilder(Buffer.from(`Ticket ${i.channel.name}\n${i.channel.topic || ''}\n\n${lines.join('\n')}\n`, 'utf8'), { name: `${i.channel.name}.txt` });
      try {
        const tr = await i.guild.channels.fetch(cfg.channels.transcripts);
        await tr.send({
          embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`🗂️ ${i.channel.name}`)
            .setDescription(`Auteur : ${owner ? `<@${owner}>` : 'inconnu'}\nFermé par : <@${i.user.id}>\nMessages : ${lines.length}`).setTimestamp()],
          files: [file],
        });
      } catch { /* salon des transcripts absent */ }
      setTimeout(() => i.channel.delete('Ticket fermé').catch(() => {}), 5000);
    }
  } catch (e) {
    console.error('[interaction]', e);
    const msg = 'Une erreur est survenue. Préviens un membre de l’équipe.';
    if (i.deferred || i.replied) i.editReply?.(msg).catch(() => {});
    else i.reply?.(ephemeral(msg)).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
