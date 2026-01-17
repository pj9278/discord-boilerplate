import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import {
  getLevelConfig,
  updateLevelConfig,
  getUserLevel,
  getLeaderboard,
  addLevelRole,
  removeLevelRole,
  xpForLevel,
} from '../../features/leveling.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('XP and leveling commands')
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check your level or another user')
        .addUserOption((opt) => opt.setName('user').setDescription('User to check'))
    )
    .addSubcommand((sub) =>
      sub.setName('leaderboard').setDescription('View the server leaderboard')
    )
    .addSubcommand((sub) =>
      sub.setName('enable').setDescription('Enable the leveling system (admin)')
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Disable the leveling system (admin)')
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('Configure leveling settings (admin)')
        .addIntegerOption((opt) =>
          opt
            .setName('xp_per_message')
            .setDescription('Base XP per message (default: 15)')
            .setMinValue(1)
            .setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('cooldown')
            .setDescription('Seconds between XP gains (default: 60)')
            .setMinValue(10)
            .setMaxValue(300)
        )
        .addChannelOption((opt) =>
          opt.setName('levelup_channel').setDescription('Channel for level up announcements')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('role')
        .setDescription('Add a level role reward (admin)')
        .addIntegerOption((opt) =>
          opt
            .setName('level')
            .setDescription('Level to grant role at')
            .setRequired(true)
            .setMinValue(1)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role to grant').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('removerole')
        .setDescription('Remove a level role reward (admin)')
        .addIntegerOption((opt) =>
          opt.setName('level').setDescription('Level to remove role from').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('roles').setDescription('List all level role rewards')),

  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config = getLevelConfig(guildId);

    // Check admin permission for admin commands
    const adminCommands = ['enable', 'disable', 'config', 'role', 'removerole'];
    if (adminCommands.includes(subcommand)) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '❌ You need Administrator permission for this command.',
          ephemeral: true,
        });
        return;
      }
    }

    switch (subcommand) {
      case 'check': {
        const targetUser = interaction.options.getUser('user') ?? interaction.user;
        const userData = getUserLevel(guildId, targetUser.id);

        const currentLevelXp = xpForLevel(userData.level);
        const nextLevelXp = xpForLevel(userData.level + 1);
        const progress = userData.xp - currentLevelXp;
        const needed = nextLevelXp - currentLevelXp;
        const percentage = Math.round((progress / needed) * 100);

        // Create progress bar
        const filled = Math.round(percentage / 10);
        const progressBar = '█'.repeat(filled) + '░'.repeat(10 - filled);

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Level Stats - ${targetUser.username}`)
          .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
          .addFields(
            { name: 'Level', value: `${userData.level}`, inline: true },
            { name: 'Total XP', value: `${userData.xp.toLocaleString()}`, inline: true },
            { name: 'Messages', value: `${userData.messageCount.toLocaleString()}`, inline: true },
            {
              name: `Progress to Level ${userData.level + 1}`,
              value: `${progressBar} ${percentage}%\n${progress.toLocaleString()} / ${needed.toLocaleString()} XP`,
            }
          );

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'leaderboard': {
        const leaders = getLeaderboard(guildId, 10);

        if (leaders.length === 0) {
          await interaction.reply({
            content: 'No one has earned XP yet!',
            ephemeral: true,
          });
          return;
        }

        const description = leaders
          .map((user, index) => {
            const medal =
              index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} <@${user.userId}> - Level ${user.level} (${user.xp.toLocaleString()} XP)`;
          })
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🏆 XP Leaderboard')
          .setDescription(description)
          .setFooter({ text: `Top ${leaders.length} members` });

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'enable': {
        updateLevelConfig(guildId, { enabled: true });
        await interaction.reply({
          content: '✅ Leveling system enabled!',
          ephemeral: true,
        });
        break;
      }

      case 'disable': {
        updateLevelConfig(guildId, { enabled: false });
        await interaction.reply({
          content: '❌ Leveling system disabled.',
          ephemeral: true,
        });
        break;
      }

      case 'config': {
        const xpPerMessage = interaction.options.getInteger('xp_per_message');
        const cooldown = interaction.options.getInteger('cooldown');
        const levelUpChannel = interaction.options.getChannel('levelup_channel');

        const updates: Record<string, unknown> = {};

        if (xpPerMessage !== null) updates.xpPerMessage = xpPerMessage;
        if (cooldown !== null) updates.xpCooldown = cooldown * 1000;
        if (levelUpChannel) updates.levelUpChannelId = levelUpChannel.id;

        if (Object.keys(updates).length === 0) {
          const embed = new EmbedBuilder()
            .setColor(config.enabled ? 0x57f287 : 0xed4245)
            .setTitle('Leveling Configuration')
            .setDescription(config.enabled ? '✅ **Enabled**' : '❌ **Disabled**')
            .addFields(
              { name: 'XP per Message', value: `${config.xpPerMessage}`, inline: true },
              { name: 'Cooldown', value: `${config.xpCooldown / 1000}s`, inline: true },
              {
                name: 'Level Up Channel',
                value: config.levelUpChannelId
                  ? `<#${config.levelUpChannelId}>`
                  : 'Same channel as message',
                inline: true,
              }
            );

          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }

        updateLevelConfig(guildId, updates);
        await interaction.reply({
          content: '✅ Leveling configuration updated.',
          ephemeral: true,
        });
        break;
      }

      case 'role': {
        const level = interaction.options.getInteger('level', true);
        const role = interaction.options.getRole('role', true);

        addLevelRole(guildId, level, role.id);

        await interaction.reply({
          content: `✅ ${role} will be granted at Level ${level}.`,
          ephemeral: true,
        });
        break;
      }

      case 'removerole': {
        const level = interaction.options.getInteger('level', true);
        const removed = removeLevelRole(guildId, level);

        if (removed) {
          await interaction.reply({
            content: `✅ Removed level role for Level ${level}.`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: `❌ No level role found for Level ${level}.`,
            ephemeral: true,
          });
        }
        break;
      }

      case 'roles': {
        const roles = config.levelRoles;

        if (roles.length === 0) {
          await interaction.reply({
            content: 'No level roles configured.',
            ephemeral: true,
          });
          return;
        }

        const description = roles.map((r) => `Level ${r.level} → <@&${r.roleId}>`).join('\n');

        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('Level Roles')
          .setDescription(description)
          .setFooter({
            text: `${roles.length} level role${roles.length > 1 ? 's' : ''} configured`,
          });

        await interaction.reply({ embeds: [embed], ephemeral: true });
        break;
      }
    }
  },
};

export default command;
