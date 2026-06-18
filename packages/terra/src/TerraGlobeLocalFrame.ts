import { Camera3D } from '@lunaterra/core';
import { M4, V3 } from '@lunaterra/math';
import {
  clamp01,
  latitudeRadiansToWorldV,
  longitudeRadiansToWorldU,
  worldUToLongitudeRadians,
  worldVToLatitudeRadians,
  wrap01,
  wrapRadians,
} from './TerraSurfaceModel';

export interface TerraGeoPoint {
  longitudeRadians: number;
  latitudeRadians: number;
}

export interface TerraGlobeLocalFrameOptions extends TerraGeoPoint {
  radius?: number;
}

export interface TerraGlobeTile {
  level: number;
  x: number;
  y: number;
  minU: number;
  minV: number;
  maxU: number;
  maxV: number;
}

export interface TerraGlobeTileEvaluation {
  visible: boolean;
  frontFacingSamples: number;
  sampleCount: number;
  screenWidth: number;
  screenHeight: number;
  screenArea: number;
  shouldSubdivide: boolean;
  rejectionReason: 'visible' | 'hidden' | 'frustum';
}

export interface TerraGlobeTileEvaluateOptions {
  camera: Camera3D;
  viewportWidth: number;
  viewportHeight: number;
  targetPixels?: number;
  samplesPerEdge?: number;
  modelMatrix?: M4;
}

export interface TerraGlobeTileSelectionOptions extends TerraGlobeTileEvaluateOptions {
  maxLevel?: number;
}

export interface TerraGlobeTileSelection {
  tiles: TerraGlobeTile[];
  visited: number;
  hidden: number;
  frustumRejected: number;
  subdivided: number;
  maxLevelHits: number;
}

export class TerraGlobeLocalFrame {
  public readonly longitudeRadians: number;
  public readonly latitudeRadians: number;
  public readonly radius: number;
  public readonly targetPosition: V3;
  public readonly targetU: number;
  public readonly targetV: number;
  public readonly east: V3;
  public readonly north: V3;
  public readonly up: V3;

  constructor(options: TerraGlobeLocalFrameOptions) {
    this.longitudeRadians = options.longitudeRadians;
    this.latitudeRadians = options.latitudeRadians;
    this.radius = options.radius ?? 1;
    this.targetU = longitudeRadiansToWorldU(this.longitudeRadians);
    this.targetV = latitudeRadiansToWorldV(this.latitudeRadians);
    this.targetPosition = globePosition(
      this.longitudeRadians,
      this.latitudeRadians,
      this.radius,
    );
    this.up = this.targetPosition.normalize();
    const sinLon = Math.sin(this.longitudeRadians);
    const cosLon = Math.cos(this.longitudeRadians);
    const sinLat = Math.sin(this.latitudeRadians);
    const cosLat = Math.cos(this.latitudeRadians);
    this.east = new V3(-sinLon, 0, cosLon).normalize();
    this.north = new V3(-sinLat * cosLon, cosLat, -sinLat * sinLon).normalize();
  }

  public static fromDegrees(longitudeDegrees: number, latitudeDegrees: number, radius = 1) {
    return new TerraGlobeLocalFrame({
      longitudeRadians: longitudeDegrees * Math.PI / 180,
      latitudeRadians: latitudeDegrees * Math.PI / 180,
      radius,
    });
  }

  public project(longitudeRadians: number, latitudeRadians: number) {
    const position = globePosition(longitudeRadians, latitudeRadians, this.radius);
    const relative = position.sub(this.targetPosition);
    return new V3(
      relative.dot(this.east),
      relative.dot(this.north),
      relative.dot(this.up),
    );
  }

  public normal(longitudeRadians: number, latitudeRadians: number) {
    return globePosition(longitudeRadians, latitudeRadians, 1).normalize();
  }

  public localNormal(longitudeRadians: number, latitudeRadians: number) {
    const normal = this.normal(longitudeRadians, latitudeRadians);
    return new V3(
      normal.dot(this.east),
      normal.dot(this.north),
      normal.dot(this.up),
    ).normalize();
  }

  public frontnessForCamera(
    longitudeRadians: number,
    latitudeRadians: number,
    camera: Camera3D,
  ) {
    const point = this.project(longitudeRadians, latitudeRadians);
    const normal = this.localNormal(longitudeRadians, latitudeRadians);
    return camera.eye.sub(point).normalize().dot(normal);
  }

  public isFrontFacingForCamera(
    longitudeRadians: number,
    latitudeRadians: number,
    camera: Camera3D,
  ) {
    return this.frontnessForCamera(longitudeRadians, latitudeRadians, camera) >= 0;
  }

