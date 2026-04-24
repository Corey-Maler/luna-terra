import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LunaTerraEngine } from '@lunaterra/core';
import { ScaleRuler } from '@lunaterra/ui';
import { SolarSystemScene } from './SolarSystemScene';
import styles from './Home.module.css';

// ── Theme helpers ────────────────────────────────────────────────────────────

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

const SCALE_TICKS = [
  { value: 0, label: 'Luna-Terra' },
  { value: 1, label: 'Inner' },
  { value: 2, label: 'Solar' },
  { value: 3, label: 'Stars' },
  { value: 4, label: 'Galaxy' },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SolarSystemScene | null>(null);
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const rulerRef = useRef<ScaleRuler | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    engine.background = 'transparent';
    engineRef.current = engine;
    container.appendChild(engine.getHtmlElements());

    // ── Viewport: keep user pan/zoom enabled, buttons trigger camera jumps ──
    engine.interactive = true;

    // ── Create scene ─────────────────────────────────────────────────────
    const dark = isDark();
    const scene = new SolarSystemScene();
    scene.dark = dark;
    sceneRef.current = scene;

    engine.add(scene);

    // ── Scale ruler ──────────────────────────────────────────────────
    // Ruler drives the scene; scene also updates ruler when the viewport
    // zoom changes (scroll/pinch or nav-button animation).
    // rulerDriving is true while ruler is in control (drag + post-snap window)
    // so we don't create a feedback loop back into the ruler.
    let rulerDriving = false;
    let rulerDrivingTimer: ReturnType<typeof setTimeout> | null = null;

    const ruler = new ScaleRuler({
      ticks: SCALE_TICKS,
      value: 2,
      sticky: true,
      onChange: (v) => {
        if (!sceneRef.current) return;
        const level = Math.round(v);
        if (Math.abs(v - level) < 1e-3) {
          // Snap complete.
          // Sync the viewport to the target zoom WITHOUT flipping _viewportControlled —
          // that would cause the scene to re-derive its level from the old viewport zoom
          // and produce the double-animation the user sees.  Instead, the scene stays at
          // the exact snapped level; the viewport quietly catches up in the background.
          if (rulerDrivingTimer !== null) clearTimeout(rulerDrivingTimer);
          rulerDriving = true;
          sceneRef.current.syncViewportToLevel(level as 0 | 1 | 2 | 3 | 4);
          // Resume viewport-driven mode only after the 400 ms animation + buffer.
          rulerDrivingTimer = setTimeout(() => {
            sceneRef.current?.resumeViewportControl();
            rulerDriving = false;
          }, 450);
        } else {
          // Mid-drag: update scene content directly, no viewport change.
          rulerDriving = true;
          sceneRef.current.setZoomLevelDirect(v);
        }
      },
    });
    rulerRef.current = ruler;
    // Scene → ruler: keep ruler in sync while the viewport zoom changes
    // (nav buttons, scroll/pinch, post-snap viewport animation).
    scene.onZoomLevelChange = (v) => {
      if (!rulerDriving) rulerRef.current?.setValue(v);
    };
    engine.add(ruler);

    // Set initial camera framing to the Luna-Terra view for a consistent first paint.
    scene.zoomToLunaTerra();

    engine.requestUpdate();

    // ── Theme observer ───────────────────────────────────────────────────
    const observer = new MutationObserver(() => {
      const d = isDark();
      scene.dark = d;
      engine.requestUpdate();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
      if (rulerDrivingTimer !== null) clearTimeout(rulerDrivingTimer);
      engine.destroy();
      container.innerHTML = '';
      engineRef.current = null;
      rulerRef.current = null;
    };
  }, []);

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <h1 className={styles.headline}>LUNATERRA</h1>
        <p className={styles.tagline}>
          An extremely opinionated canvas rendering library for&nbsp;interactive
          visualisations, diagrams, and&nbsp;data&nbsp;exploration.
        </p>
        <hr className={styles.divider} />
        <Link to="/getting-started/overview" className={styles.ctaLink}>
          Get Started →
        </Link>
      </section>

      <div ref={containerRef} className={styles.canvasWrap} />
    </div>
  );
}
