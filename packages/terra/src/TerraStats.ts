export interface TerraTypeStats {
  typeId: number;
  name: string;
  geometries: number;
  groups: number;
  points: number;
  linePoints: number;
  areaPoints: number;
  triangles: number;
}

export interface TerraRenderStats {
  zoom: number;
  renderMode:
    | 'world-float32'
    | 'camera-relative'
    | 'core-3d-plane'
    | 'core-3d-pitched-plane';
  pitchDegrees: number;
  viewportCenter: { x: number; y: number };
  renderAnchor: { x: number; y: number };
  viewportPixels: { width: number; height: number };
  visibleArea: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  minLevel: number | null;
  maxLevel: number | null;
  visibleCollections: number;
  sourceGeometries: number;
  groups: number;
  lineGroups: number;
  areaGroups: number;
  points: number;
  linePoints: number;
  areaPoints: number;
  triangles: number;
  topTypes: TerraTypeStats[];
}

export const emptyTerraRenderStats = (): TerraRenderStats => ({
  zoom: 0,
  renderMode: 'world-float32',
  pitchDegrees: 0,
  viewportCenter: { x: 0, y: 0 },
  renderAnchor: { x: 0, y: 0 },
  viewportPixels: { width: 0, height: 0 },
  visibleArea: {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  },
  minLevel: null,
  maxLevel: null,
  visibleCollections: 0,
  sourceGeometries: 0,
  groups: 0,
  lineGroups: 0,
  areaGroups: 0,
  points: 0,
  linePoints: 0,
  areaPoints: 0,
  triangles: 0,
  topTypes: [],
});
