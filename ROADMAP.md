# Moderation Bot Roadmap

## Status: All Phases Complete

---

## Phase 1 - Core Moderation (DONE)

**Commands implemented:**
| Command | Description | Permission |
|---------|-------------|------------|
| `/ban <user> [reason] [delete_days]` | Ban a user | Ban Members |
| `/kick <user> [reason]` | Kick a user | Kick Members |
| `/timeout <user> <duration> [reason]` | Timeout (e.g., `10m`, `1h`, `1d`) | Moderate Members |
| `/warn <user> <reason>` | Issue warning (tracked) | Moderate Members |
| `/history <user>` | View mod history | Moderate Members |

**Features:**
- Case tracking with per-guild sequential IDs
- Mod log channel with rich embeds (`MOD_LOG_CHANNEL_ID`)
- DM notifications to users
- Role hierarchy enforcement

**Files created:**
- `src/commands/moderation/` - All mod commands
- `src/utils/moderation.ts` - Case storage, duration parsing
- `src/utils/modLog.ts` - Log channel embeds

---

## Phase 2 - Auto-Moderation (DONE)

- [x] Anti-spam (message rate limiting, duplicate detection)
- [x] Link/invite filtering (discord.gg, general URLs)
- [x] Word filter with guild config
- [x] Account age verification on join

**Commands:**
| Command | Description | Permission |
|---------|-------------|------------|
| `/automod enable/disable` | Toggle automod | Administrator |
| `/automod status` | View current config | Administrator |
| `/automod antispam` | Configure spam detection | Administrator |
| `/automod linkfilter` | Configure link filtering | Administrator |
| `/automod wordfilter` | Configure word filter | Administrator |
| `/automod addword/removeword/listwords` | Manage filter list | Administrator |
| `/automod accountage` | Set minimum account age | Administrator |
| `/automod exempt` | Add exempt roles | Administrator |

**Files created:**
- `src/features/automod.ts` - Main automod feature
- `src/utils/automodConfig.ts` - Per-guild config storage
- `src/commands/automod/automod.ts` - Config commands

---

## Phase 3 - Community Features (DONE)

- [x] Ticket/modmail system (private threads)
- [x] Verification/reaction roles
- [x] Auto-role on join
- [x] Welcome/goodbye messages

**Commands:**
| Command | Description | Permission |
|---------|-------------|------------|
| `/ticket new/close/list/setup` | Ticket system | Manage Messages |
| `/reactionrole create/add/remove/clear/list` | Reaction roles | Administrator |

**Files created:**
- `src/features/reactionRoles.ts` - Reaction role handler
- `src/utils/reactionRoles.ts` - Reaction role storage
- `src/utils/tickets.ts` - Ticket storage
- `src/commands/utility/reactionrole.ts` - Reaction role commands
- `src/commands/utility/ticket.ts` - Ticket commands

---

## Phase 4 - Advanced (DONE)

- [x] Strike escalation (auto-punish at thresholds)
- [x] Raid protection mode (mass join detection)
- [x] Level/XP system
- [x] Full audit logging (message edits/deletes, role changes)

**Commands:**
| Command | Description | Permission |
|---------|-------------|------------|
| `/escalation enable/disable/status/set/remove/reset` | Configure strike escalation | Administrator |
| `/raid enable/disable/status/end/config` | Configure raid protection | Administrator |
| `/level check/leaderboard` | View levels | Everyone |
| `/level enable/disable/config/role/removerole/roles` | Configure XP system | Administrator |
| `/auditlog enable/disable/status/toggle` | Configure audit logging | Administrator |

**Files created:**
- `src/utils/strikeEscalation.ts` - Escalation config and logic
- `src/commands/moderation/escalation.ts` - Escalation commands
- `src/features/raidProtection.ts` - Raid detection
- `src/commands/moderation/raid.ts` - Raid config commands
- `src/features/leveling.ts` - XP/level system
- `src/commands/utility/level.ts` - Level commands
- `src/features/auditLog.ts` - Audit logging
- `src/commands/moderation/auditlog.ts` - Audit log config

---

## Research Notes

Based on production bots: ZeppelinBot, modbot, freeCodeCamp/CamperChan, Nypsi

**Key patterns:**
- Use `Map` for in-memory rate tracking with periodic cleanup
- Discord native timeouts preferred over mute roles
- Normalize content (lowercase, trim) for spam detection
- 5-second delay before fetching audit logs (eventual consistency)
- Per-guild configuration stored in JSON/database
