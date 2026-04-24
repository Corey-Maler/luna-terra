import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './NavGuide.module.css';

interface HeadingEntry {
  id: string;
  title: string;
  level: number;
}

function slugify(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || `heading-${index}`;
}

function scanHeadings(): HeadingEntry[] {
  const main = document.querySelector('main');
  if (!main) return [];

  const els = Array.from(main.querySelectorAll('h2, h3'));
  const found: HeadingEntry[] = [];

  els.forEach((el, i) => {
    const htmlEl = el as HTMLElement;
    const title = htmlEl.textContent?.trim() ?? '';
    if (!title) return;

    // Auto-assign an id if the heading doesn't have one
    if (!htmlEl.id) {
      htmlEl.id = slugify(title, i);
    }

    found.push({
      id: htmlEl.id,
      title,
      level: parseInt(el.tagName.slice(1), 10),
    });
  });

  return found;
}

export function NavGuide() {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const location = useLocation();
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  const applyHeadings = (found: HeadingEntry[]) => {
    setHeadings(found);

    intersectionObserverRef.current?.disconnect();
    if (found.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-10% 0px -75% 0px', threshold: 0 }
    );

    found.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    intersectionObserverRef.current = observer;
  };

  useEffect(() => {
    setHeadings([]);
    setActiveId(null);
    mutationObserverRef.current?.disconnect();
    intersectionObserverRef.current?.disconnect();

    // Scan after React has rendered the lazy-loaded page
    const timeoutId = setTimeout(() => {
      const found = scanHeadings();
      if (found.length > 0) {
        applyHeadings(found);
        return;
      }

      // If nothing found yet, watch for DOM updates (lazy loading)
      const main = document.querySelector('main');
      if (!main) return;

      const mo = new MutationObserver(() => {
        const f = scanHeadings();
        if (f.length > 0) {
          mo.disconnect(); // stop once headings are found
          applyHeadings(f);
        }
      });
      mo.observe(main, { childList: true, subtree: true });
      mutationObserverRef.current = mo;
    }, 80);

    return () => {
      clearTimeout(timeoutId);
      intersectionObserverRef.current?.disconnect();
      mutationObserverRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (headings.length === 0) return null;

  return (
    <aside className={styles.navGuide} aria-label="Page navigation guide">
      <h5 className={styles.heading}>Navigation Guide</h5>
      <ul className={styles.list}>
        {headings.map(({ id, title, level }) => {
          const isActive = activeId === id;
          return (
            <li
              key={id}
              className={[
                styles.item,
                isActive ? styles.active : '',
                level >= 3 ? styles.indent : '',
              ].join(' ')}
            >
              {isActive && <span className={styles.dot} aria-hidden="true" />}
              <button
                className={styles.btn}
                onClick={() => {
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveId(id);
                }}
              >
                {title}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

