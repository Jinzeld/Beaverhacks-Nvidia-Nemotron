/** UI-only label; included in POST /api/review goal (matches frontend/scan.js). */
export const MODEL_UI_LABEL = 'NEMOTRON-3-NANO'

/** Shown in UI and sent as context in POST /api/review goal (UI modules: …). */
export const MODULES_DEFAULT = [
  'HTTP Security Headers',
  'Wildcard CORS',
  'Controlled Service Inventory',
  'Exposed Lab Dotfile Check',
  'Directory Listing Check',
  'Agent Decision Trace',
  'Nemotron Reasoning',
  'Markdown Report',
] as const

export function normalizeTarget(raw: string): string {
  return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim()
}

export function buildReviewGoal(
  targetNote: string,
  modules: readonly string[],
  modelLabel: string = MODEL_UI_LABEL,
): string {
  return [
    'Read-only security review (MVP).',
    `UI modules: ${modules.join(', ')}.`,
    `User context / note: ${targetNote}.`,
    `Model selection (UI only): ${modelLabel}.`,
  ].join(' ')
}
