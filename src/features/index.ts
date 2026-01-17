import type { Feature } from '../types/index.js';
import aiResponder from './aiResponder.js';
import aiNews from './aiNews.js';
import welcome from './welcome.js';
import contentNews from './contentNews.js';
import automod from './automod.js';
import reactionRoles from './reactionRoles.js';
import raidProtection from './raidProtection.js';
import leveling from './leveling.js';
import auditLog from './auditLog.js';

const features: Feature[] = [
  aiResponder,
  aiNews,
  welcome,
  contentNews,
  automod,
  reactionRoles,
  raidProtection,
  leveling,
  auditLog,
];

export function loadFeatures(): Feature[] {
  return features;
}
