import { useCallback, useEffect, useState } from 'react';

const KEY = 'applicant-tracking-theme';
// Light is the default; dark is a preference the viewer opts into.
type Theme = 'dark' | 'light';

const read = (): Theme => {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private windows and blocked site data both throw here.
  }
  return 'light';
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Preference is a convenience; never let it break rendering.
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
