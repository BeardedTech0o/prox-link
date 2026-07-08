// Runtime theme + accent switching, persisted to localStorage and mirrored by
// public/theme-init.js on first paint (flash-free).

export const ACCENTS = {
  lime: ['215 255 62', '183 217 53'],
  yellow: ['249 249 0', '212 212 0'],
  blue: ['59 130 246', '50 111 209'],
  purple: ['139 92 246', '118 78 209'],
  orange: ['245 158 11', '208 134 9'],
  red: ['239 68 68', '203 58 58'],
  pink: ['236 72 153', '201 61 130'],
} as const;

export type AccentKey = keyof typeof ACCENTS;
export type ThemeMode = 'light' | 'dark';

export function setAccent(key: AccentKey) {
  const [accent, hover] = ACCENTS[key];
  document.documentElement.style.setProperty('--c-accent', accent);
  document.documentElement.style.setProperty('--c-accent-hover', hover);
  localStorage.setItem('kb-accent', key);
}

export function setTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  localStorage.setItem('kb-theme', mode);
}

export function getAccent(): AccentKey {
  if (typeof window === 'undefined') return 'lime';
  const a = localStorage.getItem('kb-accent');
  return a && a in ACCENTS ? (a as AccentKey) : 'lime';
}

export function getTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('kb-theme') === 'light' ? 'light' : 'dark';
}
