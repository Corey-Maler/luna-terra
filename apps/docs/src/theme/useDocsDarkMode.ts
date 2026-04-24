import { useEffect, useState } from 'react';

function readDocsDarkMode(): boolean {
  return typeof document !== 'undefined'
    && document.documentElement.classList.contains('dark');
}

export function useDocsDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(readDocsDarkMode);

  useEffect(() => {
    const update = () => {
      setIsDark(readDocsDarkMode());
    };

    update();

    const observer = new MutationObserver(() => {
      update();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDark;
}