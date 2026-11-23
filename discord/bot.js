// Bot Orion (première version) : validation du règlement, rôles de notification, tickets, logs.
// Lancer :  npm start   (en continu avec PM2 : pm2 start npm --name orion-bot -- start)
import dotenv from 'dotenv';
// .env du bot, puis celui du site (clé Tebex secrète, etc.) sans écraser.
dotenv.config({ path: new URL('./.env', import.meta.url).pathname });
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
import fs from 'node:fs';
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, Events,
  GatewayIntentBits, MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder,
} from 'discord.js';
import { COLOR, NOTIF_ROLES, ROLES, TICKETS } from './structure.js';
import { addJob, db, startJobs } from './jobs.js';
import { MOD_COMMANDS, createModeration } from './moderation.js';
import { createTickets } from './tickets.js';

const CONFIG = new URL('./config.json', import.meta.url);
const loadCfg = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
if (!fs.existsSync(CONFIG)) {
  console.error('✗ discord/config.json absent : lance d’abord « npm run setup ».');
  process.exit(1);
}
let cfg = loadCfg();
fs.watchFile(CONFIG, { interval: 5000 }, () => { try { cfg = loadCfg(); } catch { /* fichier en cours d'écriture */ } });

// Message Content : à activer dans le portail Discord (onglet Bot) pour l'assistant des tickets.
const client = new Client({ intents: [
  GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
] });
const staffIds = () => ROLES.filter((r) => r.staff || r.key === 'founder').map((r) => cfg.roles[r.key]).filter(Boolean);
const isStaff = (member) => member.permissions.has(P.Administrator) || staffIds().some((id) => member.roles.cache.has(id));
const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });

async function logTo(guild, key, embed) {
  try {
    const ch = await guild.channels.fetch(cfg.channels[key]);
    await ch.send({ embeds: [embed] });
  } catch { /* salon absent */ }
}

let jobs = null;
const mod = createModeration({ db, getCfg: () => cfg });
const tickets = createTickets({ client, db, getCfg: () => cfg, staffIds, isStaff });

const COMMANDS = [
  new SlashCommandBuilder().setName('mes-scripts').setDescription('Voir les scripts Orion que tu possèdes'),
  new SlashCommandBuilder().setName('client').setDescription('Infos client (équipe)')
    .setDefaultMemberPermissions(P.ManageMessages)
    .addSubcommand((s) => s.setName('info').setDescription('Voir les achats d’un membre').addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)))
    .addSubcommand((s) => s.setName('resync').setDescription('Redonner le rôle Client et recréer son salon').addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))),
];

client.once(Events.ClientReady, async (c) => {
  console.log(`✓ Bot connecté : ${c.user.tag}`);
  c.user.setPresence({ activities: [{ name: 'jdev-hub.fr', type: 3 }], status: 'online' });
  jobs = startJobs(client, () => cfg, tickets.jobs);
  try {
    const guild = await c.guilds.fetch(process.env.GUILD_ID);
    await guild.commands.set([...COMMANDS, ...MOD_COMMANDS].map((x) => x.toJSON()));
    console.log(`✓ ${COMMANDS.length + MOD_COMMANDS.length} commandes enregistrées`);
    await tickets.adopt(guild);
    tickets.start();
  } catch (e) { console.error('Commandes :', e.message); }
});

// Arrivées / départs
client.on(Events.GuildMemberAdd, (m) => {
  if (m.guild.id !== process.env.GUILD_ID) return;
  jobs?.memberJoined();
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

    if (i.isAutocomplete()) return mod.autocomplete(i);
    if (i.isButton() && i.customId.startsWith('orion:grant')) return mod.button(i);

    // Commandes slash
    if (i.isChatInputCommand() && mod.names.has(i.commandName)) return mod.command(i);
    if (i.isChatInputCommand()) {
      if (i.commandName === 'mes-scripts') {
        const list = jobs?.owned(i.user.id) || [];
        if (!list.length) return i.reply(ephemeral(`Aucun script lié à ton compte Discord. Achète sur ${(process.env.SITE_URL || 'https://jdev-hub.fr')} en étant connecté avec Discord, ou ouvre un ticket avec ton numéro de commande Tebex.`));
        const { count, ...panel } = jobs.clientPanel(i.user.id);
        return i.reply({ ...panel, flags: MessageFlags.Ephemeral });
      }
      if (i.commandName === 'client') {
        if (!isStaff(i.member)) return i.reply(ephemeral('Réservé à l’équipe.'));
        const target = i.options.getUser('membre', true);
        if (i.options.getSubcommand() === 'resync') {
          addJob('customer.resync', { discord_id: target.id });
          return i.reply(ephemeral(`🔄 Resynchronisation de <@${target.id}> lancée.`));
        }
        const list = jobs?.owned(target.id) || [];
        return i.reply({ flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`Client · ${target.tag}`)
          .setDescription(list.length ? list.map((s) => `• **${s.name}**${s.version ? ` v${s.version}` : ''}`).join('\n') : 'Aucun achat lié à ce compte Discord.')] });
      }
      return;
    }

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

    // Tickets (ouverture, IA, transfert, prise en charge, fermeture)
    if (i.isStringSelectMenu() && i.customId === 'orion:ticket') return tickets.open(i);
    if (i.isButton() && (i.customId.startsWith('orion:ticket:') || i.customId.startsWith('orion:ai:'))) return tickets.button(i);
  } catch (e) {
    console.error('[interaction]', e);
    const msg = 'Une erreur est survenue. Préviens un membre de l’équipe.';
    if (i.deferred || i.replied) i.editReply?.(msg).catch(() => {});
    else if (!i.isAutocomplete?.()) i.reply?.(ephemeral(msg)).catch(() => {});
  }
});

client.on(Events.MessageCreate, (m) => { tickets.message(m).catch((e) => console.error('[ticket msg]', e.message)); });

client.login(process.env.DISCORD_TOKEN);
