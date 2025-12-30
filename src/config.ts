import { GatewayIntentBits, Partials } from 'discord.js';

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const config = {
  // Required
  token: getEnvVar('DISCORD_TOKEN'),
  clientId: getEnvVar('DISCORD_CLIENT_ID'),

  // Optional - Guild ID for development (faster command updates)
  guildId: getOptionalEnvVar('DISCORD_GUILD_ID', ''),

  // Bot configuration
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
} as const;
