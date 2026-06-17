import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  TerraMap,
  TerraTileStoreClient,
  type TerraMapMode,
  type TerraManifestBounds,
  type TerraRenderStats,
} from '@lunaterra/terra';
import type { LunaTerraEngine } from '@lunaterra/core';
import { Rect2D, V2 } from '@lunaterra/math';
import { FpsPanel, ScaleRuler } from '@lunaterra/ui';
import { DocPage } from '../../components/DocPage/DocPage';
import { useFps } from '../../context/FpsContext';

const formatNumber = (value: number) => Math.round(value).toLocaleString();
const tileClient = new TerraTileStoreClient();
const PRECISION_REPRO_ZOOM = 23720.4;
const PITCH_TICKS = [
  { value: 0, label: '0°' },
  { value: 15, label: '15°' },
  { value: 30, label: '30°' },
  { value: 45, label: '45°' },
  { value: 60, label: '60°' },
  { value: 65, label: '65°' },
];
const formatLevels = (stats: TerraRenderStats | null) => {
  if (!stats || stats.minLevel === null || stats.maxLevel === null) {
    return '-';
  }
  return stats.minLevel === stats.maxLevel
    ? String(stats.minLevel)
    : `${stats.minLevel}-${stats.maxLevel}`;
};

const formatWorld = (value: number) => value.toFixed(9);
const formatMetric = (value: number) => value.toFixed(value >= 10 ? 1 : 3);

const nextFloat32 = (value: number) => {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value === 0) {
    return Number.MIN_VALUE;
  }

  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, false);
  let bits = view.getInt32(0, false);
  bits += value > 0 ? 1 : -1;
  view.setInt32(0, bits, false);
  return view.getFloat32(0, false);
};

const pixelScale = (stats: TerraRenderStats) =>
  stats.zoom * Math.max(stats.viewportPixels.width, stats.viewportPixels.height);

const estimateWorldFloat32PixelStep = (stats: TerraRenderStats | null) => {
  if (!stats) {
    return null;
  }

  const { x, y } = stats.viewportCenter;
  const worldStep = Math.max(
    Math.abs(nextFloat32(x) - Math.fround(x)),
    Math.abs(nextFloat32(y) - Math.fround(y))
  );

  return worldStep * pixelScale(stats);
};

const estimateRenderFloat32PixelStep = (stats: TerraRenderStats | null) => {
  if (!stats) {
    return null;
  }

  const { renderAnchor, visibleArea } = stats;
  const maxRelativeCoord = Math.max(
    Math.abs(visibleArea.minX - renderAnchor.x),
    Math.abs(visibleArea.maxX - renderAnchor.x),
    Math.abs(visibleArea.minY - renderAnchor.y),
    Math.abs(visibleArea.maxY - renderAnchor.y),
  );
  const relativeStep = Math.abs(nextFloat32(maxRelativeCoord) - Math.fround(maxRelativeCoord));
  return relativeStep * pixelScale(stats);
};

