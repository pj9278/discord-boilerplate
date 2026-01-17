import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type TextChannel,
  type CategoryChannel,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import {
  createTicket,
  closeTicket,
  getTicketByChannel,
  getOpenTickets,
  getTicketConfig,
  updateTicketConfig,
} from '../../utils/tickets.js';
import { logger } from '../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Support ticket system')
    .addSubcommand((sub) =>
      sub
        .setName('new')
        .setDescription('Create a new support ticket')
        .addStringOption((opt) =>
          opt.setName('subject').setDescription('Brief description of your issue').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('close').setDescription('Close the current ticket'))
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all open tickets (staff only)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Configure the ticket system (admin only)')
        .addChannelOption((opt) =>
          opt
            .setName('category')
            .setDescription('Category for ticket channels')
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addRoleOption((opt) =>
          opt.setName('support_role').setDescription('Role that can see tickets')
        )
        .addChannelOption((opt) =>
          opt
            .setName('log_channel')
            .setDescription('Channel to log ticket actions')
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'new': {
        const subject = interaction.options.getString('subject', true);
        const config = getTicketConfig(interaction.guild.id);

        await interaction.deferReply({ ephemeral: true });

        try {
          // Create ticket channel
          const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36).slice(-4)}`;

          const permissionOverwrites = [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: interaction.client.user!.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ];

          // Add support role if configured
          if (config.supportRoleId) {
            permissionOverwrites.push({
              id: config.supportRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            });
          }

          const category = config.categoryId
            ? ((await interaction.guild.channels.fetch(config.categoryId)) as CategoryChannel)
            : null;

          const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category ?? undefined,
            permissionOverwrites,
          });

          // Create ticket record
          const ticket = createTicket(
            interaction.guild.id,
            ticketChannel.id,
            interaction.user.id,
            interaction.user.tag,
            subject
          );

          // Create ticket embed
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`Ticket #${ticket.id}`)
            .setDescription(
              `**Subject:** ${subject}\n\n` +
                `Support will be with you shortly. Please describe your issue in detail.`
            )
            .addFields(
              { name: 'Created by', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Status', value: '🟢 Open', inline: true }
            )
            .setTimestamp();

          // Create close button
          const closeButton = new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

          await ticketChannel.send({
            content: `<@${interaction.user.id}>${config.supportRoleId ? ` <@&${config.supportRoleId}>` : ''}`,
            embeds: [embed],
            components: [row],
          });

          await interaction.editReply(
            `✅ Ticket created! Head to <#${ticketChannel.id}> to continue.`
          );

          logger.info(`[Tickets] Created ticket #${ticket.id} for ${interaction.user.tag}`);
        } catch (error) {
          logger.error('[Tickets] Failed to create ticket:', error);
          await interaction.editReply('❌ Failed to create ticket. Please try again.');
        }
        break;
      }

      case 'close': {
        const ticket = getTicketByChannel(interaction.channel!.id);

        if (!ticket) {
          await interaction.reply({
            content: '❌ This is not a ticket channel.',
            ephemeral: true,
          });
          return;
        }

        if (ticket.status === 'closed') {
          await interaction.reply({
            content: '❌ This ticket is already closed.',
            ephemeral: true,
          });
          return;
        }

        // Check permission - ticket owner or staff
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const config = getTicketConfig(interaction.guild.id);
        const isStaff =
          member.permissions.has(PermissionFlagsBits.ManageMessages) ||
          (config.supportRoleId && member.roles.cache.has(config.supportRoleId));
        const isOwner = ticket.authorId === interaction.user.id;

        if (!isStaff && !isOwner) {
          await interaction.reply({
            content: '❌ You do not have permission to close this ticket.',
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply();

        closeTicket(ticket.channelId, interaction.user.id);

        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Ticket Closed')
          .setDescription(`This ticket was closed by <@${interaction.user.id}>`)
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Delete channel after a delay
        setTimeout(async () => {
          try {
            const channel = interaction.channel as TextChannel;
            await channel.delete('Ticket closed');
          } catch {
            // Channel may already be deleted
          }
        }, 5000);

        logger.info(`[Tickets] Ticket #${ticket.id} closed by ${interaction.user.tag}`);
        break;
      }

      case 'list': {
        // Check staff permission
        const listMember = await interaction.guild.members.fetch(interaction.user.id);
        if (!listMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({
            content: '❌ You need Manage Messages permission to list tickets.',
            ephemeral: true,
          });
          return;
        }

        const tickets = getOpenTickets(interaction.guild.id);

        if (tickets.length === 0) {
          await interaction.reply({
            content: 'No open tickets.',
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Open Tickets')
          .setDescription(
            tickets
              .map(
                (t) =>
                  `**#${t.id}** - <#${t.channelId}>\n` +
                  `Created by <@${t.authorId}> • ${t.subject.slice(0, 50)}`
              )
              .join('\n\n')
          )
          .setFooter({ text: `${tickets.length} open ticket${tickets.length > 1 ? 's' : ''}` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'setup': {
        // Check admin permission
        const setupMember = await interaction.guild.members.fetch(interaction.user.id);
        if (!setupMember.permissions.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({
            content: '❌ You need Administrator permission to configure tickets.',
            ephemeral: true,
          });
          return;
        }

        const category = interaction.options.getChannel('category') as CategoryChannel | null;
        const supportRole = interaction.options.getRole('support_role');
        const logChannel = interaction.options.getChannel('log_channel') as TextChannel | null;

        const config: Record<string, string> = {};

        if (category) config.categoryId = category.id;
        if (supportRole) config.supportRoleId = supportRole.id;
        if (logChannel) config.logChannelId = logChannel.id;

        if (Object.keys(config).length === 0) {
          const current = getTicketConfig(interaction.guild.id);
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Ticket System Configuration')
            .addFields(
              {
                name: 'Category',
                value: current.categoryId ? `<#${current.categoryId}>` : 'Not set',
                inline: true,
              },
              {
                name: 'Support Role',
                value: current.supportRoleId ? `<@&${current.supportRoleId}>` : 'Not set',
                inline: true,
              },
              {
                name: 'Log Channel',
                value: current.logChannelId ? `<#${current.logChannelId}>` : 'Not set',
                inline: true,
              }
            );

          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }

        updateTicketConfig(interaction.guild.id, config);

        await interaction.reply({
          content: '✅ Ticket system configuration updated.',
          ephemeral: true,
        });
        break;
      }
    }
  },
};

export default command;
