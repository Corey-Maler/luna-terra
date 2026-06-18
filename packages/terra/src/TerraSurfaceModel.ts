import { Camera3D } from '@lunaterra/core';
import { M4, V3 } from '@lunaterra/math';

export interface TerraSurfaceOptions {
  curvature: number;
  centerU?: number;
  centerV?: number;
  offsetU?: number;
  offsetV?: number;
  radius?: number;
  flatScale?: number;
}

export interface TerraSurfaceSample {
  u: number;
  v: number;
  longitudeRadians: number;
  latitudeRadians: number;
  position: V3;
  normal: V3;
  frontness: number;
  frontFacing: boolean;
}

export interface TerraSurfaceTileBounds {
  minU: number;
  minV: number;
  maxU: number;
  maxV: number;
}

export interface TerraSurfaceTileEvaluation {
  visible: boolean;
  frontFacingSamples: number;
  sampleCount: number;
  screenWidth: number;
  screenHeight: number;
  screenArea: number;
  shouldSubdivide: boolean;
}

export interface TerraSurfaceTileEvaluateOptions {
  camera: Camera3D;
  viewportWidth: number;
  viewportHeight: number;
  targetPixels?: number;
  samplesPerEdge?: number;
  modelMatrix?: M4;
}

export class TerraSurfaceModel {
  public readonly curvature: number;
  public readonly centerU: number;
  public readonly centerV: number;
  public readonly offsetU: number;
  public readonly offsetV: number;
  public readonly radius: number;
  public readonly flatScale: number;

  private readonly centerLongitudeRadians: number;
  private readonly centerLatitudeRadians: number;
  private readonly east: V3;
  private readonly north: V3;
  private readonly forward: V3;

  constructor(options: TerraSurfaceOptions) {
    this.curvature = clamp01(options.curvature);
    this.centerU = wrap01(options.centerU ?? 0.5);
    this.centerV = clamp01(options.centerV ?? 0.5);
    this.offsetU = options.offsetU ?? 0;
    this.offsetV = options.offsetV ?? 0;
    this.radius = options.radius ?? 1;
    this.flatScale = options.flatScale ?? 1;

    this.centerLongitudeRadians = worldUToLongitudeRadians(this.centerU);
    this.centerLatitudeRadians = worldVToLatitudeRadians(this.centerV);
    const sinLon = Math.sin(this.centerLongitudeRadians);
    const cosLon = Math.cos(this.centerLongitudeRadians);
    const sinLat = Math.sin(this.centerLatitudeRadians);
    const cosLat = Math.cos(this.centerLatitudeRadians);
    this.east = new V3(-sinLon, 0, cosLon);
    this.north = new V3(-sinLat * cosLon, cosLat, -sinLat * sinLon);
    this.forward = new V3(cosLat * cosLon, sinLat, cosLat * sinLon);
  }

  public sample(u: number, v: number): TerraSurfaceSample {
    const shiftedU = wrap01(u + this.offsetU);
    const shiftedV = clamp01(v + this.offsetV);
    const longitudeRadians = worldUToLongitudeRadians(shiftedU);
    const latitudeRadians = worldVToLatitudeRadians(shiftedV);
    const globe = this.globePosition(longitudeRadians, latitudeRadians, this.radius);
    const plane = this.planePosition(longitudeRadians, latitudeRadians);
    const position = lerpV3(plane, globe, this.curvature);
    const normal = lerpV3(new V3(0, 0, 1), globe.normalize(), this.curvature).normalize();
    const frontness = normal.z;

    return {
      u: shiftedU,
      v: shiftedV,
      longitudeRadians,
      latitudeRadians,
      position,
      normal,
      frontness,
      frontFacing: frontness >= 0,
    };
  }

  public frontnessForCamera(sample: TerraSurfaceSample, camera: Camera3D) {
    return camera.eye.sub(sample.position).normalize().dot(sample.normal);
  }

  public isFrontFacingForCamera(sample: TerraSurfaceSample, camera: Camera3D) {
    return this.frontnessForCamera(sample, camera) >= 0;
  }

