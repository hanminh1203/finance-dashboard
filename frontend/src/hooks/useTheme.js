import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, persistTheme } from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(persistTheme(next));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => persistTheme(current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
}
