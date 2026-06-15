import { describe, expect, it } from 'vitest';
import {
  mortonChildIndex,
  mortonTileBit,
  mortonTileXY,
  tileIndexToString,
} from './TileIndex';

describe('TileIndex', () => {
  it('generates Morton child indices', () => {
    expect(mortonChildIndex(0, 0, 0, 0)).toBe(0);
    expect(mortonChildIndex(0, 0, 1, 0)).toBe(1);
    expect(mortonChildIndex(0, 0, 0, 1)).toBe(2);
    expect(mortonChildIndex(0, 0, 1, 1)).toBe(3);
    expect(mortonChildIndex(3, 1, 1, 0)).toBe(7);
    expect(mortonChildIndex(3, 1, 0, 1)).toBe(11);
  });

  it('extracts Morton tile xy values', () => {
    expect(mortonTileXY(3)).toEqual({ x: 1, y: 1 });
    expect(mortonTileXY(7)).toEqual({ x: 3, y: 1 });
  });

  it('extracts Morton tile bits at a level', () => {
    expect(mortonTileBit(3, 0)).toEqual({ x: 1, y: 1 });
    expect(mortonTileBit(7, 1)).toEqual({ x: 1, y: 0 });
  });

  it('serializes tile index for server APIs', () => {
    expect(tileIndexToString(7)).toBe('7');
  });
});
