import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
} from 'react';
import { LunaTerraEngine } from '@lunaterra/core';

export type LunaTerraCleanup = () => void;
export type LunaTerraSceneSetup = (
  engine: LunaTerraEngine,
) => void | LunaTerraCleanup;

export interface LunaTerraCanvasProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * Build the canvas scene after the engine is mounted. Return a function to
   * release scene-owned subscriptions or other resources.
   *
   * Keep this callback referentially stable (for example with useCallback).
   * A changed callback intentionally tears down and recreates the engine.
   */
  onCreate?: LunaTerraSceneSetup;
  /** Canvas clear colour. Set to null for a transparent canvas. */
  background?: string | null;
  /** Enable Luna-Terra's built-in pan and zoom input. Defaults to false. */
  interactive?: boolean;
  /** Rendered while the engine is unavailable, such as during SSR. */
  fallback?: ReactNode;
}

const fillContainer: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  position: 'relative',
};

/**
 * React-owned host for a low-level Luna-Terra canvas scene.
 *
 * The adapter owns only DOM mounting and engine lifecycle. Scene primitives,
 * state, rendering, and interaction remain in Luna-Terra.
 */
export function LunaTerraCanvas({
  onCreate,
  background = null,
  interactive = false,
  fallback = null,
  style,
  ...hostProps
}: LunaTerraCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const engine = new LunaTerraEngine();
    engine.background = background;
    engine.interactive = interactive;

    const engineRoot = engine.getHtmlElements();
    engineRoot.style.width = '100%';
    engineRoot.style.height = '100%';
    host.appendChild(engineRoot);

    const cleanupScene = onCreate?.(engine);
    engine.requestUpdate();

    return () => {
      cleanupScene?.();
      engine.destroy();
      engineRoot.remove();
    };
  }, [background, interactive, onCreate]);

  return (
    <div ref={hostRef} style={{ ...fillContainer, ...style }} {...hostProps}>
      {fallback}
    </div>
  );
}
