import { Rect2D } from '@lunaterra/math';
import { V2 } from '@lunaterra/math';

export const TREE_BITS = 16;
export const MAX_DEPTH = 10;

export class VirtualTree {
  subTrees: VirtualTree[] | undefined;
  private ind: number;
  public get index() {
    return this.ind;
  }
  public level: number;
  public boundaries: Rect2D;

  public hasChildren() {
    return this.level < MAX_DEPTH;
  }

  constructor(ind: number, level: number, boundaries: Rect2D) {
    this.ind = ind;
    this.level = level;
    this.boundaries = boundaries;
  }

  protected generateIndices(ind: number, level: number) {
    return [
      generateIndex(ind, level, 0x0, 0x0, TREE_BITS),
      generateIndex(ind, level, 0x1, 0x0, TREE_BITS),
      generateIndex(ind, level, 0x1, 0x1, TREE_BITS),
      generateIndex(ind, level, 0x0, 0x1, TREE_BITS),
    ];
  }

  public static coordsToIndex(v2: V2) {
    const ix = indFromX(v2.x);
    const iy = indFromX(v2.y);
    return (ix | (iy << TREE_BITS)) >>> 0;
  }

  public printDebug(ind = 0, indAcc?: number[]) {
    if (indAcc) {
      indAcc.push(this.ind);
    }
    const yInd = this.ind >> TREE_BITS;
    const xInd = this.ind & 0xffff;
    console.log(
      xInd.toString(2).padStart(5 + ind),
      yInd.toString(2).padStart(5),
      'VirtualTree',
      this.boundaries.v1.x, this.boundaries.v1.y,
      this.level
    );
  }

  protected getByIndex(ind: number, level: number): VirtualTree | null {
    if (this.level === level) {
      return this;
    }

    const nextL = this.level;
    const nextLevelX = (ind >>> nextL) & 0x1;
    const nextLevelY = (ind >>> (nextL + TREE_BITS)) & 0x1;

    const nextLevelQuadrant = (nextLevelX << 1) | nextLevelY;
    const quadrantFromXY = [0, 3, 1, 2];

    const subTree = this.subTrees?.[quadrantFromXY[nextLevelQuadrant]];

    return subTree?.getByIndex(ind, level) ?? null;
  }
}

function generateIndex(
  ind: number,
  level: number,
  x: number,
  y: number,
  TREE_BITS: number
): number {
  const ix = ind | (x << level);
  const iy = ind | (y << (level + TREE_BITS));
  return ix | iy;
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
