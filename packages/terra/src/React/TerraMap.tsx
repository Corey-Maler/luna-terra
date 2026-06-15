import { useCallback, useEffect, useRef } from 'react';
import { LunaTerraEngine } from '@lunaterra/core';
import { MapElement } from '../MapElement';
import type { TerraRenderStats } from '../TerraStats';
import type { TerraManifestBounds, TerraTileClient } from '../TileClient';
import type { TerraMapMode } from '../TerraMapRenderer';
import { MAX_DEPTH } from '../TileIndex';

export interface TerraMapProps {
  /** Base URL of the tile server. Defaults to http://localhost:11111 */
  tileBaseUrl?: string;
  /** Optional tile client. When provided, overrides tileBaseUrl. */
  tileClient?: TerraTileClient;
  /** Show real Web Mercator world/tile/source debug grid. */
  debugGrid?: boolean;
  /** Map surface mode. Globe is experimental and intended for low zooms. */
  mapMode?: TerraMapMode;
  /** Optional projected source bounds from tileset manifest. */
  sourceBounds?: TerraManifestBounds | null;
  /** Pitch the flat map plane in degrees. 0 keeps normal flat map rendering. */
  pitchDegrees?: number;
  /** Called once after the engine is created and the MapElement is added. */
  onReady?: (engine: LunaTerraEngine) => void;
  /** Called periodically with the geometry volume rendered by the current view. */
  onStats?: (stats: TerraRenderStats) => void;
}

const MAX_TILE_SCREEN_SIZE = 512;
const TERRA_MAX_ZOOM = 2 ** MAX_DEPTH * MAX_TILE_SCREEN_SIZE;

export const TerraMap = ({
  tileBaseUrl,
  tileClient,
  debugGrid = false,
  mapMode = 'plane',
  sourceBounds = null,
  pitchDegrees = 0,
  onReady,
  onStats,
}: TerraMapProps) => {
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapElementRef = useRef<MapElement | null>(null);
  const debugGridRef = useRef(debugGrid);
  const mapModeRef = useRef<TerraMapMode>(mapMode);
  const sourceBoundsRef = useRef(sourceBounds);
  const pitchDegreesRef = useRef(pitchDegrees);

  useEffect(() => {
    debugGridRef.current = debugGrid;
    mapElementRef.current?.setDebugGrid(debugGrid);
    engineRef.current?.requestUpdate();
  }, [debugGrid]);

  useEffect(() => {
    mapModeRef.current = mapMode;
    mapElementRef.current?.setMapMode(mapMode);
    engineRef.current?.requestUpdate();
  }, [mapMode]);

  useEffect(() => {
    sourceBoundsRef.current = sourceBounds;
    mapElementRef.current?.setSourceBounds(sourceBounds);
    engineRef.current?.requestUpdate();
  }, [sourceBounds]);

  useEffect(() => {
    pitchDegreesRef.current = pitchDegrees;
    mapElementRef.current?.setPitchDegrees(pitchDegrees);
    engineRef.current?.requestUpdate();
  }, [pitchDegrees]);

  const mountRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node !== null) {
        const engine = new LunaTerraEngine();
        node.appendChild(engine.getHtmlElements());
        engineRef.current = engine;
        containerRef.current = node;

        const mapElement = new MapElement(tileBaseUrl, {
          onStats,
          tileClient,
          debugGrid: debugGridRef.current,
          mapMode: mapModeRef.current,
          pitchDegrees: pitchDegreesRef.current,
          sourceBounds: sourceBoundsRef.current,
        });
        mapElementRef.current = mapElement;
        engine.add(mapElement);
        engine.renderer.maxZoom = TERRA_MAX_ZOOM;
        engine.requestUpdate();

        onReady?.(engine);
      } else {
        engineRef.current?.destroy();
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        engineRef.current = null;
        containerRef.current = null;
        mapElementRef.current = null;
      }
    },
    [onReady, onStats, tileBaseUrl, tileClient]
  );

  return (
    <div
      style={{ flex: '1 1 auto', display: 'flex' }}
      className="terra-map"
      ref={mountRef}
    />
  );
};
