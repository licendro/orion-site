// Plan du serveur Discord Orion. Modifier ici puis relancer `npm run setup` : rien n'est dupliqué,
// les rôles et salons existants (même nom) sont mis à jour.
import { ChannelType, PermissionFlagsBits as P } from 'discord.js';

export const COLOR = 0xff7a2f;

// Du plus haut au plus bas.
export const ROLES = [
  { key: 'founder', name: '👑 Fondateur', color: 0xff7a2f, hoist: true, perms: [P.Administrator] },
  { key: 'dev', name: '🛠️ Développeur', color: 0xedeff3, hoist: true, staff: true,
    perms: [P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ManageThreads, P.MuteMembers, P.MoveMembers, P.ManageNicknames, P.ViewAuditLog, P.MentionEveryone] },
  { key: 'mod', name: '🛡️ Modérateur', color: 0x9aa0ad, hoist: true, staff: true,
    perms: [P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ManageThreads, P.MuteMembers, P.MoveMembers, P.ManageNicknames, P.ViewAuditLog] },
  { key: 'support', name: '🎧 Support', color: 0xb4b9c4, hoist: true, staff: true, perms: [P.ManageMessages, P.ManageThreads, P.MoveMembers] },
  { key: 'partner', name: '🤝 Partenaire', color: 0x6eaaff, hoist: true, perms: [] },
  { key: 'client', name: '💎 Client Orion', color: 0xff9a5c, hoist: true, perms: [] },
  { key: 'member', name: '✅ Membre', color: 0x5c6270, hoist: false,
    perms: [P.SendMessages, P.SendMessagesInThreads, P.CreatePublicThreads, P.EmbedLinks, P.AttachFiles, P.AddReactions, P.UseExternalEmojis,
      P.UseExternalStickers, P.Connect, P.Speak, P.Stream, P.UseVAD] },
  { key: 'notifNew', name: '🔔 Nouveautés', color: 0, mentionable: true, perms: [] },
  { key: 'notifPatch', name: '🔔 Patch notes', color: 0, mentionable: true, perms: [] },
  { key: 'notifTeaser', name: '🔔 Teasers', color: 0, mentionable: true, perms: [] },
  { key: 'notifPromo', name: '🔔 Promos', color: 0, mentionable: true, perms: [] },
];

// Droits de @everyone (non vérifié) : il ne voit que l'accueil et le règlement.
export const EVERYONE_PERMS = [P.ViewChannel, P.ReadMessageHistory, P.UseApplicationCommands, P.ChangeNickname];

// Rôles proposés dans #rôles (boutons).
export const NOTIF_ROLES = [
  { key: 'notifNew', label: 'Nouveaux scripts', emoji: '🆕' },
  { key: 'notifPatch', label: 'Patch notes', emoji: '📝' },
  { key: 'notifTeaser', label: 'Teasers', emoji: '👀' },
  { key: 'notifPromo', label: 'Promos', emoji: '🏷️' },
];

// Modes d'accès :
//  welcome    tout le monde lit, personne n'écrit (sauf staff)
//  public     membres vérifiés : lire + écrire
//  readonly   membres vérifiés : lire seulement
//  clientpost membres lisent, seuls les clients écrivent
//  client     clients uniquement
//  clientread clients lisent seulement
//  staff      staff uniquement
const T = ChannelType.GuildText, F = ChannelType.GuildForum, V = ChannelType.GuildVoice;

