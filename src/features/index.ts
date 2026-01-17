import type { Feature } from '../types/index.js';
import aiResponder from './aiResponder.js';
import aiNews from './aiNews.js';
import welcome from './welcome.js';
import contentNews from './contentNews.js';
import automod from './automod.js';

const features: Feature[] = [aiResponder, aiNews, welcome, contentNews, automod];

export function loadFeatures(): Feature[] {
  return features;
}
