import { useEffect } from 'react';

interface ShortcutHandlers {
  onPalette?: () => void;
  onSave?: () => void;
  onHelp?: () => void;
  onFocusSearch?: () => void;
}

export function useShortcuts(h: ShortcutHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        h.onPalette?.();
      } else if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        h.onSave?.();
      } else if (e.key === '?' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        h.onHelp?.();
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        h.onFocusSearch?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h]);
}
