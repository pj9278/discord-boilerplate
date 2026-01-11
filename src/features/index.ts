import type { Feature } from '../types/index.js';
import aiResponder from './aiResponder.js';
import aiNews from './aiNews.js';

const features: Feature[] = [aiResponder, aiNews];

export function loadFeatures(): Feature[] {
  return features;
}
