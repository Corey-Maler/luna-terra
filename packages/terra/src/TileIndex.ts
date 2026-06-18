import { V2 } from '@lunaterra/math';

export const TREE_BITS = 16;
export const MAX_DEPTH = 16;
export type TileIndex = number;
export type TileIndexString = string;

export function tileIndexToString(index: TileIndex): TileIndexString {
  return String(index);
}

export function mortonChildIndex(
  parent: TileIndex,
  level: number,
  x: 0 | 1,
  y: 0 | 1,
): TileIndex {
  return parent + x * 2 ** (level * 2) + y * 2 ** (level * 2 + 1);
}

export function mortonTileIndexFromCoords(v2: V2): TileIndex {
  const ix = indFromX(v2.x);
  const iy = indFromX(v2.y);
  return mortonInterleave(ix, iy);
}

export function mortonTileXY(index: TileIndex): { x: number; y: number } {
  let x = 0;
  let y = 0;

  for (let level = 0; level < TREE_BITS; level += 1) {
    const bit = mortonTileBit(index, level);
    x += bit.x * 2 ** level;
    y += bit.y * 2 ** level;
  }

  return { x, y };
}

export function mortonTileXYAtLevel(index: TileIndex, level: number): { x: number; y: number } {
  let x = 0;
  let y = 0;

  for (let bit = 0; bit < level; bit += 1) {
    const tileBit = mortonTileBit(index, bit);
    const targetBit = level - bit - 1;
    x += tileBit.x * 2 ** targetBit;
    y += tileBit.y * 2 ** targetBit;
  }

  return { x, y };
}

export function mortonTileIndexFromXYLevel(x: number, y: number, level: number): TileIndex {
  let index = 0;
  for (let bit = 0; bit < level; bit += 1) {
    const sourceBit = level - bit - 1;
    index += (Math.floor(x / 2 ** sourceBit) % 2) * 2 ** (bit * 2);
    index += (Math.floor(y / 2 ** sourceBit) % 2) * 2 ** (bit * 2 + 1);
  }
  return index;
}

export function mortonTileBit(index: TileIndex, level: number): { x: number; y: number } {
  return {
    x: Math.floor(index / 2 ** (level * 2)) % 2 as 0 | 1,
    y: Math.floor(index / 2 ** (level * 2 + 1)) % 2 as 0 | 1,
  };
}

export function indFromX(_x: number) {
  const alternative = Math.floor(_x * Math.pow(2, TREE_BITS))
    .toString(2)
    .padStart(TREE_BITS, '0')
    .split('')
    .reverse()
    .join('');
  return parseInt(alternative, 2);
}

function mortonInterleave(x: number, y: number): TileIndex {
  let index = 0;

  for (let level = 0; level < TREE_BITS; level += 1) {
    index += Math.floor(x / 2 ** level) % 2 * 2 ** (level * 2);
    index += Math.floor(y / 2 ** level) % 2 * 2 ** (level * 2 + 1);
  }

  return index;
}
