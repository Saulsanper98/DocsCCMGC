/** 12-color categorical palette that works in light + dark mode */
const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#84cc16', '#6366f1', '#a855f7',
];

/** Deterministic color from any string (category name or id) */
export function getCategoryColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Background at 12% opacity for a given hex color */
export function getCategoryBg(color: string): string {
  return `${color}1f`;
}
