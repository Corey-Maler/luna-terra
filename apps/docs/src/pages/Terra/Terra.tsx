import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { TerraMap, TerraTileStoreClient, type TerraRenderStats } from '@lunaterra/terra';
import type { LunaTerraEngine } from '@lunaterra/core';
import { Rect2D, V2 } from '@lunaterra/math';
import { FpsPanel } from '@lunaterra/ui';
import { DocPage } from '../../components/DocPage/DocPage';
import { useFps } from '../../context/FpsContext';

const formatNumber = (value: number) => Math.round(value).toLocaleString();
const tileClient = new TerraTileStoreClient();
const formatLevels = (stats: TerraRenderStats | null) => {
  if (!stats || stats.minLevel === null || stats.maxLevel === null) {
    return '-';
  }
  return stats.minLevel === stats.maxLevel
    ? String(stats.minLevel)
    : `${stats.minLevel}-${stats.maxLevel}`;
};

export default function Terra() {
  const { fpsEnabled } = useFps();
  const fpsEnabledRef = useRef(fpsEnabled);
  const fpsPanelRef = useRef<FpsPanel | null>(null);
  const engineRef = useRef<LunaTerraEngine | null>(null);
  const [stats, setStats] = useState<TerraRenderStats | null>(null);

  const handleReady = useCallback((engine: LunaTerraEngine) => {
    engineRef.current = engine;

    const fpsPanel = new FpsPanel({ anchor: 'top-left', offsetX: 8, offsetY: 8 });
    engine.add(fpsPanel);
    fpsPanel.setEnabled(fpsEnabledRef.current);
    fpsPanelRef.current = fpsPanel;

    void tileClient.getManifest().then((manifest) => {
      if (!manifest?.bounds || engineRef.current !== engine) {
        return;
      }
      engine.zoomToRect(
        new Rect2D(
          new V2(manifest.bounds.minX, manifest.bounds.minY),
          new V2(manifest.bounds.maxX, manifest.bounds.maxY)
        ),
        0.75
      );
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
          <TerraMap tileClient={tileClient} onReady={handleReady} onStats={handleStats} />
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
          <Metric label="Levels" value={formatLevels(stats)} />
          <Metric label="Tiles" value={stats ? formatNumber(stats.visibleCollections) : '-'} />
          <Metric label="Geometries" value={stats ? formatNumber(stats.sourceGeometries) : '-'} />
          <Metric label="Groups" value={stats ? formatNumber(stats.groups) : '-'} />
          <Metric label="Points" value={stats ? formatNumber(stats.points) : '-'} />
          <Metric label="Line Points" value={stats ? formatNumber(stats.linePoints) : '-'} />
          <Metric label="Area Points" value={stats ? formatNumber(stats.areaPoints) : '-'} />
          <Metric label="Triangles" value={stats ? formatNumber(stats.triangles) : '-'} />
        </div>
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
