/**
 * LiveCodeScene — a reusable component that pairs a canvas renderer with an
 * interactive, syntax-highlighted code preview.
 *
 * Usage
 * ─────
 * 1. Write a `buildScene(engine, config)` function that creates and adds scene
 *    elements to the engine, and returns the root `LTElement`.
 * 2. Define `defaultConfig` with the initial values for every tunable parameter.
 * 3. Write a `SCENE_CODE` string (annotated with `/*@live:key:min:max*\/` before
 *    each tunable numeric literal) that documents the scene construction.
 * 4. Render `<LiveCodeScene buildScene={…} defaultConfig={…} source={SCENE_CODE} />`.
 *
 * The component mounts a `LunaTerraEngine`, renders the scene, and shows
 * the annotated code beneath the canvas.  Dragging a highlighted number rebuilds
 * the scene in real time with the updated config value.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Rect2D, V2 } from '@lunaterra/math';
import { LunaTerraEngine, ScaleIndicator, ZoomControls } from '@lunaterra/core';
import type { LTElement } from '@lunaterra/core';
import { Color } from '@lunaterra/color';
import { FpsPanel } from '@lunaterra/ui';
import { parseLiveCode } from './parseLiveCode';
import { LiveCodeView } from './LiveCodeView';
import { useFps } from '../../context/FpsContext';
import { getDocsDrawingTheme } from '../../theme/drawingTheme';
import styles from './LiveCodeScene.module.css';

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

export interface LiveCodeSceneProps<T extends Record<string, unknown>> {
  /**
   * Builds the scene for a given config snapshot.
   * Must call `engine.add(root)` and return the root element that was added.
   * The component calls this again whenever the config changes, removing the
   * previous root before doing so.
   */
  buildScene: (engine: LunaTerraEngine, config: T) => LTElement;
  /** Initial values for all tunable parameters. */
  defaultConfig: T;
  /**
   * Annotated source string shown as the live code preview.
   * Annotations have the form `/*@live:key:min:max*\/VALUE` and are stripped
   * from the displayed code; each VALUE becomes a draggable scrubber.
   */
  source: string;
  /** Height of the canvas in pixels. Defaults to 400. */
  canvasHeight?: number;
  /** CSS variable or literal background color applied to the scene canvas. */
  backgroundCssVar?: string;
  /**
   * Whether to add ScaleIndicator + ZoomControls overlays to every scene.
   * Defaults to `true`. Set to `false` on pages that manage their own zoom UI.
   */
  zoom?: boolean;
  /**
   * Constrains panning to stay within bounds.
   * Defaults to the unit square `[0,1]²` when `zoom` is true.
   * Pass `null` to disable scroll bounds.
   */
  scrollBounds?: Rect2D | null;
  /**
   * Optional render prop to place custom controls (e.g. ColorSelector) between
   * the canvas and the code preview. Receives the current config and its setter.
   */
  controls?: (config: T, setConfig: React.Dispatch<React.SetStateAction<T>>) => ReactNode;
}

const DEFAULT_SCROLL_BOUNDS = new Rect2D(new V2(-0.05, -0.05), new V2(1.05, 1.05));

export function LiveCodeScene<T extends Record<string, unknown>>({
  buildScene,
  defaultConfig,
  source,
  canvasHeight = 400,
  backgroundCssVar = '--surface',
  zoom = true,
  scrollBounds,
  controls,
}: LiveCodeSceneProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const fpsPanelRef = useRef<FpsPanel | null>(null);

  const [config, setConfig] = useState<T>(defaultConfig);
  const { fpsEnabled } = useFps();

  // Parse annotations once (source is treated as static after mount).
  const { displayCode, slots, colorSlots } = useMemo(() => parseLiveCode(source.trim()), [source]);

  // ── Engine lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const engine = new LunaTerraEngine();
    engineRef.current = engine;
    container.appendChild(engine.getHtmlElements());

    // Scroll bounds — constrain panning to stay within bounds.
    const resolvedBounds = scrollBounds !== undefined ? scrollBounds : (zoom ? DEFAULT_SCROLL_BOUNDS : null);
    if (resolvedBounds) {
      engine.scrollBounds = resolvedBounds;
    }

    // Zoom overlays are stable across scene rebuilds (added once here, not in buildScene).
    if (zoom) {
      engine.add(new ScaleIndicator({}));
      engine.add(new ZoomControls({}));
    }

    // FPS panel — always added, enabled state driven by FpsContext.
    const fpsPanel = new FpsPanel({ anchor: 'top-left', offsetX: 8, offsetY: 8 });
    engine.add(fpsPanel);
    fpsPanelRef.current = fpsPanel;

    return () => {
      engine.destroy();
      container.innerHTML = '';
      engineRef.current = null;
      fpsPanelRef.current = null;
    };
  }, [zoom]);

  // ── Scene rebuild ─────────────────────────────────────────────────────────
  // Runs on mount (after engine init) and whenever config or buildScene changes.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const root = buildScene(engine, config);
    engine.requestUpdate();

    return () => {
      // Remove this root before the next rebuild so only one scene exists at a time.
      root.destroy?.();
      const idx = engine.children.indexOf(root);
      if (idx !== -1) engine.children.splice(idx, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, buildScene]);

  // ── FPS panel enabled state sync ──────────────────────────────────────────
  useEffect(() => {
    fpsPanelRef.current?.setEnabled(fpsEnabled);
    engineRef.current?.requestUpdate();
  }, [fpsEnabled]);

  // ── Docs theme sync ──────────────────────────────────────────────────────
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

  // ── Config updates ────────────────────────────────────────────────────────
  const handleChange = useCallback((key: string, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleColorChange = useCallback((key: string, color: Color) => {
    setConfig(prev => ({ ...prev, [key]: color }));
  }, []);

  const configAsRecord = config as Record<string, number>;

  // Extract Color-valued keys from config for the code view's color swatches.
  const colorConfig = useMemo(() => {
    const out: Record<string, Color> = {};
    for (const [k, v] of Object.entries(config as Record<string, unknown>)) {
      // Duck-type check so Color works regardless of module-identity (instanceof
      // can fail if Vite loads the same source through two different paths).
      if (
        v !== null &&
        typeof v === 'object' &&
        'r' in v && 'g' in v && 'b' in v && 'a' in v
      ) {
        out[k] = v as Color;
      }
    }
    return out;
  }, [config]);

  return (
    <div className={styles.container}>
      <div
        ref={containerRef}
        style={{ height: canvasHeight, display: 'flex', minHeight: 0 }}
      />
      {controls && (
        <div className={styles.controlsWrapper}>
          {controls(config, setConfig)}
        </div>
      )}
      <div className={styles.codeWrapper}>
        <LiveCodeView
          displayCode={displayCode}
          slots={slots}
          colorSlots={colorSlots}
          currentConfig={configAsRecord}
          colorConfig={colorConfig}
          onChange={handleChange}
          onColorChange={handleColorChange}
        />
      </div>
    </div>
  );
}
