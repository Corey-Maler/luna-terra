import { Rect2D } from '@lunaterra/math';
import { V2 } from '@lunaterra/math';
import {
  MAX_DEPTH,
  mortonChildIndex,
  mortonTileBit,
  mortonTileIndexFromCoords,
  mortonTileXY,
  type TileIndex,
} from './TileIndex';

export class VirtualTree {
  subTrees: VirtualTree[] | undefined;
  private ind: TileIndex;
  public get index() {
    return this.ind;
  }
  public level: number;
  public boundaries: Rect2D;

  public hasChildren() {
    return this.level < MAX_DEPTH;
  }

  constructor(ind: TileIndex, level: number, boundaries: Rect2D) {
    this.ind = ind;
    this.level = level;
    this.boundaries = boundaries;
  }

  protected generateIndices(ind: TileIndex, level: number) {
    return [
      mortonChildIndex(ind, level, 0x0, 0x0),
      mortonChildIndex(ind, level, 0x1, 0x0),
      mortonChildIndex(ind, level, 0x1, 0x1),
      mortonChildIndex(ind, level, 0x0, 0x1),
    ];
  }

  public static coordsToIndex(v2: V2) {
    return mortonTileIndexFromCoords(v2);
  }

  public printDebug(ind = 0, indAcc?: TileIndex[]) {
    if (indAcc) {
      indAcc.push(this.ind);
    }
    const { x: xInd, y: yInd } = mortonTileXY(this.ind);
    console.log(
      xInd.toString(2).padStart(5 + ind),
      yInd.toString(2).padStart(5),
      'VirtualTree',
      this.boundaries.v1.x, this.boundaries.v1.y,
      this.level
    );
  }

  protected getByIndex(ind: TileIndex, level: number): VirtualTree | null {
    if (this.level === level) {
      return this;
    }

    const nextLevel = mortonTileBit(ind, this.level);

    const nextLevelQuadrant = (nextLevel.x << 1) | nextLevel.y;
    const quadrantFromXY = [0, 3, 1, 2];

    const subTree = this.subTrees?.[quadrantFromXY[nextLevelQuadrant]];

    return subTree?.getByIndex(ind, level) ?? null;
  }
}
