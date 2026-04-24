import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { RouteDefinitions, SectionDefinition } from '../pages/AllPages';
import {
  Menu,
  X,
} from 'lucide-react';

import styles from './styles.module.css';

const Section = ({
  section,
  onLinkClick,
}: {
  section: SectionDefinition;
  onLinkClick?: () => void;
}) => {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{section['section-title']}</h3>
      <ul className={styles.sectionList}>
        {section.pages.map((page) => (
          <li key={page.title} className={styles.linkItem}>
            <NavLink
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.active : ''}`
              }
              to={`/${section['tag']}/${page.tag}`}
              onClick={onLinkClick}
            >
              {page.title}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const NavPanel = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={styles.burgerBtn}
        onClick={() => setIsOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>
      <nav className={`${styles.navPanel} ${isOpen ? styles.open : ''}`}>
        <button
          className={styles.closeBtn}
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
        >
          <X size={24} />
        </button>
        <div className={styles.navHeader}>
          <span className={styles.navTitle}>Sections</span>
          <span className={styles.navVol}>Vol. I</span>
        </div>

        {RouteDefinitions.map((section) => (
          <Section
            key={section['section-title']}
            section={section}
            onLinkClick={() => setIsOpen(false)}
          />
        ))}
      </nav>
      {isOpen && (
        <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
      )}
    </>
  );
};
