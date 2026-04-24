import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const FOOTER_LINKS = {
  Library: [
    { label: 'GitHub', href: 'https://github.com/lunaterra' },
    { label: 'Changelog', href: '#' },
    { label: 'Releases', href: '#' },
  ],
  Documentation: [
    { label: 'Getting Started', href: '/math/v2' },
    { label: 'API Reference', href: '/core/lt-element' },
    { label: 'Examples', href: '/core/lt-element' },
  ],
  Community: [
    { label: 'Report a Bug', href: 'https://github.com/lunaterra/issues' },
    { label: 'License (MIT)', href: '#' },
    { label: 'Contributing', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* ── Top rule ── */}
        <div className={styles.topRule} />

        {/* ── Main columns ── */}
        <div className={styles.columns}>
          <div className={styles.brand}>
            <Link to="/" className={styles.wordmark}>
              LUNATERRA
            </Link>
            <p className={styles.tagline}>
              High-performance canvas graphics for the modern web.
              <br />
              Every pixel rendered. Every frame counted.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section} className={styles.linkGroup}>
              <h6 className={styles.groupTitle}>{section}</h6>
              <ul className={styles.linkList}>
                {links.map(({ label, href }) =>
                  href.startsWith('http') || href === '#' ? (
                    <li key={label}>
                      <a
                        href={href}
                        className={styles.footerLink}
                        target={href.startsWith('http') ? '_blank' : undefined}
                        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {label}
                      </a>
                    </li>
                  ) : (
                    <li key={label}>
                      <Link to={href} className={styles.footerLink}>
                        {label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Bottom bar ── */}
        <div className={styles.bottomRule} />
        <div className={styles.bottomBar}>
          <span className={styles.copyright}>
            © {new Date().getFullYear()} LunaTerra. All rights reserved.
          </span>
          <div className={styles.bottomLinks}>
            <a href="#" className={styles.bottomLink}>Privacy Policy</a>
            <a href="#" className={styles.bottomLink}>Terms of Service</a>
            <a href="#" className={styles.bottomLink}>Masthead</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