  public evaluateTile(
    bounds: TerraSurfaceTileBounds,
    options: TerraSurfaceTileEvaluateOptions,
  ): TerraSurfaceTileEvaluation {
    const samples = this.sampleTile(bounds, options.samplesPerEdge ?? 3);
    const modelViewProjection = options.camera.projectionMatrix
      .multiply(options.camera.viewMatrix)
      .multiply(options.modelMatrix ?? M4.identity());
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let frontFacingSamples = 0;
    let projectedSamples = 0;

    for (const sample of samples) {
      if (!this.isFrontFacingForCamera(sample, options.camera)) {
        continue;
      }
      frontFacingSamples += 1;
      const projected = modelViewProjection.multiplyV3(sample.position);
      if (projected.z < -1 || projected.z > 1) {
        continue;
      }
      const screenX = (projected.x * 0.5 + 0.5) * options.viewportWidth;
      const screenY = (1 - (projected.y * 0.5 + 0.5)) * options.viewportHeight;
      minX = Math.min(minX, screenX);
      minY = Math.min(minY, screenY);
      maxX = Math.max(maxX, screenX);
      maxY = Math.max(maxY, screenY);
      projectedSamples += 1;
    }

    const visible = projectedSamples > 0 && maxX >= 0 && minX <= options.viewportWidth &&
      maxY >= 0 && minY <= options.viewportHeight;
    const screenWidth = visible ? Math.max(0, maxX - minX) : 0;
    const screenHeight = visible ? Math.max(0, maxY - minY) : 0;
    const targetPixels = options.targetPixels ?? 256;

    return {
      visible,
      frontFacingSamples,
      sampleCount: samples.length,
      screenWidth,
      screenHeight,
      screenArea: screenWidth * screenHeight,
      shouldSubdivide: visible && Math.max(screenWidth, screenHeight) > targetPixels,
    };
  }

  public sampleTile(bounds: TerraSurfaceTileBounds, samplesPerEdge: number) {
    const sampleCount = Math.max(2, Math.floor(samplesPerEdge));
    const samples: TerraSurfaceSample[] = [];
    for (let y = 0; y < sampleCount; y += 1) {
      const v = bounds.minV + (bounds.maxV - bounds.minV) * (y / (sampleCount - 1));
      for (let x = 0; x < sampleCount; x += 1) {
        const u = bounds.minU + (bounds.maxU - bounds.minU) * (x / (sampleCount - 1));
        samples.push(this.sample(u, v));
      }
    }
    return samples;
  }

  private globePosition(longitudeRadians: number, latitudeRadians: number, radius: number) {
    const cosLat = Math.cos(latitudeRadians);
    const point = new V3(
      cosLat * Math.cos(longitudeRadians),
      Math.sin(latitudeRadians),
      cosLat * Math.sin(longitudeRadians),
    );
    return new V3(
      point.dot(this.east) * radius,
      point.dot(this.north) * radius,
      point.dot(this.forward) * radius,
    );
  }

  private planePosition(longitudeRadians: number, latitudeRadians: number) {
    const deltaLongitude = wrapRadians(longitudeRadians - this.centerLongitudeRadians);
    const deltaLatitude = latitudeRadians - this.centerLatitudeRadians;
    return new V3(
      deltaLongitude * this.radius * this.flatScale,
      deltaLatitude * this.radius * this.flatScale,
      0,
    );
  }
}

export function worldUToLongitudeRadians(u: number) {
  return wrap01(u) * Math.PI * 2 - Math.PI;
}

export function worldVToLatitudeRadians(v: number) {
  const clamped = clamp01(v);
  return Math.atan(Math.sinh(Math.PI * (2 * clamped - 1)));
}

export function longitudeRadiansToWorldU(longitudeRadians: number) {
  return wrap01((longitudeRadians + Math.PI) / (Math.PI * 2));
}

export function latitudeRadiansToWorldV(latitudeRadians: number) {
  const mercator = Math.log(Math.tan(Math.PI / 4 + latitudeRadians / 2));
  return clamp01((1 + mercator / Math.PI) / 2);
}

export function wrap01(value: number) {
  return ((value % 1) + 1) % 1;
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function wrapDelta(delta: number) {
  return delta - Math.round(delta);
}

export function wrapRadians(delta: number) {
  return delta - Math.round(delta / (Math.PI * 2)) * Math.PI * 2;
}

function lerpV3(a: V3, b: V3, t: number) {
  return new V3(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    a.z + (b.z - a.z) * t,
  );
}
