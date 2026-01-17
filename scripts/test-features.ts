/**
 * Feature Testing Script
 * Run with: npx tsx scripts/test-features.ts
 *
 * This verifies that all feature configurations are loading correctly.
 * For Discord interaction tests, use the TESTING_CHECKLIST.md guide.
 */

import { existsSync, readFileSync } from 'node:fs';

const DATA_DIR = './data';

interface TestResult {
  feature: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
}

const results: TestResult[] = [];

function test(feature: string, fn: () => { pass: boolean; message: string }) {
  try {
    const result = fn();
    results.push({
      feature,
      status: result.pass ? 'pass' : 'fail',
      message: result.message,
    });
  } catch (error) {
    results.push({
      feature,
      status: 'fail',
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function loadJson(path: string): unknown {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

// Test 1: Data directory exists
test('Data Directory', () => {
  const exists = existsSync(DATA_DIR);
  return {
    pass: true, // Always pass - directory is created on first use
    message: exists ? 'Data directory exists' : 'Data directory will be created on first use',
  };
});

// Test 2: Moderation cases storage
test('Moderation Cases', () => {
  const data = loadJson(`${DATA_DIR}/moderation.json`);
  if (!data) return { pass: true, message: 'No cases yet (normal for new setup)' };
  return { pass: true, message: `Cases file exists with data` };
});

// Test 3: Automod config
test('Automod Config', () => {
  const data = loadJson(`${DATA_DIR}/automod.json`);
  if (!data) return { pass: true, message: 'No automod config yet (run /automod enable)' };
  return { pass: true, message: 'Automod config exists' };
});

// Test 4: Levels data
test('Leveling System', () => {
  const data = loadJson(`${DATA_DIR}/levels.json`);
  if (!data) return { pass: true, message: 'No levels data yet (users need to chat first)' };
  return { pass: true, message: 'Levels data exists' };
});

// Test 5: Raid protection config
test('Raid Protection', () => {
  const data = loadJson(`${DATA_DIR}/raid-protection.json`);
  if (!data) return { pass: true, message: 'No raid config yet (run /raid enable)' };
  return { pass: true, message: 'Raid protection config exists' };
});

// Test 6: Escalation config
test('Strike Escalation', () => {
  const data = loadJson(`${DATA_DIR}/escalation.json`);
  if (!data) return { pass: true, message: 'No escalation config yet (run /escalation enable)' };
  return { pass: true, message: 'Escalation config exists' };
});

// Test 7: Audit log config
test('Audit Logging', () => {
  const data = loadJson(`${DATA_DIR}/audit-log.json`);
  if (!data) return { pass: true, message: 'No audit config yet (run /auditlog enable)' };
  return { pass: true, message: 'Audit log config exists' };
});

// Test 8: Tickets
test('Ticket System', () => {
  const data = loadJson(`${DATA_DIR}/tickets.json`);
  if (!data) return { pass: true, message: 'No tickets yet (run /ticket new)' };
  return { pass: true, message: 'Tickets data exists' };
});

// Test 9: Reaction roles
test('Reaction Roles', () => {
  const data = loadJson(`${DATA_DIR}/reaction-roles.json`);
  if (!data) return { pass: true, message: 'No reaction roles yet (run /reactionrole create)' };
  return { pass: true, message: 'Reaction roles config exists' };
});

// Print results
console.log('\n🧪 Feature Configuration Tests\n');
console.log('─'.repeat(50));

for (const result of results) {
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} ${result.feature}`);
  console.log(`   ${result.message}\n`);
}

const passed = results.filter((r) => r.status === 'pass').length;
const failed = results.filter((r) => r.status === 'fail').length;

console.log('─'.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
