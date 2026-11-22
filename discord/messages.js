import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { COLOR, NOTIF_ROLES, TICKETS } from './structure.js';

const site = () => (process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');
const logo = () => `${site()}/logo.png`;
const base = () => new EmbedBuilder().setColor(COLOR).setFooter({ text: 'Orion Scripts', iconURL: logo() });

// ch(key) renvoie la mention d'un salon : <#id>
export function buildPost(key, ch) {
  switch (key) {
    case 'welcome':
      return {
        embeds: [
          base()
            .setTitle('Bienvenue chez Orion')
            .setThumbnail(logo())
            .setDescription([
              'Studio de scripts FiveM pour **ESX, QBCore et QBox**. Tous nos scripts partagent la même interface : menus, ciblage, notifications.',
              '',
              `**1.** Lis et accepte le règlement dans ${ch('rules')}`,
              `**2.** Choisis tes notifications dans ${ch('roles')}`,
              `**3.** Une question ou un souci ? ${ch('ticketPanel')}`,
            ].join('\n'))
            .setImage(`${site()}/img/garage.jpg`),
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Boutique').setEmoji('🛒').setURL(site()),
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Demander un devis').setEmoji('✏️').setURL(`${site()}/#devis`),
        )],
      };

    case 'rules':
      return {
        embeds: [
          base().setTitle('📜 Règlement du serveur').setDescription([
            '**1. Respect.** Aucune insulte, provocation, discrimination ou harcèlement, en public comme en message privé.',
            '**2. Pas de spam.** Pas de flood, de majuscules en continu ni de mentions inutiles du staff.',
            '**3. Pas de publicité.** Aucune pub pour un serveur, un shop ou un Discord sans accord du staff, y compris en MP.',
            '**4. Pas de leak.** Partager, revendre ou demander nos scripts (ou ceux d’autres créateurs) en dehors de Tebex = bannissement définitif et licence révoquée.',
            '**5. Le bon salon.** Bugs dans 🐞 bug-report, idées dans 💡 suggestions, aide privée via un ticket.',
            '**6. Support.** Le support passe par les tickets, pas par MP. Pour un script acheté, ouvre un ticket « Support ».',
            '**7. Contenu.** Pas de contenu NSFW, choquant ou illégal. Pseudos et avatars corrects.',
            '**8. Le staff a le dernier mot.** En cas de doute, demande à un modérateur.',
            '',
            'Les conditions d’utilisation de Discord s’appliquent : discord.com/terms',
          ].join('\n')),
          base().setDescription('Clique sur le bouton ci-dessous pour accepter le règlement et accéder à tout le serveur.'),
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('orion:verify').setStyle(ButtonStyle.Success).setLabel('J’accepte le règlement').setEmoji('✅'),
        )],
      };

    case 'roles':
      return {
        embeds: [base().setTitle('🔔 Notifications').setDescription(
          'Choisis ce pour quoi tu veux être mentionné. Clique à nouveau sur un bouton pour retirer le rôle.\n\n' +
          NOTIF_ROLES.map((r) => `${r.emoji} **${r.label}**`).join('\n'),
        )],
        components: [new ActionRowBuilder().addComponents(
          ...NOTIF_ROLES.map((r) => new ButtonBuilder().setCustomId(`orion:notif:${r.key}`).setStyle(ButtonStyle.Secondary).setLabel(r.label).setEmoji(r.emoji)),
        )],
      };

    case 'shop':
      return {
        embeds: [base().setTitle('🛒 La boutique Orion').setURL(site()).setDescription([
          'Tous nos scripts, les packs et les promos en cours sont sur le site.',
          '',
          '• Paiement sécurisé par **Tebex**',
          '• Scripts livrés dans ton **Keymaster** Cfx.re juste après l’achat',
          '• Mises à jour incluses à vie',
          `• Le rôle **Client Orion** et un salon privé t’attendent ici après ton achat`,
        ].join('\n')).setImage(`${site()}/img/banque.jpg`)],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Ouvrir la boutique').setEmoji('🌐').setURL(site()),
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Nos services').setEmoji('🛠️').setURL(`${site()}/#services`),
        )],
      };

    case 'tickets':
      return {
        embeds: [base().setTitle('🎫 Ouvrir un ticket').setDescription([
          'Choisis le type de demande dans le menu. Un salon privé s’ouvre avec l’équipe.',
          '',
          '**Clients** : support et bugs de vos scripts sont traités en priorité.',
          '**Tout le monde** : questions avant achat, partenariats, scripts sur mesure, bot Discord.',
          '',
          'Un seul ticket ouvert par type et par personne.',
        ].join('\n'))],
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('orion:ticket').setPlaceholder('Choisis le type de demande…').addOptions(
            TICKETS.map((t) => ({ label: t.label, value: t.value, emoji: t.emoji, description: (t.clientOnly ? 'Clients · ' : '') + t.desc })),
          ),
        )],
      };

    case 'faq':
      return {
        embeds: [base().setTitle('❓ Questions fréquentes').addFields(
          { name: 'Comment je reçois mes scripts ?', value: 'Après le paiement, ils apparaissent dans ton Keymaster (portal.cfx.re → Granted assets), sur le compte FiveM utilisé au paiement.' },
          { name: 'Comment obtenir le rôle Client ?', value: 'Il est donné automatiquement après ton achat si tu t’es connecté avec Discord sur le site. Sinon, ouvre un ticket « Support » avec ton numéro de commande Tebex.' },
          { name: 'Quels frameworks ?', value: 'ESX Legacy, QBCore et QBox, détectés automatiquement. Inventaires : ox_inventory, qs-inventory, qb-inventory.' },
          { name: 'Je peux modifier le code ?', value: 'La configuration, les textes et les fichiers open (client/open.lua, server/open.lua) oui. Le cœur reste protégé par l’escrow Cfx.re.' },
          { name: 'Remboursement ?', value: 'Les scripts étant livrés immédiatement, ils ne sont pas remboursables une fois téléchargés. Un problème ? Ouvre un ticket, on le règle.' },
        )],
      };

    case 'install':
      return {
        embeds: [base().setTitle('📚 Installer un script Orion').setDescription([
          '**1.** Télécharge le script depuis ton Keymaster (portal.cfx.re → Granted assets).',
          '**2.** Place les dossiers dans `resources/[orion]/` sans les renommer.',
          '**3.** Dans le `server.cfg`, ajoute le script après ton framework (et ses éventuelles dépendances indiquées dans son README) :',
          '```cfg\nensure es_extended   # ou qb-core / qbx_core\nensure orn_bank\n```',
          '**4.** Ouvre `config.lua` du script et règle-le.',
          '**5.** Si le script a un fichier `.sql`, importe-le dans ta base de données.',
          '**6.** Redémarre le serveur. Une erreur ? Envoie-la dans un ticket « Support » avec ta version du script.',
        ].join('\n'))],
      };

    default:
      return null;
  }
}