export default function Terra() {
  const { fpsEnabled } = useFps();
  const fpsEnabledRef = useRef(fpsEnabled);
  const fpsPanelRef = useRef<FpsPanel | null>(null);
  const pitchDegreesRef = useRef(0);
  const pitchRulerRef = useRef<ScaleRuler | null>(null);
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const [stats, setStats] = useState<TerraRenderStats | null>(null);
  const [manifestBounds, setManifestBounds] = useState<Rect2D | null>(null);
  const [sourceBounds, setSourceBounds] = useState<TerraManifestBounds | null>(null);
  const [debugGrid, setDebugGrid] = useState(false);
  const [debugTileFill, setDebugTileFill] = useState(false);
  const [mapMode, setMapMode] = useState<TerraMapMode>('auto');
  const [pitchDegrees, setPitchDegrees] = useState(0);

  const handleReady = useCallback((engine: LunaTerraEngine) => {
    engineRef.current = engine;

    const fpsPanel = new FpsPanel({ anchor: 'top-left', offsetX: 8, offsetY: 8 });
    engine.add(fpsPanel);
    fpsPanel.setEnabled(fpsEnabledRef.current);
    fpsPanelRef.current = fpsPanel;

    let rulerDragInteractive = engine.interactive;
    const pitchRuler = new ScaleRuler({
      ticks: PITCH_TICKS,
      value: pitchDegreesRef.current,
      position: 'bottom-center',
      edgeOffset: 36,
      sidePadding: 56,
      sticky: false,
      badgePosition: 'inline',
      formatValue: (value) => `${Math.round(value)}°`,
      onChange: (value) => {
        const nextPitch = Math.round(value);
        setPitchDegrees((currentPitch) => currentPitch === nextPitch ? currentPitch : nextPitch);
      },
      onDragStart: () => {
        rulerDragInteractive = engine.interactive;
        engine.interactive = false;
      },
      onDragEnd: () => {
        engine.interactive = rulerDragInteractive;
      },
    });
    engine.add(pitchRuler);
    pitchRulerRef.current = pitchRuler;

    void tileClient.getManifest().then((manifest) => {
      if (!manifest?.bounds || engineRef.current !== engine) {
        return;
      }
      setSourceBounds(manifest.bounds);
      const bounds = new Rect2D(
        new V2(manifest.bounds.minX, manifest.bounds.minY),
        new V2(manifest.bounds.maxX, manifest.bounds.maxY)
      );
      setManifestBounds(bounds);
      engine.zoomToRect(bounds, 0.75);
      engine.requestUpdate();
    });
  }, []);

  const handleStats = useCallback((nextStats: TerraRenderStats) => {
    setStats(nextStats);
  }, []);

  useEffect(() => {
    fpsEnabledRef.current = fpsEnabled;
    fpsPanelRef.current?.setEnabled(fpsEnabled);
    engineRef.current?.requestUpdate();
  }, [fpsEnabled]);

  useEffect(() => {
    pitchDegreesRef.current = pitchDegrees;
    pitchRulerRef.current?.setValue(pitchDegrees);
    engineRef.current?.requestUpdate();
  }, [pitchDegrees]);

  const fitDataset = useCallback(() => {
    if (!manifestBounds || !engineRef.current) {
      return;
    }
    engineRef.current.zoomToRect(manifestBounds, 0.75);
    engineRef.current.requestUpdate();
  }, [manifestBounds]);

  const goToPrecisionRepro = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    const center = stats
      ? new V2(stats.viewportCenter.x, stats.viewportCenter.y)
      : manifestBounds?.center;

    if (!center) {
      return;
    }

    engine.zoomToPoint(center, PRECISION_REPRO_ZOOM);
    engine.requestUpdate();
  }, [manifestBounds, stats]);

  const worldPixelStep = estimateWorldFloat32PixelStep(stats);
  const renderPixelStep = estimateRenderFloat32PixelStep(stats);

  return (
    <DocPage title="Terra" section="@lunaterra/terra">
      <DocPage.Section id="overview" title="Overview">
        <p>
          <code>@lunaterra/terra</code> is the OSM tile map renderer for Luna-Terra.
          It provides lazy quadtree tile fetching, coordinate unpacking, and
          geometry rendering on top of <code>@lunaterra/core</code>.
        </p>
        <p>
          The tile server must be running on <code>http://localhost:11111</code>.
          Start it with <code>./serve-tiles.sh</code> from the workspace root.
        </p>
      </DocPage.Section>

      <DocPage.Section id="map" title="Live Map">
        <div style={{ height: '60vh', display: 'flex', flex: '1 1 auto', minHeight: 420 }}>
          <TerraMap
            tileClient={tileClient}
            debugGrid={debugGrid}
            debugTileFill={debugTileFill}
            mapMode={mapMode}
            pitchDegrees={pitchDegrees}
            sourceBounds={sourceBounds}
            onReady={handleReady}
            onStats={handleStats}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
          }}
        >
          <button type="button" onClick={fitDataset} disabled={!manifestBounds}>
            Fit dataset
          </button>
          <button type="button" onClick={goToPrecisionRepro} disabled={!manifestBounds && !stats}>
            High zoom repro
          </button>
          <div
            style={{
              alignItems: 'center',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              display: 'inline-flex',
              minHeight: 32,
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setMapMode('auto')}
              style={{
                border: 0,
                borderRadius: 0,
                background: mapMode === 'auto' ? 'var(--surface-container-high)' : 'transparent',
              }}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => setMapMode('plane')}
              style={{
                border: 0,
                borderLeft: '1px solid var(--border-color)',
                borderRadius: 0,
                background: mapMode === 'plane' ? 'var(--surface-container-high)' : 'transparent',
              }}
            >
              Plane
            </button>
            <button
              type="button"
              onClick={() => setMapMode('globe')}
              style={{
                border: 0,
                borderLeft: '1px solid var(--border-color)',
                borderRadius: 0,
                background: mapMode === 'globe' ? 'var(--surface-container-high)' : 'transparent',
              }}
            >
              Globe
            </button>
          </div>
          <label
            style={{
              alignItems: 'center',
              display: 'inline-flex',
              gap: 6,
              minHeight: 32,
            }}
          >
            <input
              type="checkbox"
              checked={debugGrid}
              onChange={(event) => setDebugGrid(event.currentTarget.checked)}
            />
            Map grid
          </label>
          <label
            style={{
              alignItems: 'center',
              display: 'inline-flex',
              gap: 6,
              minHeight: 32,
            }}
          >
            <input
              type="checkbox"
              checked={debugTileFill}
              onChange={(event) => setDebugTileFill(event.currentTarget.checked)}
            />
            Tile fill
          </label>
          <span
            style={{
              alignItems: 'center',
              display: 'inline-flex',
              fontVariantNumeric: 'tabular-nums',
              minHeight: 32,
            }}
          >
            Pitch {pitchDegrees}°
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 8,
            marginTop: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Metric label="Zoom" value={stats ? stats.zoom.toFixed(1) : '-'} />
          <Metric label="Map Mode" value={mapMode} />
          <Metric label="Render Mode" value={stats ? stats.renderMode : '-'} />
          <Metric label="Pitch" value={stats ? `${stats.pitchDegrees.toFixed(0)}°` : '-'} />
          <Metric
            label="Center X"
            value={stats ? formatWorld(stats.viewportCenter.x) : '-'}
          />
          <Metric
            label="Center Y"
            value={stats ? formatWorld(stats.viewportCenter.y) : '-'}
          />
          <Metric
            label="World F32"
            value={worldPixelStep === null ? '-' : `${formatMetric(worldPixelStep)} px`}
          />
          <Metric
            label="Render F32"
            value={renderPixelStep === null ? '-' : `${formatMetric(renderPixelStep)} px`}
          />
          <Metric label="Levels" value={formatLevels(stats)} />
          <Metric label="Tiles" value={stats ? formatNumber(stats.visibleCollections) : '-'} />
          <Metric label="Geometries" value={stats ? formatNumber(stats.sourceGeometries) : '-'} />
          <Metric label="Groups" value={stats ? formatNumber(stats.groups) : '-'} />
          <Metric label="Points" value={stats ? formatNumber(stats.points) : '-'} />
          <Metric label="Line Points" value={stats ? formatNumber(stats.linePoints) : '-'} />
          <Metric label="Area Points" value={stats ? formatNumber(stats.areaPoints) : '-'} />
          <Metric label="Triangles" value={stats ? formatNumber(stats.triangles) : '-'} />
        </div>
        {stats && (
          <div
            style={{
              marginTop: 8,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 12,
              overflowWrap: 'anywhere',
            }}
          >
            visible [{formatWorld(stats.visibleArea.minX)}, {formatWorld(stats.visibleArea.minY)}]
            - [{formatWorld(stats.visibleArea.maxX)}, {formatWorld(stats.visibleArea.maxY)}]
          </div>
        )}
        {stats && stats.topTypes.length > 0 && (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Geometries</TableHeader>
                  <TableHeader>Groups</TableHeader>
                  <TableHeader>Points</TableHeader>
                  <TableHeader>Line Points</TableHeader>
                  <TableHeader>Area Points</TableHeader>
                  <TableHeader>Triangles</TableHeader>
                </tr>
              </thead>
              <tbody>
                {stats.topTypes.map((type) => (
                  <tr key={type.typeId}>
                    <TableCell>{type.name} ({type.typeId})</TableCell>
                    <TableCell numeric>{formatNumber(type.geometries)}</TableCell>
                    <TableCell numeric>{formatNumber(type.groups)}</TableCell>
                    <TableCell numeric>{formatNumber(type.points)}</TableCell>
                    <TableCell numeric>{formatNumber(type.linePoints)}</TableCell>
                    <TableCell numeric>{formatNumber(type.areaPoints)}</TableCell>
                    <TableCell numeric>{formatNumber(type.triangles)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DocPage.Section>
    </DocPage>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 6,
        padding: '8px 10px',
        background: 'var(--surface)',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 650, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th
      style={{
        borderBottom: '1px solid var(--border-color)',
        color: 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        padding: '6px 8px',
        textAlign: 'left',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <td
      style={{
        borderBottom: '1px solid var(--surface-container-high)',
        padding: '6px 8px',
        textAlign: numeric ? 'right' : 'left',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}
