const STORAGE_KEY = 'theme';
const DEFAULT_THEME = 'dark';

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* private mode / blocked storage */
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme) {
  const next = theme === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', next === 'dark');
  root.dataset.theme = next;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', next === 'dark' ? '#0F172A' : '#F0F3F7');
  }

  return next;
}

export function persistTheme(theme) {
  const next = applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}