  public evaluateTile(
    tile: TerraGlobeTile,
    options: TerraGlobeTileEvaluateOptions,
  ): TerraGlobeTileEvaluation {
    const samples = sampleTile(tile, options.samplesPerEdge ?? 5);
    const modelViewProjection = options.camera.projectionMatrix
      .multiply(options.camera.viewMatrix)
      .multiply(options.modelMatrix ?? M4.identity());
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let frontFacingSamples = 0;
    let projectedSamples = 0;
    const containsTarget = this.tileContainsTarget(tile);

    const includeProjectedPoint = (local: V3) => {
      const projected = modelViewProjection.multiplyV3(local);
      if (projected.z < -1 || projected.z > 1) {
        return;
      }
      const screenX = (projected.x * 0.5 + 0.5) * options.viewportWidth;
      const screenY = (1 - (projected.y * 0.5 + 0.5)) * options.viewportHeight;
      minX = Math.min(minX, screenX);
      minY = Math.min(minY, screenY);
      maxX = Math.max(maxX, screenX);
      maxY = Math.max(maxY, screenY);
      projectedSamples += 1;
    };

    for (const sample of samples) {
      const longitude = worldUToLongitudeRadians(sample.u);
      const latitude = worldVToLatitudeRadians(sample.v);
      if (!this.isFrontFacingForCamera(longitude, latitude, options.camera)) {
        continue;
      }
      frontFacingSamples += 1;
      const local = this.project(longitude, latitude);
      includeProjectedPoint(local);
    }

    if (this.shouldUseTangentFootprint(tile, containsTarget, frontFacingSamples)) {
      frontFacingSamples = Math.max(frontFacingSamples, 1);
      for (const local of this.tileTangentFootprint(tile)) {
        includeProjectedPoint(local);
      }
    }

    if (frontFacingSamples === 0) {
      return emptyEvaluation(samples.length, 'hidden');
    }
    if (
      projectedSamples === 0 ||
      maxX < 0 ||
      minX > options.viewportWidth ||
      maxY < 0 ||
      minY > options.viewportHeight
    ) {
      return emptyEvaluation(samples.length, 'frustum', frontFacingSamples);
    }

    const screenWidth = Math.max(0, maxX - minX);
    const screenHeight = Math.max(0, maxY - minY);
    const targetPixels = options.targetPixels ?? 256;

    return {
      visible: true,
      frontFacingSamples,
      sampleCount: samples.length,
      screenWidth,
      screenHeight,
      screenArea: screenWidth * screenHeight,
      shouldSubdivide: Math.max(screenWidth, screenHeight) > targetPixels * 2,
      rejectionReason: 'visible',
    };
  }

  public tileContainsTarget(tile: TerraGlobeTile) {
    const containsU = this.targetU >= tile.minU && (
      this.targetU < tile.maxU ||
      (tile.maxU === 1 && this.targetU <= tile.maxU)
    );
    const containsV = this.targetV >= tile.minV && (
      this.targetV < tile.maxV ||
      (tile.maxV === 1 && this.targetV <= tile.maxV)
    );
    return containsU && containsV;
  }

  private shouldUseTangentFootprint(
    tile: TerraGlobeTile,
    containsTarget: boolean,
    frontFacingSamples: number,
  ) {
    if (containsTarget) {
      return true;
    }
    if (frontFacingSamples === 0) {
      return false;
    }

    const footprint = this.tileTangentBounds(tile);
    const distanceFromTarget = Math.hypot(footprint.centerX, footprint.centerY);
    const tileRadius = Math.hypot(footprint.halfWidth, footprint.halfHeight);
    return distanceFromTarget <= tileRadius * 1.25;
  }

  private tileTangentFootprint(tile: TerraGlobeTile) {
    const { centerX, centerY, halfWidth, halfHeight } = this.tileTangentBounds(tile);
    return [
      new V3(centerX, centerY, 0),
      new V3(centerX - halfWidth, centerY - halfHeight, 0),
      new V3(centerX + halfWidth, centerY - halfHeight, 0),
      new V3(centerX + halfWidth, centerY + halfHeight, 0),
      new V3(centerX - halfWidth, centerY + halfHeight, 0),
      new V3(centerX - halfWidth, centerY, 0),
      new V3(centerX + halfWidth, centerY, 0),
      new V3(centerX, centerY - halfHeight, 0),
      new V3(centerX, centerY + halfHeight, 0),
    ];
  }