export const LAYOUT = [
  { key: 'catWelcome', name: '📌 BIENVENUE', mode: 'welcome', channels: [
    { key: 'welcome', name: '👋・bienvenue', type: T, topic: 'Bienvenue sur le Discord officiel d’Orion Scripts.', post: 'welcome' },
    { key: 'rules', name: '📜・règlement', type: T, topic: 'Lis et accepte le règlement pour accéder au serveur.', post: 'rules' },
  ] },
  { key: 'catOrion', name: '🛒 ORION', mode: 'readonly', channels: [
    { key: 'announcements', name: '📢・annonces', type: T, topic: 'Les annonces importantes du studio.' },
    { key: 'news', name: '🆕・nouveautés', type: T, topic: 'Chaque nouveau script, dès sa sortie.' },
    { key: 'patchnotes', name: '📝・patch-notes', type: T, topic: 'Mises à jour et corrections de nos scripts.' },
    { key: 'teasers', name: '👀・teasers', type: T, topic: 'Aperçus des scripts en préparation.' },
    { key: 'promos', name: '🏷️・promos', type: T, topic: 'Promotions et codes promo.' },
    { key: 'roles', name: '🔔・rôles', type: T, topic: 'Choisis les notifications que tu veux recevoir.', post: 'roles' },
    { key: 'shop', name: '🌐・boutique', type: T, topic: 'La boutique officielle Orion.', post: 'shop' },
    { key: 'reviews', name: '⭐・avis-clients', type: T, mode: 'clientpost', topic: 'Les avis de nos clients. Seuls les clients peuvent écrire ici.', slowmode: 300 },
  ] },
  { key: 'catCommunity', name: '💬 COMMUNAUTÉ', mode: 'public', channels: [
    { key: 'chat', name: '💬・discussion', type: T, topic: 'Discussion générale, dans le respect du règlement.' },
    { key: 'media', name: '📸・médias', type: T, topic: 'Captures, clips et vidéos de vos serveurs.', slowmode: 30 },
    { key: 'suggestions', name: '💡・suggestions', type: F, topic: 'Une idée de script ou d’amélioration ? Un post par idée. Votez avec 👍 / 👎.',
      reaction: '👍',
      tags: [
        { name: 'Nouveau script', emoji: '💡' }, { name: 'Amélioration', emoji: '🛠️' }, { name: 'Site', emoji: '🌐' }, { name: 'Discord', emoji: '💬' },
        { name: 'En attente', emoji: '⏳', moderated: true }, { name: 'Acceptée', emoji: '✅', moderated: true },
        { name: 'Refusée', emoji: '❌', moderated: true }, { name: 'Réalisée', emoji: '🚀', moderated: true },
      ] },
    { key: 'partners', name: '🤝・partenaires', type: T, mode: 'readonly', topic: 'Les serveurs partenaires d’Orion.' },
    { key: 'commands', name: '🤖・commandes', type: T, topic: 'Les commandes des bots, c’est ici.' },
  ] },
  { key: 'catSupport', name: '🆘 SUPPORT', mode: 'readonly', channels: [
    { key: 'ticketPanel', name: '🎫・ouvrir-un-ticket', type: T, topic: 'Ouvre un ticket : support, bug, question avant achat, partenariat, sur-mesure.', post: 'tickets' },
    { key: 'faq', name: '❓・faq', type: T, topic: 'Les réponses aux questions fréquentes.', post: 'faq' },
    { key: 'install', name: '📚・installation', type: T, topic: 'Installer un script Orion pas à pas.', post: 'install' },
    { key: 'bugs', name: '🐞・bug-report', type: F, mode: 'public',
      topic: 'Un post par bug. Indique : le script et sa version, ton framework, ce qui se passe, les erreurs F8 / console, et comment le reproduire.',
      tags: [
        { name: 'Critique', emoji: '🔴' }, { name: 'Gênant', emoji: '🟠' }, { name: 'Mineur', emoji: '🟢' },
        { name: 'En cours', emoji: '🔍', moderated: true }, { name: 'Corrigé', emoji: '✅', moderated: true }, { name: 'Pas un bug', emoji: 'ℹ️', moderated: true },
      ] },
  ] },
  { key: 'catClients', name: '💎 ESPACE CLIENTS', mode: 'client', channels: [
    { key: 'clientChat', name: '💎・discussion-clients', type: T, topic: 'Espace réservé aux clients Orion.' },
    { key: 'clientHelp', name: '🧩・entraide-config', type: T, topic: 'Partagez vos configs et entraidez-vous.' },
    { key: 'clientUpdates', name: '📥・mises-à-jour', type: T, mode: 'clientread', topic: 'Les nouvelles versions de vos scripts, à télécharger dans votre Keymaster.' },
  ] },
  // Remplies automatiquement par le bot (un salon privé par client, tickets).
  { key: 'catCustomers', name: '📦 SALONS CLIENTS', mode: 'staff', channels: [] },
  { key: 'catTicketsClients', name: '🎫 TICKETS CLIENTS', mode: 'staff', channels: [] },
  { key: 'catTicketsGeneral', name: '🎫 TICKETS GÉNÉRAL', mode: 'staff', channels: [] },
  { key: 'catStaff', name: '🔒 STAFF', mode: 'staff', channels: [
    { key: 'staffChat', name: '💼・staff', type: T, topic: 'Discussion de l’équipe.' },
    { key: 'dev', name: '🛠️・dev', type: T, topic: 'Développement, idées, roadmap.' },
    { key: 'quotes', name: '🧾・devis', type: T, topic: 'Demandes de devis envoyées depuis le site.' },
    { key: 'logs', name: '📋・logs', type: T, topic: 'Arrivées, départs, actions du bot.' },
    { key: 'modlogs', name: '🛡️・modération', type: T, topic: 'Sanctions, avertissements et alertes AutoMod.' },
    { key: 'alerts', name: '🚨・alertes', type: T, topic: 'Pannes et problèmes détectés automatiquement (site, bot, Tebex, paiements).' },
    { key: 'transcripts', name: '🗂️・transcripts', type: T, topic: 'Historique des tickets fermés.' },
    { key: 'staffVoice', name: '🔒・Staff', type: V },
  ] },
  { key: 'catVoice', name: '🔊 VOCAUX', mode: 'public', channels: [
    { key: 'voiceMain', name: '🔊・Général', type: V },
    { key: 'voiceChill', name: '🎮・Détente', type: V },
    { key: 'voiceSupport', name: '🎧・Support vocal', type: V },
  ] },
];

