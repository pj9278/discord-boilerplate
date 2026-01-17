# Discord Bot Testing Checklist

Use this guide to systematically test all bot features with your team.

## Prerequisites

1. Create a `#bot-testing` channel for tests
2. Create a `#mod-log` channel (set `MOD_LOG_CHANNEL_ID` in Railway)
3. Create a test role called "Test Role" for reaction role tests
4. Have 2-3 team members available for interaction tests

---

## Phase 1: Core Moderation

### /warn
- [ ] Run `/warn @user reason:Testing warning system`
- [ ] Verify user receives DM with warning
- [ ] Verify mod log shows the warning
- [ ] Run `/history @user` to confirm warning is recorded

### /timeout
- [ ] Run `/timeout @user duration:1m reason:Testing timeout`
- [ ] Verify user is timed out (can't send messages)
- [ ] Verify mod log shows the timeout
- [ ] Wait 1 minute, confirm timeout expires

### /kick (use alt account or willing team member)
- [ ] Run `/kick @user reason:Testing kick`
- [ ] Verify user is kicked and can rejoin
- [ ] Verify mod log shows the kick

### /ban (use alt account)
- [ ] Run `/ban @user reason:Testing ban delete_days:0`
- [ ] Verify user is banned
- [ ] Unban manually in Discord settings

---

## Phase 2: Auto-Moderation

### Setup
```
/automod enable
/automod antispam enabled:True max_messages:5 timeframe:5
/automod wordfilter enabled:True action:delete
/automod addword word:testbadword
/automod linkfilter enabled:True action:delete
```

### Anti-Spam Test
- [ ] Send 6+ messages rapidly in 5 seconds
- [ ] Verify messages are deleted and you get warned/timed out

### Word Filter Test
- [ ] Send a message containing "testbadword"
- [ ] Verify message is deleted
- [ ] Run `/automod removeword word:testbadword` after testing

### Link Filter Test
- [ ] Send a message with a URL (e.g., https://example.com)
- [ ] Verify message is deleted
- [ ] Run `/automod linkfilter enabled:False` to disable after testing

### Cleanup
```
/automod disable
```

---

## Phase 3: Community Features

### Ticket System
- [ ] Run `/ticket setup category:Tickets` (creates category if needed)
- [ ] Run `/ticket new subject:Test ticket`
- [ ] Verify private thread is created
- [ ] Click "Close Ticket" button
- [ ] Verify ticket is closed
- [ ] Run `/ticket list` to see ticket history

### Reaction Roles
```
/reactionrole create channel:#bot-testing title:Pick your role description:React to get a role
```
- [ ] Verify embed appears in channel
- [ ] Run `/reactionrole add message_id:<id> emoji:👍 role:@TestRole`
- [ ] React with 👍 to the message
- [ ] Verify you receive the role
- [ ] Remove reaction
- [ ] Verify role is removed
- [ ] Run `/reactionrole clear message_id:<id>` to clean up

---

## Phase 4: Advanced Features

### Strike Escalation
```
/escalation enable
/escalation status
```
- [ ] Verify default rules show (3 warns = timeout, 5 = kick, 7 = ban)
- [ ] Run `/warn @testuser reason:test` 3 times
- [ ] Verify user gets auto-timed out after 3rd warning
- [ ] Run `/escalation disable` after testing

### Raid Protection
```
/raid enable
/raid config threshold:3 window:30
/raid status
```
- [ ] Verify config shows threshold:3, window:30s
- [ ] (Hard to test without 3 accounts joining rapidly)
- [ ] Run `/raid disable` after testing

### XP/Leveling
```
/level enable
/level config xp_per_message:50 cooldown:10
```
- [ ] Send a few messages (wait 10s between each)
- [ ] Run `/level check`
- [ ] Verify XP and level show correctly
- [ ] Run `/level leaderboard`
- [ ] Verify leaderboard shows your stats

#### Level Roles (optional)
```
/level role level:1 role:@TestRole
/level roles
```
- [ ] Verify level role is listed
- [ ] Run `/level removerole level:1` to clean up

### Audit Logging
```
/auditlog enable channel:#mod-log
/auditlog status
```
- [ ] Edit a message → verify edit appears in mod-log
- [ ] Delete a message → verify delete appears in mod-log
- [ ] Change your nickname → verify change appears in mod-log
- [ ] Join/leave voice channel → verify appears in mod-log

#### Toggle Specific Events
```
/auditlog toggle event:Voice State Changes
```
- [ ] Verify you can enable/disable specific events

---

## Error Handling Verification

These tests verify the bot handles errors gracefully and logs them properly.

### Check Railway Logs
```bash
railway logs --tail
```
Keep this running in a terminal while testing.

### Invalid Command Arguments
- [ ] Run `/timeout @user duration:invalid` (bad duration format)
- [ ] Verify bot responds with error message (not crash)
- [ ] Check logs - should show handled error, not stack trace

### Missing Permissions Test
- [ ] Temporarily remove bot's "Manage Messages" permission
- [ ] Try `/automod enable` and trigger spam filter
- [ ] Verify bot logs permission error, doesn't crash
- [ ] Restore bot permissions

### Invalid Channel/Role IDs
- [ ] Run `/auditlog enable channel:#deleted-channel` (use invalid ID)
- [ ] Verify graceful error message
- [ ] Check logs for handled error

### API Rate Limits (optional)
- [ ] Rapidly run 10+ commands in sequence
- [ ] Verify bot queues/handles rate limits
- [ ] Should not crash or lose functionality

### Verify Error Log Format
In Railway logs, errors should appear as:
```
[ERROR] Description of what failed
```
Not as unhandled promise rejections or uncaught exceptions.

### Process Resilience
- [ ] Bot should stay online after any error above
- [ ] Run `/ping` after each test to confirm bot is responsive

---

## Quick Smoke Test (5 minutes)

Run these commands to verify bot is responding:

```
/ping
/level check
/automod status
/raid status
/escalation status
/auditlog status
```

All should respond without errors.

---

## Test Data Cleanup

After testing, clean up test data:

```bash
# SSH into Railway or run locally
rm data/moderation.json      # Clear mod cases
rm data/levels.json          # Clear XP data
rm data/tickets.json         # Clear tickets
```

Or keep the data for ongoing use.

---

## Reporting Issues

If a test fails:
1. Note the command used
2. Screenshot any error messages
3. Check Railway logs: `railway logs`
4. Report in your team channel
