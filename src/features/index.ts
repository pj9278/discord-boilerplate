import type { Feature } from '../types/index.js';
import aiResponder from './aiResponder.js';
import aiNews from './aiNews.js';
import welcome from './welcome.js';

const features: Feature[] = [aiResponder, aiNews, welcome];

export function loadFeatures(): Feature[] {
  return features;
}
