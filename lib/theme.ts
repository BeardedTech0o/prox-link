// Runtime theme + accent switching, persisted to localStorage and mirrored by
// public/theme-init.js on first paint (flash-free).

export const ACCENTS = {
  sky: ['56 189 248', '125 211 252'],
  violet: ['139 92 246', '167 139 250'],
  emerald: ['16 185 129', '52 211 153'],
  orange: ['249 115 22', '251 146 60'],
  pink: ['236 72 153', '244 114 182'],
  indigo: ['99 102 241', '129 140 248'],
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
  if (typeof window === 'undefined') return 'violet';
  const a = localStorage.getItem('kb-accent');
  return a && a in ACCENTS ? (a as AccentKey) : 'violet';
}

export function getTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem('kb-theme') === 'dark' ? 'dark' : 'light';
}
