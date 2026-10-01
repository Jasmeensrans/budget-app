/** Pastel category palettes from the style guide: tag background, tag text, bar/chart shade. */
export interface CategoryColor {
  bg: string;
  fg: string;
  bar: string;
}

export const CATEGORY_COLORS = {
  green: { bg: '#DBEDDB', fg: '#1C5B37', bar: '#6DBB8E' },
  pink: { bg: '#F9E2EC', fg: '#8A2E5B', bar: '#E39AB9' },
  blue: { bg: '#DCEAF7', fg: '#22507A', bar: '#8DB8E3' },
  purple: { bg: '#EAE4F2', fg: '#5A3F7E', bar: '#AE9AD6' },
  peach: { bg: '#FDE8D7', fg: '#83441A', bar: '#EFA878' },
  yellow: { bg: '#FBF0CF', fg: '#6E5212', bar: '#E3C15A' },
  teal: { bg: '#D8EFEE', fg: '#1D5E5B', bar: '#79C2BD' },
  brown: { bg: '#EFE6E0', fg: '#6E4533', bar: '#C49D85' },
  sky: { bg: '#DDF0F9', fg: '#1E6386', bar: '#86C4E3' },
  brand: { bg: '#DDF0E3', fg: '#004F2D', bar: '#3E9467' },
} satisfies Record<string, CategoryColor>;

export type CategoryColorName = keyof typeof CATEGORY_COLORS;
