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
