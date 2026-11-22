// Crée (ou met à jour) tout le serveur Discord Orion : rôles, catégories, salons, droits, messages.
// Lancer :  npm run setup     (peut être relancé sans rien dupliquer)
import dotenv from 'dotenv';
dotenv.config({ path: new URL('./.env', import.meta.url).pathname });
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });
import fs from 'node:fs';
import { AutoModerationActionType, AutoModerationRuleEventType, AutoModerationRuleKeywordPresetType, AutoModerationRuleTriggerType, ChannelType, Client, Events, GatewayIntentBits, GuildDefaultMessageNotifications, GuildExplicitContentFilter, GuildVerificationLevel, PermissionFlagsBits } from 'discord.js';
import { EVERYONE_PERMS, LAYOUT, ROLES, overwritesFor } from './structure.js';
import { buildPost } from './messages.js';

const CONFIG = new URL('./config.json', import.meta.url);
const cfg = fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, 'utf8')) : {};
cfg.roles ??= {}; cfg.channels ??= {}; cfg.messages ??= {};

const { DISCORD_TOKEN, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !GUILD_ID) {
  console.error('✗ DISCORD_TOKEN et GUILD_ID doivent être remplis dans discord/.env');
  process.exit(1);
}

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  try {
    await run();
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
    log('\n✓ Serveur prêt. Configuration enregistrée dans discord/config.json');
    if (cfg.quoteWebhook) {
      log('\nWebhook des devis (à coller dans le .env du site, DISCORD_QUOTE_WEBHOOK=) :');
      log(cfg.quoteWebhook);
    }
  } catch (e) {
    console.error('\n✗ Erreur :', e.message);
    fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

async function run() {
  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (!guild) {
    throw new Error(`Le bot n'est pas sur le serveur ${GUILD_ID}. Invite-le avec : https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands&guild_id=${GUILD_ID}`);
  }
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('Le bot doit avoir la permission Administrateur sur le serveur.');
  }
  log(`→ Serveur : ${guild.name}`);

  // 1. Rôles
  await guild.roles.fetch();
  for (const r of ROLES) {
    let role = guild.roles.cache.get(cfg.roles[r.key]) || guild.roles.cache.find((x) => x.name === r.name);
    const data = { name: r.name, color: r.color || 0, hoist: !!r.hoist, mentionable: !!r.mentionable, permissions: r.perms };
    if (role) {
      if (role.editable) await role.edit(data);
      log(`  rôle ✓ ${r.name}`);
    } else {
      role = await guild.roles.create({ ...data, reason: 'Setup Orion' });
      log(`  rôle + ${r.name}`);
    }
    cfg.roles[r.key] = role.id;
  }
  await guild.roles.everyone.setPermissions(EVERYONE_PERMS);

  // Ordre des rôles, juste sous le rôle du bot.
  const top = me.roles.highest.position;
  try {
    await guild.roles.setPositions(ROLES.map((r, i) => ({ role: cfg.roles[r.key], position: Math.max(1, top - 1 - i) })));
    log('  ordre des rôles ✓');
  } catch {
    log('  ⚠ Ordre des rôles non appliqué : dans Paramètres du serveur > Rôles, glisse le rôle du bot tout en haut puis relance « npm run setup ».');
  }

  // Fondateurs
  for (const id of (process.env.OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const m = await guild.members.fetch(id);
      await m.roles.add([cfg.roles.founder, cfg.roles.member]);
      log(`  👑 ${m.user.username}`);
    } catch { log(`  ⚠ Membre ${id} introuvable sur le serveur`); }
  }

  const ids = {
    everyone: guild.roles.everyone.id,
    member: cfg.roles.member,
    client: cfg.roles.client,
    staff: ROLES.filter((r) => r.staff).map((r) => cfg.roles[r.key]),
  };

  // 2. Salons par défaut d'un serveur neuf
  await guild.channels.fetch();
  if (process.env.CLEAN_DEFAULTS === '1') {
    const defaults = ['général', 'general', 'Général', 'General', 'Salons textuels', 'Salons vocaux', 'Text Channels', 'Voice Channels'];
    const ours = new Set(Object.values(cfg.channels));
    for (const c of guild.channels.cache.values()) {
      if (!ours.has(c.id) && defaults.includes(c.name)) {
        await c.delete('Setup Orion : salon par défaut').catch(() => {});
        log(`  − ${c.name}`);
      }
    }
  }

  // 3. Catégories et salons
  let catPos = 0;
  for (const cat of LAYOUT) {
    const catData = { name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: overwritesFor(cat.mode, ids) };
    let category = guild.channels.cache.get(cfg.channels[cat.key])
      || guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === cat.name);
    if (category) {
      await category.edit({ name: cat.name, permissionOverwrites: catData.permissionOverwrites });
    } else {
      category = await guild.channels.create(catData);
    }
    await category.setPosition(catPos++).catch(() => {});
    cfg.channels[cat.key] = category.id;
    log(`\n${cat.name}`);

    let pos = 0;
    for (const ch of cat.channels) {
      const isVoice = ch.type === ChannelType.GuildVoice;
      const data = {
        name: ch.name,
        type: ch.type,
        parent: category.id,
        permissionOverwrites: overwritesFor(ch.mode || cat.mode, ids, isVoice),
        ...(ch.topic && !isVoice ? { topic: ch.topic } : {}),
        ...(ch.slowmode ? { rateLimitPerUser: ch.slowmode } : {}),
        ...(ch.type === ChannelType.GuildForum && ch.tags
          ? { availableTags: ch.tags.map((t) => ({ name: t.name, emoji: { id: null, name: t.emoji }, moderated: !!t.moderated })) }
          : {}),
        ...(ch.reaction ? { defaultReactionEmoji: { id: null, name: ch.reaction } } : {}),
      };
      let channel = guild.channels.cache.get(cfg.channels[ch.key])
        || guild.channels.cache.find((c) => c.name === ch.name && c.parentId === category.id);
      if (channel) {
        const { type, ...edit } = data;
        if (channel.type === ChannelType.GuildForum && edit.availableTags) {
          // On garde les tags existants (et leurs posts) : on ajoute seulement ceux qui manquent.
          const have = new Set(channel.availableTags.map((t) => t.name));
          edit.availableTags = [...channel.availableTags, ...edit.availableTags.filter((t) => !have.has(t.name))];
        }
        await channel.edit(edit);
        log(`  ✓ ${ch.name}`);
      } else {
        channel = await guild.channels.create(data);
        log(`  + ${ch.name}`);
      }
      await channel.setPosition(pos++).catch(() => {});
      cfg.channels[ch.key] = channel.id;
      await sleep(250);
    }
  }

  // 4. Messages (modifiés s'ils existent déjà, envoyés sinon)
  const mention = (key) => (cfg.channels[key] ? `<#${cfg.channels[key]}>` : `#${key}`);
  log('\nMessages');
  for (const cat of LAYOUT) {
    for (const ch of cat.channels) {
      if (!ch.post) continue;
      const payload = buildPost(ch.post, mention);
      const channel = await guild.channels.fetch(cfg.channels[ch.key]);
      let done = false;
      if (cfg.messages[ch.post]) {
        try {
          const msg = await channel.messages.fetch(cfg.messages[ch.post]);
          await msg.edit(payload);
          done = true;
          log(`  ✓ ${ch.name}`);
        } catch { /* message supprimé : on le renvoie */ }
      }
      if (!done) {
        const msg = await channel.send(payload);
        cfg.messages[ch.post] = msg.id;
        log(`  + ${ch.name}`);
      }
    }
  }

  // 5. Webhook des devis du site
  const quotes = await guild.channels.fetch(cfg.channels.quotes);
  const hooks = await quotes.fetchWebhooks();
  let hook = hooks.find((h) => h.name === 'Orion · Devis' && h.token);
  if (!hook) hook = await quotes.createWebhook({ name: 'Orion · Devis', avatar: `${(process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '')}/logo.png`, reason: 'Formulaire de devis du site' }).catch(() => quotes.createWebhook({ name: 'Orion · Devis' }));
  cfg.quoteWebhook = hook.url;

  // 6. AutoMod Discord (filtrage natif, sans lire les messages)
  log('\nAutoMod');
  const alert = { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: cfg.channels.modlogs || cfg.channels.logs } };
  const block = (msg) => ({ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: msg } });
  const exempt = [cfg.roles.founder, cfg.roles.dev, cfg.roles.mod, cfg.roles.support].filter(Boolean);
  const RULES = [
    { name: 'Orion · Invitations Discord', triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: { keywordFilter: ['*discord.gg/*', '*discord.com/invite/*', '*discordapp.com/invite/*', '*dsc.gg/*'] },
      actions: [block('Les invitations vers d’autres serveurs ne sont pas autorisées ici.'), alert], exemptRoles: [...exempt, cfg.roles.partner].filter(Boolean) },
    { name: 'Orion · Spam de mentions', triggerType: AutoModerationRuleTriggerType.MentionSpam,
      triggerMetadata: { mentionTotalLimit: 5, mentionRaidProtectionEnabled: true },
      actions: [block('Trop de mentions dans un seul message.'), alert, { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 600 } }], exemptRoles: exempt },
    { name: 'Orion · Spam', triggerType: AutoModerationRuleTriggerType.Spam, actions: [block('Message bloqué : il ressemble à du spam.'), alert], exemptRoles: exempt },
    { name: 'Orion · Insultes et contenu choquant', triggerType: AutoModerationRuleTriggerType.KeywordPreset,
      triggerMetadata: { presets: [AutoModerationRuleKeywordPresetType.Slurs, AutoModerationRuleKeywordPresetType.SexualContent] },
      actions: [block('Message bloqué : contenu interdit par le règlement.'), alert], exemptRoles: exempt },
  ];
  try {
    const existing = await guild.autoModerationRules.fetch();
    for (const r of RULES) {
      const data = { ...r, eventType: AutoModerationRuleEventType.MessageSend, enabled: true, reason: 'Setup Orion' };
      if (r.triggerType === AutoModerationRuleTriggerType.Spam) delete data.exemptRoles;
      const found = existing.find((x) => x.name === r.name);
      try {
        if (found) { const { triggerType, ...edit } = data; await found.edit(edit); log(`  ✓ ${r.name}`); }
        else { await guild.autoModerationRules.create(data); log(`  + ${r.name}`); }
      } catch (e) { log(`  ⚠ ${r.name} : ${e.message}`); }
    }
  } catch (e) { log('  ⚠ AutoMod indisponible :', e.message); }

  // 7. Réglages du serveur
  await guild.edit({
    verificationLevel: GuildVerificationLevel.Medium,
    explicitContentFilter: GuildExplicitContentFilter.AllMembers,
    defaultMessageNotifications: GuildDefaultMessageNotifications.OnlyMentions,
    systemChannel: cfg.channels.logs,
  }).catch((e) => log('  ⚠ Réglages du serveur :', e.message));
  log('\nRéglages ✓ (vérification moyenne, filtre de contenu, notifications @mentions uniquement)');
}

client.login(DISCORD_TOKEN);
