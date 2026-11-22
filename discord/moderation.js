// Commandes d'équipe : donner un package Tebex à un joueur FiveM, et outils de modération.
import crypto from 'node:crypto';
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder,
} from 'discord.js';
import { COLOR } from './structure.js';

const DURATIONS = [['5 minutes', 5], ['10 minutes', 10], ['1 heure', 60], ['6 heures', 360], ['1 jour', 1440], ['7 jours', 10080]];
const AUTO_MUTE_AT = 3; // avertissements avant une exclusion temporaire automatique (1 h)

export const MOD_COMMANDS = [
  new SlashCommandBuilder().setName('donner').setDescription('Donner un package Tebex à un joueur (pseudo FiveM / Cfx.re)')
    .setDefaultMemberPermissions(P.Administrator)
    .addStringOption((o) => o.setName('joueur').setDescription('Pseudo Cfx.re exact du joueur').setRequired(true).setMaxLength(60))
    .addStringOption((o) => o.setName('package').setDescription('Le script à donner').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('raison').setDescription('Note interne (partenariat, test, geste commercial…)').setMaxLength(150)),
  new SlashCommandBuilder().setName('ban').setDescription('Bannir un membre').setDefaultMemberPermissions(P.BanMembers)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addStringOption((o) => o.setName('raison').setDescription('Raison').setMaxLength(400))
    .addIntegerOption((o) => o.setName('effacer').setDescription('Effacer ses messages des X derniers jours').setMinValue(0).setMaxValue(7)),
  new SlashCommandBuilder().setName('unban').setDescription('Débannir un utilisateur').setDefaultMemberPermissions(P.BanMembers)
    .addStringOption((o) => o.setName('id').setDescription('Identifiant Discord').setRequired(true))
    .addStringOption((o) => o.setName('raison').setDescription('Raison').setMaxLength(400)),
  new SlashCommandBuilder().setName('kick').setDescription('Expulser un membre').setDefaultMemberPermissions(P.KickMembers)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addStringOption((o) => o.setName('raison').setDescription('Raison').setMaxLength(400)),
  new SlashCommandBuilder().setName('mute').setDescription('Rendre muet temporairement (exclusion Discord)').setDefaultMemberPermissions(P.ModerateMembers)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption((o) => o.setName('duree').setDescription('Durée').setRequired(true).addChoices(...DURATIONS.map(([name, value]) => ({ name, value }))))
    .addStringOption((o) => o.setName('raison').setDescription('Raison').setMaxLength(400)),
  new SlashCommandBuilder().setName('unmute').setDescription('Lever l’exclusion temporaire').setDefaultMemberPermissions(P.ModerateMembers)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('Avertir un membre').setDefaultMemberPermissions(P.ModerateMembers)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addStringOption((o) => o.setName('raison').setDescription('Raison').setRequired(true).setMaxLength(400)),
  new SlashCommandBuilder().setName('warns').setDescription('Voir les avertissements d’un membre').setDefaultMemberPermissions(P.ModerateMembers)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
  new SlashCommandBuilder().setName('unwarn').setDescription('Retirer un avertissement').setDefaultMemberPermissions(P.ModerateMembers)
    .addIntegerOption((o) => o.setName('numero').setDescription('Numéro de l’avertissement (voir /warns)').setRequired(true)),
  new SlashCommandBuilder().setName('clear').setDescription('Supprimer des messages dans ce salon').setDefaultMemberPermissions(P.ManageMessages)
    .addIntegerOption((o) => o.setName('nombre').setDescription('Combien (1 à 100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('membre').setDescription('Seulement les messages de ce membre')),
  new SlashCommandBuilder().setName('slowmode').setDescription('Mode lent dans ce salon').setDefaultMemberPermissions(P.ManageChannels)
    .addIntegerOption((o) => o.setName('secondes').setDescription('0 pour désactiver').setRequired(true).setMinValue(0).setMaxValue(21600)),
  new SlashCommandBuilder().setName('lock').setDescription('Verrouiller ce salon (lecture seule)').setDefaultMemberPermissions(P.ManageChannels)
    .addStringOption((o) => o.setName('raison').setDescription('Raison').setMaxLength(200)),
  new SlashCommandBuilder().setName('unlock').setDescription('Déverrouiller ce salon').setDefaultMemberPermissions(P.ManageChannels),
  new SlashCommandBuilder().setName('userinfo').setDescription('Fiche d’un membre').setDefaultMemberPermissions(P.ModerateMembers)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
];

// Paiement manuel Tebex (API Plugin) : livre le package au compte Cfx.re indiqué.
async function tebexGrant(ign, packageId, note) {
  const secret = (process.env.TEBEX_SECRET_KEY || '').trim();
  if (!secret) throw new Error('TEBEX_SECRET_KEY absente du .env du site.');
  const res = await fetch('https://plugin.tebex.io/payments', {
    method: 'POST',
    headers: { 'X-Tebex-Secret': secret, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ign, price: 0, note: note || 'Attribué depuis Discord', packages: [{ id: packageId, options: {} }] }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error((j && (j.error_message || j.message)) || `Tebex ${res.status}`);
  }
}

export function createModeration({ db, getCfg }) {
  const pending = new Map(); // confirmations de /donner
  const ephemeral = (content, extra = {}) => ({ content, flags: MessageFlags.Ephemeral, ...extra });

  async function modlog(guild, embed) {
    const cfg = getCfg();
    const id = cfg.channels.modlogs || cfg.channels.logs;
    try { (await guild.channels.fetch(id)).send({ embeds: [embed] }); } catch { /* salon absent */ }
  }
  const sanction = (color, title, target, mod, reason, extra = []) => new EmbedBuilder().setColor(color).setTitle(title)
    .addFields({ name: 'Membre', value: target ? `<@${target.id}> (${target.tag || target.username || target.id})` : '—', inline: true },
      { name: 'Par', value: `<@${mod.id}>`, inline: true }, { name: 'Raison', value: reason || 'Non précisée' }, ...extra).setTimestamp();

  async function dm(user, text) { try { await user.send(text); } catch { /* MP fermés */ } }

  // Le modérateur peut-il agir sur cette personne ?
  function canAct(i, member) {
    if (!member) return null;
    if (member.id === i.user.id) return 'Tu ne peux pas te sanctionner toi-même.';
    if (member.id === i.guild.ownerId) return 'Impossible sur le propriétaire du serveur.';
    if (member.roles.highest.position >= i.member.roles.highest.position && i.user.id !== i.guild.ownerId) return 'Ce membre a un rôle égal ou supérieur au tien.';
    return null;
  }

  const handlers = {
    async donner(i) {
      const ign = i.options.getString('joueur', true).trim();
      const key = i.options.getString('package', true);
      const note = i.options.getString('raison') || '';
      const p = db.prepare('SELECT key, name, tebex_id FROM products WHERE key = ? OR CAST(tebex_id AS TEXT) = ?').get(key, key);
      if (!p?.tebex_id) return i.reply(ephemeral('Package introuvable sur Tebex. Choisis-le dans la liste proposée.'));
      const id = crypto.randomBytes(6).toString('hex');
      pending.set(id, { ign, p, note, by: i.user.id, t: Date.now() });
      setTimeout(() => pending.delete(id), 5 * 60e3);
      return i.reply(ephemeral('', {
        embeds: [new EmbedBuilder().setColor(COLOR).setTitle('Confirmer l’attribution')
          .setDescription(`Donner **${p.name}** au compte Cfx.re **${ign}** ?\n\nLe script apparaîtra dans son Keymaster. ⚠️ Un package donné ainsi **ne peut pas être retiré** ensuite.`)
          .addFields({ name: 'Note', value: note || '—' })],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`orion:grant:${id}`).setStyle(ButtonStyle.Success).setLabel('Confirmer').setEmoji('✅'),
          new ButtonBuilder().setCustomId(`orion:grantno:${id}`).setStyle(ButtonStyle.Secondary).setLabel('Annuler'),
        )],
      }));
    },

    async ban(i) {
      const user = i.options.getUser('membre', true);
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      const why = i.options.getString('raison') || '';
      const err = canAct(i, member);
      if (err) return i.reply(ephemeral(err));
      if (member && !member.bannable) return i.reply(ephemeral('Le bot ne peut pas bannir ce membre (rôle trop haut).'));
      await dm(user, `Tu as été banni de **${i.guild.name}**.${why ? ` Raison : ${why}` : ''}`);
      await i.guild.members.ban(user.id, { reason: `${i.user.tag} : ${why}`, deleteMessageSeconds: (i.options.getInteger('effacer') || 0) * 86400 });
      await modlog(i.guild, sanction(0xe5484d, '🔨 Bannissement', user, i.user, why));
      return i.reply(ephemeral(`🔨 ${user.tag} est banni.`));
    },

    async unban(i) {
      const id = i.options.getString('id', true).trim();
      const why = i.options.getString('raison') || '';
      try { await i.guild.members.unban(id, `${i.user.tag} : ${why}`); } catch { return i.reply(ephemeral('Cet utilisateur n’est pas banni (ou identifiant invalide).')); }
      await modlog(i.guild, sanction(0x4ade80, '♻️ Débannissement', { id }, i.user, why));
      return i.reply(ephemeral(`♻️ <@${id}> est débanni.`));
    },

    async kick(i) {
      const member = i.options.getMember('membre');
      const why = i.options.getString('raison') || '';
      const err = canAct(i, member) || (!member ? 'Ce membre n’est pas sur le serveur.' : !member.kickable ? 'Le bot ne peut pas expulser ce membre.' : null);
      if (err) return i.reply(ephemeral(err));
      await dm(member.user, `Tu as été expulsé de **${i.guild.name}**.${why ? ` Raison : ${why}` : ''}`);
      await member.kick(`${i.user.tag} : ${why}`);
      await modlog(i.guild, sanction(0xff7a2f, '👢 Expulsion', member.user, i.user, why));
      return i.reply(ephemeral(`👢 ${member.user.tag} est expulsé.`));
    },

    async mute(i) {
      const member = i.options.getMember('membre');
      const minutes = i.options.getInteger('duree', true);
      const why = i.options.getString('raison') || '';
      const err = canAct(i, member) || (!member ? 'Ce membre n’est pas sur le serveur.' : !member.moderatable ? 'Le bot ne peut pas rendre ce membre muet.' : null);
      if (err) return i.reply(ephemeral(err));
      await member.timeout(minutes * 60e3, `${i.user.tag} : ${why}`);
      const label = DURATIONS.find(([, v]) => v === minutes)?.[0] || `${minutes} min`;
      await dm(member.user, `Tu es muet sur **${i.guild.name}** pendant ${label}.${why ? ` Raison : ${why}` : ''}`);
      await modlog(i.guild, sanction(0xf5a524, '🔇 Mute', member.user, i.user, why, [{ name: 'Durée', value: label, inline: true }]));
      return i.reply(ephemeral(`🔇 ${member.user.tag} est muet pendant ${label}.`));
    },

    async unmute(i) {
      const member = i.options.getMember('membre');
      if (!member) return i.reply(ephemeral('Ce membre n’est pas sur le serveur.'));
      await member.timeout(null, `Levé par ${i.user.tag}`);
      await modlog(i.guild, sanction(0x4ade80, '🔊 Fin du mute', member.user, i.user, ''));
      return i.reply(ephemeral(`🔊 ${member.user.tag} peut de nouveau parler.`));
    },

    async warn(i) {
      const member = i.options.getMember('membre');
      const why = i.options.getString('raison', true);
      const err = canAct(i, member) || (!member ? 'Ce membre n’est pas sur le serveur.' : null);
      if (err) return i.reply(ephemeral(err));
      db.prepare('INSERT INTO warnings (discord_id, moderator_id, reason) VALUES (?, ?, ?)').run(member.id, i.user.id, why);
      const count = db.prepare('SELECT COUNT(*) n FROM warnings WHERE discord_id = ?').get(member.id).n;
      await dm(member.user, `⚠️ Avertissement sur **${i.guild.name}** (${count}/${AUTO_MUTE_AT}) : ${why}`);
      let extra = '';
      if (count >= AUTO_MUTE_AT && member.moderatable) {
        await member.timeout(60 * 60e3, `${AUTO_MUTE_AT} avertissements`).catch(() => {});
        extra = ` Il atteint ${count} avertissements : muet 1 heure automatiquement.`;
      }
      await modlog(i.guild, sanction(0xf5a524, `⚠️ Avertissement n°${count}`, member.user, i.user, why));
      return i.reply(ephemeral(`⚠️ ${member.user.tag} averti (${count} au total).${extra}`));
    },

    async warns(i) {
      const user = i.options.getUser('membre', true);
      const rows = db.prepare('SELECT * FROM warnings WHERE discord_id = ? ORDER BY id DESC LIMIT 15').all(user.id);
      return i.reply(ephemeral('', { embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`Avertissements · ${user.tag}`)
        .setDescription(rows.length ? rows.map((w) => `**#${w.id}** · ${w.reason} · par <@${w.moderator_id}> · <t:${Math.floor(Date.parse(w.created_at.replace(' ', 'T') + 'Z') / 1000)}:R>`).join('\n') : 'Aucun avertissement.')] }));
    },

    async unwarn(i) {
      const n = i.options.getInteger('numero', true);
      const w = db.prepare('SELECT * FROM warnings WHERE id = ?').get(n);
      if (!w) return i.reply(ephemeral('Avertissement introuvable.'));
      db.prepare('DELETE FROM warnings WHERE id = ?').run(n);
      await modlog(i.guild, sanction(0x4ade80, `🧽 Avertissement n°${n} retiré`, { id: w.discord_id }, i.user, w.reason));
      return i.reply(ephemeral(`🧽 Avertissement #${n} retiré.`));
    },

    async clear(i) {
      const n = i.options.getInteger('nombre', true);
      const who = i.options.getUser('membre');
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      let msgs = await i.channel.messages.fetch({ limit: 100 });
      if (who) msgs = msgs.filter((m) => m.author.id === who.id);
      const del = await i.channel.bulkDelete([...msgs.values()].slice(0, n), true);
      await modlog(i.guild, new EmbedBuilder().setColor(0x9aa0ad).setDescription(`🧹 ${del.size} message(s) supprimé(s) dans <#${i.channel.id}> par <@${i.user.id}>${who ? ` (de <@${who.id}>)` : ''}`).setTimestamp());
      return i.editReply(`🧹 ${del.size} message(s) supprimé(s). Les messages de plus de 14 jours ne peuvent pas être supprimés en masse.`);
    },

    async slowmode(i) {
      const s = i.options.getInteger('secondes', true);
      await i.channel.setRateLimitPerUser(s, `Par ${i.user.tag}`);
      return i.reply(ephemeral(s ? `🐢 Mode lent : ${s} s entre deux messages.` : 'Mode lent désactivé.'));
    },

    async lock(i) {
      const cfg = getCfg();
      const why = i.options.getString('raison') || '';
      for (const id of [i.guild.roles.everyone.id, cfg.roles.member, cfg.roles.client].filter(Boolean)) {
        await i.channel.permissionOverwrites.edit(id, { SendMessages: false, SendMessagesInThreads: false }).catch(() => {});
      }
      await i.channel.send({ embeds: [new EmbedBuilder().setColor(0xff7a2f).setDescription(`🔒 Salon verrouillé par l’équipe.${why ? ` ${why}` : ''}`)] });
      await modlog(i.guild, new EmbedBuilder().setColor(0xff7a2f).setDescription(`🔒 <#${i.channel.id}> verrouillé par <@${i.user.id}>${why ? ` : ${why}` : ''}`).setTimestamp());
      return i.reply(ephemeral('Salon verrouillé.'));
    },

    async unlock(i) {
      const cfg = getCfg();
      for (const id of [i.guild.roles.everyone.id, cfg.roles.member, cfg.roles.client].filter(Boolean)) {
        await i.channel.permissionOverwrites.edit(id, { SendMessages: null, SendMessagesInThreads: null }).catch(() => {});
      }
      await i.channel.send({ embeds: [new EmbedBuilder().setColor(0x4ade80).setDescription('🔓 Salon déverrouillé.')] });
      return i.reply(ephemeral('Salon déverrouillé.'));
    },

    async userinfo(i) {
      const user = i.options.getUser('membre', true);
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      const warns = db.prepare('SELECT COUNT(*) n FROM warnings WHERE discord_id = ?').get(user.id).n;
      const scripts = db.prepare(`SELECT DISTINCT oi.name FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.discord_id = ? AND o.status = 'paid'`).all(user.id).map((r) => r.name);
      const ts = (d) => (d ? `<t:${Math.floor(d / 1000)}:D> (<t:${Math.floor(d / 1000)}:R>)` : '—');
      return i.reply(ephemeral('', { embeds: [new EmbedBuilder().setColor(COLOR).setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .addFields(
          { name: 'Compte créé', value: ts(user.createdTimestamp), inline: true },
          { name: 'A rejoint', value: ts(member?.joinedTimestamp), inline: true },
          { name: 'Avertissements', value: String(warns), inline: true },
          { name: 'Muet', value: member?.communicationDisabledUntilTimestamp > Date.now() ? `jusqu’à <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:t>` : 'non', inline: true },
          { name: 'Rôles', value: member ? member.roles.cache.filter((r) => r.id !== i.guild.id).map((r) => `<@&${r.id}>`).join(' ') || '—' : 'pas sur le serveur' },
          { name: 'Scripts achetés', value: scripts.join(', ') || 'aucun' },
        ).setFooter({ text: `ID ${user.id}` })] }));
    },
  };

  return {
    names: new Set(MOD_COMMANDS.map((c) => c.name)),
    async command(i) { return handlers[i.commandName]?.(i); },

    // Autocomplétion de /donner : les packages Tebex connus du site
    async autocomplete(i) {
      const q = String(i.options.getFocused() || '').toLowerCase();
      const rows = db.prepare('SELECT key, name, tebex_id FROM products WHERE tebex_id IS NOT NULL ORDER BY name').all()
        .filter((r) => r.name.toLowerCase().includes(q)).slice(0, 25);
      return i.respond(rows.map((r) => ({ name: r.name, value: r.key })));
    },

    // Boutons de confirmation de /donner
    async button(i) {
      const [, action, id] = i.customId.split(':');
      const job = pending.get(id);
      if (!job) return i.update({ content: 'Demande expirée, relance /donner.', embeds: [], components: [] });
      if (job.by !== i.user.id) return i.reply(ephemeral('Seule la personne qui a lancé la commande peut confirmer.'));
      pending.delete(id);
      if (action === 'grantno') return i.update({ content: 'Annulé.', embeds: [], components: [] });
      await i.deferUpdate();
      try {
        await tebexGrant(job.ign, job.p.tebex_id, `${job.note || 'Attribution Discord'} (par ${i.user.tag})`);
        db.prepare('INSERT INTO grants (cfx_username, product_key, tebex_id, note, by_discord) VALUES (?, ?, ?, ?, ?)').run(job.ign, job.p.key, job.p.tebex_id, job.note, i.user.id);
        await modlog(i.guild, new EmbedBuilder().setColor(0x4ade80).setTitle('🎁 Package attribué')
          .addFields({ name: 'Joueur (Cfx.re)', value: job.ign, inline: true }, { name: 'Package', value: job.p.name, inline: true },
            { name: 'Par', value: `<@${i.user.id}>`, inline: true }, { name: 'Note', value: job.note || '—' }).setTimestamp());
        return i.editReply({ content: `🎁 **${job.p.name}** donné à **${job.ign}**. Il apparaîtra dans son Keymaster d’ici quelques minutes.`, embeds: [], components: [] });
      } catch (e) {
        return i.editReply({ content: `❌ Tebex a refusé : ${e.message}`, embeds: [], components: [] });
      }
    },
  };
}
