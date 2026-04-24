import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Search, Github, Activity } from 'lucide-react';
import { LunaTerraEngine } from '@lunaterra/core';
import { useFps } from '../../context/FpsContext';
import styles from './Header.module.css';

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('lt-dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('lt-dark-mode', String(dark));
  }, [dark]);

  return [dark, setDark] as const;
}

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Examples', to: '/core/lt-element' },
  { label: 'Docs', to: '/math/v2' },
];

export function Header() {
  const [dark, setDark] = useDarkMode();
  const location = useLocation();
  const { fpsEnabled, setFpsEnabled } = useFps();

  const handleFpsToggle = () => {
    const next = !fpsEnabled;
    setFpsEnabled(next);
    LunaTerraEngine.instance?.fpsPanel?.setEnabled(next);
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* ── Top row ── */}
        <div className={styles.topRow}>
          <span className={styles.vol}>Vol. I — Issue 1</span>

          <Link to="/" className={styles.masthead}>
            LUNATERRA
          </Link>

          <div className={styles.actions}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search the docs..."
                aria-label="Search documentation"
              />
            </div>
            <a
              href="https://github.com/lunaterra"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.iconBtn}
              aria-label="GitHub"
            >
              <Github size={18} />
            </a>
            <button
              className={styles.iconBtn}
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className={`${styles.iconBtn} ${fpsEnabled ? styles.iconBtnActive : ''}`}
              onClick={handleFpsToggle}
              aria-label={fpsEnabled ? 'Disable FPS counter' : 'Enable FPS counter'}
              title="Toggle FPS counter"
            >
              <Activity size={18} />
            </button>
          </div>
        </div>

        {/* ── Nav row ── */}
        <nav className={styles.navRow} aria-label="Main navigation">
          {NAV_LINKS.map(({ label, to }) => {
            const isActive =
              to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(to.split('/').slice(0, 2).join('/'));
            return (
              <Link
                key={label}
                to={to}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
              >
                {label.toUpperCase()}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