  private tileTangentBounds(tile: TerraGlobeTile) {
    const longitudeSpan = Math.max(0, tile.maxU - tile.minU) * Math.PI * 2;
    const minLatitude = worldVToLatitudeRadians(tile.minV);
    const maxLatitude = worldVToLatitudeRadians(tile.maxV);
    const latitudeSpan = Math.abs(maxLatitude - minLatitude);
    const referenceU = Math.max(tile.minU, Math.min(tile.maxU, this.targetU));
    const referenceV = Math.max(tile.minV, Math.min(tile.maxV, this.targetV));
    const referenceLongitude = referenceU * Math.PI * 2 - Math.PI;
    const referenceLatitude = worldVToLatitudeRadians(referenceV);
    const centerX =
      wrapRadians(referenceLongitude - this.longitudeRadians) *
      Math.max(0.08, Math.cos(this.latitudeRadians)) *
      this.radius;
    const centerY = (referenceLatitude - this.latitudeRadians) * this.radius;
    const longitudeWidth = longitudeSpan * Math.max(0.08, Math.cos(this.latitudeRadians));
    const halfWidth = longitudeWidth * this.radius / 2;
    const halfHeight = latitudeSpan * this.radius / 2;
    return { centerX, centerY, halfWidth, halfHeight };
  }

  public selectTiles(options: TerraGlobeTileSelectionOptions): TerraGlobeTileSelection {
    const maxLevel = options.maxLevel ?? 8;
    const tiles: TerraGlobeTile[] = [];
    let visited = 0;
    let hidden = 0;
    let frustumRejected = 0;
    let subdivided = 0;
    let maxLevelHits = 0;

    const visit = (tile: TerraGlobeTile) => {
      visited += 1;
      const evaluation = this.evaluateTile(tile, options);
      if (!evaluation.visible) {
        if (evaluation.rejectionReason === 'hidden') {
          hidden += 1;
        } else {
          frustumRejected += 1;
        }
        return;
      }
      if (evaluation.shouldSubdivide && tile.level < maxLevel) {
        subdivided += 1;
        for (const child of childTiles(tile)) {
          visit(child);
        }
        return;
      }
      if (tile.level >= maxLevel) {
        maxLevelHits += 1;
      }
      tiles.push(tile);
    };

    visit(rootTile());

    return {
      tiles,
      visited,
      hidden,
      frustumRejected,
      subdivided,
      maxLevelHits,
    };
  }
}

export function rootTile(): TerraGlobeTile {
  return {
    level: 0,
    x: 0,
    y: 0,
    minU: 0,
    minV: 0,
    maxU: 1,
    maxV: 1,
  };
}

export function childTiles(tile: TerraGlobeTile) {
  const midU = (tile.minU + tile.maxU) / 2;
  const midV = (tile.minV + tile.maxV) / 2;
  const level = tile.level + 1;
  const x = tile.x * 2;
  const y = tile.y * 2;
  return [
    makeTile(level, x, y, tile.minU, tile.minV, midU, midV),
    makeTile(level, x + 1, y, midU, tile.minV, tile.maxU, midV),
    makeTile(level, x, y + 1, tile.minU, midV, midU, tile.maxV),
    makeTile(level, x + 1, y + 1, midU, midV, tile.maxU, tile.maxV),
  ];
}

export function makeTile(
  level: number,
  x: number,
  y: number,
  minU: number,
  minV: number,
  maxU: number,
  maxV: number,
): TerraGlobeTile {
  return { level, x, y, minU, minV, maxU, maxV };
}

export function tileStableId(tile: TerraGlobeTile) {
  return `${tile.level}/${tile.x}/${tile.y}`;
}

function sampleTile(tile: TerraGlobeTile, samplesPerEdge: number) {
  const count = Math.max(2, Math.floor(samplesPerEdge));
  const samples: Array<{ u: number; v: number }> = [];
  for (let y = 0; y < count; y += 1) {
    const v = tile.minV + (tile.maxV - tile.minV) * (y / (count - 1));
    for (let x = 0; x < count; x += 1) {
      const u = tile.minU + (tile.maxU - tile.minU) * (x / (count - 1));
      samples.push({ u: wrap01(u), v: clamp01(v) });
    }
  }
  return samples;
}

function emptyEvaluation(
  sampleCount: number,
  rejectionReason: TerraGlobeTileEvaluation['rejectionReason'],
  frontFacingSamples = 0,
): TerraGlobeTileEvaluation {
  return {
    visible: false,
    frontFacingSamples,
    sampleCount,
    screenWidth: 0,
    screenHeight: 0,
    screenArea: 0,
    shouldSubdivide: false,
    rejectionReason,
  };
}

function globePosition(longitudeRadians: number, latitudeRadians: number, radius: number) {
  const cosLat = Math.cos(latitudeRadians);
  return new V3(
    cosLat * Math.cos(longitudeRadians) * radius,
    Math.sin(latitudeRadians) * radius,
    cosLat * Math.sin(longitudeRadians) * radius,
  );
}
