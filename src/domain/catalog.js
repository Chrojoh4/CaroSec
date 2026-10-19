// Vocabulary only. A verified rule bundle must define permitted combinations.
export const RALLY_LEVELS = Object.freeze([
  'novice', 'intermediate', 'advanced', 'excellent', 'versatility', 'versatility_excellent',
]);
export const RALLY_FORMATS = Object.freeze(['regular', 'team', 'brace']);
export const WORKING_LEVELS = Object.freeze(['rookie', 'elite', 'expert']);

export function validateEventVocabulary(event) {
  if (event.discipline === 'rally') {
    if (!RALLY_LEVELS.includes(event.level) || !RALLY_FORMATS.includes(event.format)) {
      throw new Error('Unknown Rally level or format');
    }
  } else if (event.discipline === 'working') {
    if (event.level != null || event.format != null) {
      throw new Error('Working levels belong to individual exercise selections');
    }
  } else {
    throw new Error('Unknown discipline');
  }
}
