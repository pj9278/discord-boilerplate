import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  type TextChannel,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import {
  addReactionRole,
  removeReactionRole,
  getMappingsForGuild,
  removeAllMappingsForMessage,
} from '../../utils/reactionRoles.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a reaction role to a message')
        .addStringOption((opt) =>
          opt.setName('message_id').setDescription('The message ID').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('emoji').setDescription('The emoji to react with').setRequired(true)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('The role to assign').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Optional description for this role')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a reaction role from a message')
        .addStringOption((opt) =>
          opt.setName('message_id').setDescription('The message ID').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('emoji').setDescription('The emoji to remove').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Remove all reaction roles from a message')
        .addStringOption((opt) =>
          opt.setName('message_id').setDescription('The message ID').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('List all reaction roles'))
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new role selection message')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Title for the embed').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Description for the embed').setRequired(true)
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
      case 'add': {
        const messageId = interaction.options.getString('message_id', true);
        const emojiInput = interaction.options.getString('emoji', true);
        const role = interaction.options.getRole('role', true);
        const description = interaction.options.getString('description');

        // Parse emoji - could be unicode or custom <:name:id>
        let emoji = emojiInput;
        const customMatch = emojiInput.match(/<a?:\w+:(\d+)>/);
        if (customMatch?.[1]) {
          emoji = customMatch[1];
        }

        // Verify the message exists
        try {
          const channel = interaction.channel as TextChannel;
          const message = await channel.messages.fetch(messageId);

          // Add reaction to the message
          await message.react(emojiInput);

          // Save the mapping
          addReactionRole({
            messageId,
            channelId: channel.id,
            guildId: interaction.guild.id,
            emoji,
            roleId: role.id,
            description: description ?? undefined,
          });

          await interaction.reply({
            content: `✅ Added reaction role: ${emojiInput} → ${role}`,
            ephemeral: true,
          });
        } catch {
          await interaction.reply({
            content:
              '❌ Could not find that message. Make sure the message ID is from this channel.',
            ephemeral: true,
          });
        }
        break;
      }

      case 'remove': {
        const messageId = interaction.options.getString('message_id', true);
        const emojiInput = interaction.options.getString('emoji', true);

        let emoji = emojiInput;
        const customMatch = emojiInput.match(/<a?:\w+:(\d+)>/);
        if (customMatch?.[1]) {
          emoji = customMatch[1];
        }

        const removed = removeReactionRole(messageId, emoji);

        if (removed) {
          await interaction.reply({
            content: `✅ Removed reaction role for ${emojiInput}`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: '❌ No reaction role found for that message and emoji.',
            ephemeral: true,
          });
        }
        break;
      }

      case 'clear': {
        const messageId = interaction.options.getString('message_id', true);
        const count = removeAllMappingsForMessage(messageId);

        await interaction.reply({
          content:
            count > 0
              ? `✅ Removed ${count} reaction role${count > 1 ? 's' : ''} from that message.`
              : '❌ No reaction roles found for that message.',
          ephemeral: true,
        });
        break;
      }

      case 'list': {
        const mappings = getMappingsForGuild(interaction.guild.id);

        if (mappings.length === 0) {
          await interaction.reply({
            content: 'No reaction roles configured in this server.',
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Reaction Roles')
          .setDescription(
            mappings
              .map((m) => {
                const emoji = m.emoji.match(/^\d+$/) ? `<:e:${m.emoji}>` : m.emoji;
                return `${emoji} → <@&${m.roleId}> (Message: \`${m.messageId}\`)`;
              })
              .join('\n')
          )
          .setFooter({
            text: `${mappings.length} reaction role${mappings.length > 1 ? 's' : ''} configured`,
          });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }

      case 'create': {
        const title = interaction.options.getString('title', true);
        const description = interaction.options.getString('description', true);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(title)
          .setDescription(description + '\n\n*React to this message to get roles!*')
          .setFooter({ text: 'Use /reactionrole add to configure roles' });

        const channel = interaction.channel as TextChannel;
        const message = await channel.send({ embeds: [embed] });

        await interaction.reply({
          content: `✅ Created role selection message!\n\nMessage ID: \`${message.id}\`\n\nUse \`/reactionrole add message_id:${message.id} emoji:<emoji> role:<role>\` to add roles.`,
          ephemeral: true,
        });
        break;
      }
    }
  },
};

export default command;
