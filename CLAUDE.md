# kens-discord-bot

A Discord.js v14 bot boilerplate in TypeScript with automatic command/event handlers, ready for Railway deployment.

## Project Structure

```
src/
├── commands/           # Slash commands organized by category
│   └── utility/        # Utility commands (ping, info)
├── events/             # Discord.js event handlers (ready, interactionCreate)
├── handlers/           # Dynamic loaders for commands and events
├── types/              # TypeScript interfaces (Command, Event, ExtendedClient)
├── config.ts           # Environment configuration
├── deploy-commands.ts  # Script to register slash commands with Discord
└── index.ts            # Bot entry point
```

## Organization Rules

**Keep code organized and modularized:**
- Commands → `src/commands/<category>/`, one command per file
- Events → `src/events/`, one event per file
- Types → `src/types/`, grouped by domain
- Handlers → `src/handlers/`, one handler per concern

**Modularity principles:**
- Single responsibility per file
- Export default for commands and events
- Use `Command` and `Event` interfaces from `src/types/`

## Code Quality - Zero Tolerance

After editing ANY file, run:

```bash
npm run check
```

This runs typecheck + lint (includes Prettier formatting checks).

To auto-fix issues:

```bash
npm run lint:fix
```

Fix ALL errors/warnings before continuing.

## Adding Commands

1. Create file in `src/commands/<category>/`
2. Export default with `Command` interface
3. Run `npm run deploy-commands` to register

## Adding Events

1. Create file in `src/events/`
2. Export default with `Event` interface
3. Events auto-load on bot restart
