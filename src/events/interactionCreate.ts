import { Events, EmbedBuilder, PermissionFlagsBits, type TextChannel } from 'discord.js';
import type { ChatInputCommandInteraction, Interaction, ButtonInteraction } from 'discord.js';
import type { Event, ExtendedClient } from '../types/index.js';
import { closeTicket, getTicketByChannel, getTicketConfig } from '../utils/tickets.js';
import { logger } from '../utils/logger.js';

const event: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    // Handle button interactions
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as ExtendedClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`[Command] No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (error) {
      console.error(`[Command] Error executing ${interaction.commandName}:`, error);

      const errorMessage = {
        content: 'There was an error while executing this command!',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === 'ticket_close') {
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

    // Check permission
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const config = getTicketConfig(interaction.guild!.id);
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
      .setDescription(
        `This ticket was closed by <@${interaction.user.id}>\n\nThis channel will be deleted in 5 seconds.`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info(`[Tickets] Ticket #${ticket.id} closed by ${interaction.user.tag}`);

    // Delete channel after delay
    setTimeout(async () => {
      try {
        const channel = interaction.channel as TextChannel;
        await channel.delete('Ticket closed');
      } catch {
        // Channel may already be deleted
      }
    }, 5000);
  }
}

export default event;