// Types de tickets proposés dans #ouvrir-un-ticket.
export const TICKETS = [
  { value: 'support', label: 'Support d’un script acheté', emoji: '🛠️', clientOnly: true, category: 'catTicketsClients', desc: 'Installation, configuration, problème.' },
  { value: 'bug', label: 'Bug sur un script', emoji: '🐞', clientOnly: true, category: 'catTicketsClients', desc: 'Un bug à nous signaler en privé.' },
  { value: 'presale', label: 'Question avant achat', emoji: '💬', category: 'catTicketsGeneral', desc: 'Compatibilité, fonctionnalités, prix.' },
  { value: 'partner', label: 'Partenariat serveur', emoji: '🤝', category: 'catTicketsGeneral', desc: 'De 20 à 200 € par mois selon le serveur.' },
  { value: 'custom', label: 'Script sur mesure / Bot Discord', emoji: '✏️', category: 'catTicketsGeneral', desc: 'Devis gratuit sous 24 h.' },
  { value: 'other', label: 'Autre', emoji: '❓', category: 'catTicketsGeneral', desc: 'Tout le reste.' },
];

// Droits par mode. ids = { everyone, member, client, staff: [ids] }
export function overwritesFor(mode, ids, isVoice = false) {
  const VIEW = [P.ViewChannel, P.ReadMessageHistory];
  const SEND = isVoice ? [P.Connect, P.Speak, P.Stream, P.UseVAD] : [P.SendMessages, P.SendMessagesInThreads, P.AddReactions, P.AttachFiles, P.EmbedLinks];
  const NOSEND = isVoice ? [P.Connect] : [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads, P.SendMessagesInThreads];
  const staff = ids.staff.map((id) => ({ id, allow: [...VIEW, ...SEND, P.ManageMessages] }));
  const hideAll = { id: ids.everyone, deny: [P.ViewChannel] };
  switch (mode) {
    case 'welcome': return [{ id: ids.everyone, allow: VIEW, deny: [...NOSEND, P.AddReactions] }, ...staff];
    case 'public': return [hideAll, { id: ids.member, allow: [...VIEW, ...SEND] }, ...staff];
    case 'readonly': return [hideAll, { id: ids.member, allow: [...VIEW, P.AddReactions], deny: NOSEND }, ...staff];
    case 'clientpost': return [hideAll, { id: ids.member, allow: VIEW, deny: NOSEND }, { id: ids.client, allow: [...VIEW, ...SEND] }, ...staff];
    case 'client': return [hideAll, { id: ids.client, allow: [...VIEW, ...SEND] }, ...staff];
    case 'clientread': return [hideAll, { id: ids.client, allow: [...VIEW, P.AddReactions], deny: NOSEND }, ...staff];
    case 'staff':
    default: return [hideAll, ...staff];
  }
}
