/**
 * VectorDemoScene — like LiveCodeScene but with bidirectional sync.
 *
 * Two update paths coexist:
 *   – Scrubber drag  → updates both sceneConfig (rebuilds scene) and codeConfig (code panel)
 *   – Canvas drag    → updates codeConfig only (code panel reflects drag in real-time)
 *                      The buildScene callback receives an `onCanvasDrag` function so
 *                      elements like VectorArrow can push new values to the display
 *                      without triggering a full React scene rebuild.
 *
 * Usage
 * ─────
 * ```tsx
 * function buildScene(engine, config, onCanvasDrag) {
 *   const arrow = new VectorArrow({
 *     vector: new V2(config.vx, config.vy),
 *     draggable: true,
 *     onChange: (v) => onCanvasDrag({ vx: v.x, vy: v.y }),
 *   });
 *   engine.add(arrow);
 *   engine.zoomToRect(new Rect2D(new V2(-0.5, -0.5), new V2(0.5, 0.5)), 0.8);
 *   return arrow;
 * }
 * ```
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rect2D, V2 } from '@lunaterra/math';
import { LunaTerraEngine, ScaleIndicator, ZoomControls } from '@lunaterra/core';
import type { LTElement } from '@lunaterra/core';
import { parseLiveCode } from '../LiveCodeScene/parseLiveCode';
import { LiveCodeView } from '../LiveCodeScene/LiveCodeView';
import { getDocsDrawingTheme } from '../../theme/drawingTheme';
import styles from './VectorDemoScene.module.css';

function isDarkDocsTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

function resolveCanvasBackground(backgroundCssVar: string): string {
  if (!backgroundCssVar.startsWith('--')) {
    return backgroundCssVar;
  }

  const rootStyles = getComputedStyle(document.documentElement);
  return rootStyles.getPropertyValue(backgroundCssVar).trim()
    || rootStyles.getPropertyValue('--surface').trim()
    || '#fcf9f2';
}

export interface VectorDemoSceneProps<T extends Record<string, number>> {
  /**
   * Builds the scene. Must call `engine.add(root)` and return the root element.
   * Receives `onCanvasDrag` — call it with a partial config patch whenever
   * an in-canvas drag changes some value (to update the code panel display).
   */
  buildScene: (
    engine: LunaTerraEngine,
    config: T,
    onCanvasDrag: (patch: Partial<T>) => void,
  ) => LTElement;
  /** Initial config values — each key maps to a tunable number. */
  defaultConfig: T;
  /**
   * Annotated source code shown as the live code panel.
   * Uses the same `/*@live:key:min:max*\/VALUE` annotation format as LiveCodeScene.
   */
  source: string;
  /** Canvas height in pixels. Defaults to 400. */
  canvasHeight?: number;
  /** CSS variable or literal background color applied to the scene canvas. */
  backgroundCssVar?: string;
  /**
   * Whether to mount ScaleIndicator + ZoomControls overlays.
   * Defaults to false (vector demos usually have a fixed view).
   */
  zoom?: boolean;
}

const DEFAULT_SCROLL_BOUNDS = new Rect2D(new V2(-0.6, -0.6), new V2(0.6, 0.6));

export function VectorDemoScene<T extends Record<string, number>>({
  buildScene,
  defaultConfig,
  source,
  canvasHeight = 400,
  backgroundCssVar = '--surface',
  zoom = false,
}: VectorDemoSceneProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LunaTerraEngine | null>(null);

  // sceneConfigRef is a mutable mirror that always reflects the latest values
  // from BOTH scrubber drags and canvas drags, without triggering renders.
  const sceneConfigRef = useRef<T>({ ...defaultConfig });

  // sceneConfig triggers scene rebuild (state — causes useEffect to re-run).
  const [sceneConfig, setSceneConfig] = useState<T>(defaultConfig);

  // codeConfig drives the code panel display (scrubber values shown to user).
  const [codeConfig, setCodeConfig] = useState<T>(defaultConfig);

  const { displayCode, slots } = useMemo(() => parseLiveCode(source.trim()), [source]);

  // ── Engine mount (once) ──────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    engineRef.current = engine;
    engine.scrollBounds = DEFAULT_SCROLL_BOUNDS;
    container.appendChild(engine.getHtmlElements());

    if (zoom) {
      engine.add(new ScaleIndicator({}));
      engine.add(new ZoomControls({}));
    }

    return () => {
      engine.destroy();
      container.innerHTML = '';
      engineRef.current = null;
    };
  }, [zoom]);

  // ── Docs theme sync ────────────────────────────────────────────────────
  useEffect(() => {
    const applyTheme = () => {
      const engine = engineRef.current;
      if (!engine) return;

      engine.background = resolveCanvasBackground(backgroundCssVar);
      engine.theme = getDocsDrawingTheme(isDarkDocsTheme());
      engine.requestUpdate();
    };

    applyTheme();

    const observer = new MutationObserver(() => {
      applyTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, [backgroundCssVar]);

  // ── Scene rebuild (on sceneConfig change) ────────────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // onCanvasDrag: called from VectorArrow.onChange during drag.
    // Updates the mutable ref (for future scrubber merges) + code display only.
    const onCanvasDrag = (patch: Partial<T>) => {
      sceneConfigRef.current = { ...sceneConfigRef.current, ...patch };
      setCodeConfig(prev => ({ ...prev, ...patch } as T));
    };

    const root = buildScene(engine, sceneConfig, onCanvasDrag);
    engine.requestUpdate();

    return () => {
      root.destroy?.();
      const idx = engine.children.indexOf(root);
      if (idx !== -1) engine.children.splice(idx, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneConfig]);

  // ── Scrubber change handler ──────────────────────────────────────────────
  // Merges the new scrubber value with the latest ref state (includes canvas
  // drag values) to avoid reverting untracked canvas positions.
  const handleChange = useCallback((key: string, value: number) => {
    const next = { ...sceneConfigRef.current, [key]: value } as T;
    sceneConfigRef.current = next;
    setSceneConfig(next);
    setCodeConfig(next);
  }, []);

  const codeConfigAsRecord = codeConfig as Record<string, number>;

  return (
    <div className={styles.container}>
      <div
        ref={containerRef}
        style={{ height: canvasHeight, display: 'flex', minHeight: 0 }}
      />
      <div className={styles.codeWrapper}>
        <LiveCodeView
          displayCode={displayCode}
          slots={slots}
          currentConfig={codeConfigAsRecord}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
