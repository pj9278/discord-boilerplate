# Moderation Bot Roadmap

## Status: Phase 1 Complete

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

## Phase 2 - Auto-Moderation (TODO)

- [ ] Anti-spam (message rate limiting, duplicate detection)
- [ ] Link/invite filtering (discord.gg, general URLs)
- [ ] Word filter with guild config
- [ ] Account age verification on join

**Suggested approach:**
- Create `src/features/automod.ts`
- Use in-memory Map for rate tracking
- Store filter config in `data/automod.json`

---

## Phase 3 - Community Features (TODO)

- [ ] Ticket/modmail system (private threads)
- [ ] Verification/reaction roles
- [ ] Auto-role on join
- [ ] Welcome/goodbye messages

---

## Phase 4 - Advanced (TODO)

- [ ] Strike escalation (auto-punish at thresholds)
- [ ] Raid protection mode (mass join detection)
- [ ] Level/XP system
- [ ] Full audit logging (message edits/deletes, role changes)

---

## Research Notes

Based on production bots: ZeppelinBot, modbot, freeCodeCamp/CamperChan, Nypsi

**Key patterns:**
- Use `Map` for in-memory rate tracking with periodic cleanup
- Discord native timeouts preferred over mute roles
- Normalize content (lowercase, trim) for spam detection
- 5-second delay before fetching audit logs (eventual consistency)
- Per-guild configuration stored in JSON/database
