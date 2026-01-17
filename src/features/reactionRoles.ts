import type { MessageReaction, User } from 'discord.js';
import type { Feature } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { getRoleForReaction } from '../utils/reactionRoles.js';

async function handleReaction(
  reaction: MessageReaction,
  user: User,
  action: 'add' | 'remove'
): Promise<void> {
  try {
    const message = reaction.message;
    if (!message.guild) return;

    // Get emoji identifier (unicode or custom ID)
    const emoji = reaction.emoji.id ?? reaction.emoji.name;
    if (!emoji) return;

    // Check if this reaction has a role mapping
    const roleId = getRoleForReaction(message.id, emoji);
    if (!roleId) return;

    // Fetch the member
    const member = await message.guild.members.fetch(user.id);
    if (!member) return;

    // Get the role
    const role = message.guild.roles.cache.get(roleId);
    if (!role) {
      logger.warn(`[Reaction Roles] Role not found: ${roleId}`);
      return;
    }

    // Check bot can manage this role
    const botMember = message.guild.members.me;
    if (!botMember || botMember.roles.highest.position <= role.position) {
      logger.warn(`[Reaction Roles] Cannot manage role ${role.name} - higher than bot's role`);
      return;
    }

    // Add or remove the role
    if (action === 'add') {
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(role);
        logger.info(`[Reaction Roles] Added role ${role.name} to ${user.tag}`);
      }
    } else {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(role);
        logger.info(`[Reaction Roles] Removed role ${role.name} from ${user.tag}`);
      }
    }
  } catch (error) {
    logger.error('[Reaction Roles] Error handling reaction:', error);
  }
}

const feature: Feature = {
  name: 'reactionRoles',

  async init() {
    logger.info('[Reaction Roles] Reaction roles system ready');
  },

  async onReaction(reaction: MessageReaction, user: User) {
    await handleReaction(reaction, user, 'add');
  },

  async onReactionRemove(reaction: MessageReaction, user: User) {
    await handleReaction(reaction, user, 'remove');
  },
};

export default feature;
