import { Collection } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Command, ExtendedClient } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadCommands(client: ExtendedClient): Promise<void> {
  client.commands = new Collection();

  const commandsPath = join(__dirname, '..', 'commands');
  const commandFolders = readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = join(commandsPath, folder);
    const commandFiles = readdirSync(folderPath).filter(
      (file) => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts')
    );

    for (const file of commandFiles) {
      const filePath = join(folderPath, file);
      const fileUrl = pathToFileURL(filePath).href;
      const commandModule = (await import(fileUrl)) as { default: Command };
      const command = commandModule.default;

      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[Command] Loaded: ${command.data.name}`);
      } else {
        console.warn(`[Command] Skipped ${file}: Missing "data" or "execute" property`);
      }
    }
  }

  console.log(`[Commands] Loaded ${client.commands.size} commands`);
}
