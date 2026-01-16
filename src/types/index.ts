import type {
  ChatInputCommandInteraction,
  Client,
  Collection,
  Message,
  MessageReaction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  User,
} from 'discord.js';

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  cooldown?: number;
}

export interface Event {
  name: string;
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => Promise<void> | void;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
}

export interface Feature {
  name: string;
  init: (client: Client) => Promise<void>;
  onMessage?: (message: Message) => Promise<void>;
  onReaction?: (reaction: MessageReaction, user: User) => Promise<void>;
}

// Moderation types
export type ModActionType = 'ban' | 'kick' | 'timeout' | 'warn' | 'unban' | 'untimeout';

export interface ModCase {
  id: number;
  guildId: string;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  action: ModActionType;
  reason: string;
  duration?: number; // For timeouts, in seconds
  timestamp: string;
}

export interface ModerationData {
  nextCaseId: Record<string, number>; // Per-guild case ID counter
  cases: ModCase[];
}
