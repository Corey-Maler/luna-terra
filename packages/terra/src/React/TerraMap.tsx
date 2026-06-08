import { useCallback, useRef } from 'react';
import { LunaTerraEngine } from '@lunaterra/core';
import { MapElement } from '../MapElement';

export interface TerraMapProps {
  /** Base URL of the tile server. Defaults to http://localhost:11111 */
  tileBaseUrl?: string;
  /** Called once after the engine is created and the MapElement is added. */
  onReady?: (engine: LunaTerraEngine) => void;
}

export const TerraMap = ({ tileBaseUrl, onReady }: TerraMapProps) => {
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const mountRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node !== null) {
        const engine = new LunaTerraEngine();
        node.appendChild(engine.getHtmlElements());
        engineRef.current = engine;
        containerRef.current = node;

        engine.add(new MapElement(tileBaseUrl));
        engine.requestContinuousLoop();

        onReady?.(engine);
      } else {
        engineRef.current?.destroy();
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        engineRef.current = null;
        containerRef.current = null;
      }
    },
    [onReady]
  );

  return (
    <div
      style={{ flex: '1 1 auto', display: 'flex' }}
      className="terra-map"
      ref={mountRef}
    />
  );
};
