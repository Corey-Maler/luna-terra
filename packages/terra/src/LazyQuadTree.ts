import { Rect2D } from '@lunaterra/math';
import type { LunaTerraEngine } from '@lunaterra/core';
import { VirtualTree } from './VirtualTree';
import { GeometryClient } from './Geometry';
import type { MapyGeometry } from './types/Mapy';
import { CommutatorClient } from './Commutator';
import { GeometryCollection } from './GeometryCollection';
import { incDebugValue, printDebugValue } from './debug';
import type { TileIndex } from './TileIndex';
import { mortonTileBit } from './TileIndex';

export interface LazyQuadTreeContext {
  commutator: CommutatorClient;
  engine: LunaTerraEngine;
}

export class LazyQuadTree extends VirtualTree {
  public fulfilled = false;
  public loading = false;

  public context: LazyQuadTreeContext;

  private geometry: GeometryClient[] = [];
  private geometryCollection: GeometryCollection | undefined = undefined;

  private parent: LazyQuadTree | undefined;

  declare subTrees:
    | [LazyQuadTree, LazyQuadTree, LazyQuadTree, LazyQuadTree]
    | undefined;

  public static generate(context: LazyQuadTreeContext) {
    return new LazyQuadTree(context, 0, 0, Rect2D.identity());
  }

  protected constructor(
    context: LazyQuadTreeContext,
    index: TileIndex,
    level: number,
    boundaries: Rect2D,
    parent?: LazyQuadTree
  ) {
    super(index, level, boundaries);
    this.context = context;
    this.parent = parent;
    incDebugValue('lazyTree instances');
  }

  private generateSubTree() {
    if (!this.hasChildren()) {
      return;
    }

    const { level, boundaries } = this;
    const indices = this.generateIndices(this.index, this.level);
    this.subTrees = [
      new LazyQuadTree(this.context, indices[0], level + 1, boundaries.quadrant(0), this),
      new LazyQuadTree(this.context, indices[1], level + 1, boundaries.quadrant(1), this),
      new LazyQuadTree(this.context, indices[2], level + 1, boundaries.quadrant(2), this),
      new LazyQuadTree(this.context, indices[3], level + 1, boundaries.quadrant(3), this),
    ];
  }

  public async fetch() {
    this.loading = true;

    const data = await this.context.commutator.request(this.index, this.level);
    if (data) {
      this.deserialize(data);
    }

    this.fulfilled = true;
    this.context.engine.requestUpdate();
  }

  private deserialize(data: Array<MapyGeometry>) {
    this.geometry = data.map((serialized) =>
      GeometryClient.deserialize(
        serialized,
        this.boundaries,
        this.hasChildren() ? 8 : 16
      )
    );
  }

  public getRenderedTree(area: Rect2D): LazyQuadTree[] {
    if (!this.boundaries.intersects(area)) {
      return [];
    }

    if (!this.subTrees) {
      return [this];
    }

    if (this.amIGoodCandidate()) {
      return [this];
    }

    return this.subTrees.flatMap((subTree) => subTree.getRenderedTree(area));
  }

  private amIGoodCandidate() {
    const eng = this.context.engine.renderer.rectToScreen(this.boundaries);
    const OPTIMAL_TILE_SIZE = 256;
    return eng.width < OPTIMAL_TILE_SIZE * 2;
  }

  public getGeometryForArea(
    area: Rect2D,
    options: { maxLevel?: number } = {},
  ): Array<GeometryCollection | undefined> {
    if (!this.boundaries.intersects(area)) {
      return [];
    }

    if (!this.loading) {
      this.fetch();
    }

    if (!this.fulfilled) {
      return [this.parent?.geometryCollection];
    }

    const reachedMaxLevel = options.maxLevel !== undefined && this.level >= options.maxLevel;
    const amIAGoodCandidate = reachedMaxLevel || this.amIGoodCandidate();

    if (amIAGoodCandidate || !this.hasChildren()) {
      printDebugValue('current level', this.level);
      if (!this.geometryCollection) {
        this.geometryCollection = new GeometryCollection(this.geometry, {
          level: this.level,
          index: this.index,
        });
      }
      return [this.geometryCollection];
    }

    if (!this.subTrees) {
      this.generateSubTree();
    }

    if (this.subTrees) {
      return this.subTrees.flatMap((subTree) => subTree.getGeometryForArea(area, options));
    }

    return [];
  }

  public getGeometryForTile(index: TileIndex, level: number): GeometryCollection | undefined {
    const node = this.getOrCreateByIndex(index, level);
    if (!node) {
      return undefined;
    }

    if (!node.loading) {
      node.fetch();
    }

    if (!node.fulfilled) {
      return node.parent?.ownGeometryCollection();
    }

    return node.ownGeometryCollection();
  }

  public getGeometryForTiles(
    tiles: Array<{ index: TileIndex; level: number }>,
  ): Array<GeometryCollection | undefined> {
    return tiles.map((tile) => this.getGeometryForTile(tile.index, tile.level));
  }

  private getOrCreateByIndex(index: TileIndex, level: number): LazyQuadTree | null {
    if (this.level === level) {
      return this;
    }

    if (!this.hasChildren()) {
      return null;
    }

    if (!this.subTrees) {
      this.generateSubTree();
    }

    const nextLevel = mortonTileBit(index, this.level);
    const nextLevelQuadrant = (nextLevel.x << 1) | nextLevel.y;
    const quadrantFromXY = [0, 3, 1, 2];
    const subTree = this.subTrees?.[quadrantFromXY[nextLevelQuadrant]];
    return subTree?.getOrCreateByIndex(index, level) ?? null;
  }

  private ownGeometryCollection() {
    if (!this.geometryCollection) {
      this.geometryCollection = new GeometryCollection(this.geometry, {
        level: this.level,
        index: this.index,
      });
    }
    return this.geometryCollection;
  }
}
