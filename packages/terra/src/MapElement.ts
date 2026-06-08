import { LTElement, CanvasRenderer, LunaTerraEngine } from '@lunaterra/core';
import { Grid } from '@lunaterra/elements';
import { highwayTypes, R, ResolutionByRoadType } from './helpers';
import { CommutatorClient } from './Commutator';
import { LazyQuadTree } from './LazyQuadTree';
import { GeometryCollection } from './GeometryCollection';

export class MapElement extends LTElement {
  private commutator: CommutatorClient;
  private lazyTreeRoot?: LazyQuadTree;

  constructor(tileBaseUrl?: string) {
    super();
    this.commutator = new CommutatorClient(tileBaseUrl);
  }

  protected defaultOptions() {
    return {};
  }

  setup(engine: LunaTerraEngine) {
    super.setup(engine);
    this.appendChild(new Grid());
    this.lazyTreeRoot = LazyQuadTree.generate({ commutator: this.commutator, engine });
  }

  render(renderer: CanvasRenderer) {
    this.renderGeometry(renderer);
  }

  private renderGeometry(renderer: CanvasRenderer) {
    this.lazyTreeRoot
      ?.getGeometryForArea(renderer.visibleArea)
      .filter((el, ind, original) => original.indexOf(el) === ind)
      .forEach((geometry) => {
        if (geometry) {
          this.renderGeometryCollection(renderer, geometry);
        }
      });
  }

  private renderGeometryCollection(renderer: CanvasRenderer, gc: GeometryCollection) {
    const debugColor = '#666666';
    const zoom = renderer.zoom;

    const cls = [
      '#333333', '#444444', '#555555', '#666666', '#777777',
      '#888888', '#999999', '#aaaaaa', '#bbbbbb',
    ];

    for (const go of gc.optimizedGroups) {
      if ('area' in go) {
        let color = '#cccccc';
        if (go.typeid >= 200) {
          color = '#8f8f8f';
        }
        renderer.webgl.p3Fill(go.points, go.triangles, color);
      } else {
        const mt = go.typeid;
        const highway = highwayTypes[mt] ?? 'unknown';
        const rr = ResolutionByRoadType[highway] ?? 0;
        let color = cls[rr] ?? debugColor;
        let lineWidth = 2;

        if (mt > 99 && mt < 200) {
          color = '#cccccc';
          lineWidth = 1;
        }

        if (mt >= 200 && mt < 500) {
          color = '#bbbbbb';
          lineWidth = 1;
        } else {
          const lw = (R.nano / (rr || 1)) * (zoom / 200);
          lineWidth = Math.max(Math.min(5, lw), 1);
          lineWidth = 2;
        }

        const colors = new Array(go.offsets.length).fill(color);
        renderer.webgl.p3(go.points, go.offsets, go.sizes, colors, lineWidth);
      }
    }
  }
}
