import type { Feature } from '../types/index.js';
import aiResponder from './aiResponder.js';

const features: Feature[] = [aiResponder];

export function loadFeatures(): Feature[] {
  return features;
}
