import { Color } from '@lunaterra/color';
import { V2 } from '@lunaterra/math';
import {
  LTStyledElement,
  resolveThemeColor,
  type CanvasRenderer,
  type LTColorValue,
  type LTStyleOptions,
} from '@lunaterra/core';

export enum GridMode {
  LINES = 0,
  DOTS = 1,
}

export interface GridOptions {
  density: number;
  mode: GridMode;
  subgridColor: LTColorValue;
  lineWidth: number;
  dotSize: number;
}

type GridAxis = {
  grid: number[];
  subgrid: number[];
};

type AdaptiveGrid = {
  x: GridAxis;
  y: GridAxis;
  subgridOpacity: number;
};

const DEFAULT_GRID_COLOR = new Color(201, 201, 202);

export class Grid extends LTStyledElement<GridOptions> {
  constructor(options: Partial<GridOptions> = {}, styles: LTStyleOptions = {}) {
    super(options, {
      color: DEFAULT_GRID_COLOR,
      ...styles,
    });
  }

  protected defaultOptions(): GridOptions {
    return {
      density: 0,
      mode: GridMode.LINES,
      subgridColor: null,
      lineWidth: 1,
      dotSize: 2,
    };
  }

  public override render(renderer: CanvasRenderer) {
    const visibleArea = renderer.visibleArea;
    const grid = getAdaptiveGrid(
      visibleArea.bottomLeft.x,
      visibleArea.topRight.x,
      visibleArea.bottomLeft.y,
      visibleArea.topRight.y,
      this.options.density,
    );

    const majorColor = this.computedStyles.color.opaque(this.computedStyles.opacity);
    const minorColor = this.resolveSubgridColor(renderer).opaque(this.computedStyles.opacity);

    if (this.options.mode === GridMode.DOTS) {
      renderer.webGL.renderGridDots(
        visibleArea,
        this.options.density,
        majorColor.toString(),
        minorColor.toString(),
        grid.subgridOpacity,
        this.options.dotSize,
      );
      return;
    }

    this.renderLines(renderer, grid, majorColor, minorColor);
  }

  private renderLines(
    renderer: CanvasRenderer,
    grid: AdaptiveGrid,
    majorColor: Color,
    minorColor: Color,
  ) {
    const visibleArea = renderer.visibleArea;
    const x0 = visibleArea.bottomLeft.x;
    const y0 = visibleArea.bottomLeft.y;
    const x1 = visibleArea.topRight.x;
    const y1 = visibleArea.topRight.y;

    const batch = renderer.batch(
      minorColor.opaque(grid.subgridOpacity).toString(),
      this.options.lineWidth,
    );

    for (const x of grid.x.subgrid) {
      batch.line(new V2(x, y0), new V2(x, y1));
    }
    for (const y of grid.y.subgrid) {
      batch.line(new V2(x0, y), new V2(x1, y));
    }
    batch.stroke();

    batch.renew(majorColor.toString(), this.options.lineWidth);
    for (const x of grid.x.grid) {
      batch.line(new V2(x, y0), new V2(x, y1));
    }
    for (const y of grid.y.grid) {
      batch.line(new V2(x0, y), new V2(x1, y));
    }
    batch.stroke();
  }

  private resolveSubgridColor(renderer: CanvasRenderer): Color {
    return resolveThemeColor(this.options.subgridColor, renderer.theme)
      ?? this.computedStyles.color;
  }
}

function getAdaptiveGrid(
  fromX: number,
  toX: number,
  fromY: number,
  toY: number,
  density = 0,
): AdaptiveGrid {
  const rangeX = toX - fromX;
  const rangeY = toY - fromY;
  const minRange = Math.min(rangeX, rangeY);

  const magnitudeOffset = density > 0 ? 1 : 0;
  const magnitude = Math.floor(Math.log10(minRange)) - magnitudeOffset;
  const majorStep = Math.pow(10, magnitude);
  const minorStep = majorStep / 10;

  const xStart = Math.floor(fromX / majorStep) * majorStep;
  const yStart = Math.floor(fromY / majorStep) * majorStep;

  const magnitudeExact = Math.log10(minRange);
  const zoomProgress = 1 - (magnitudeExact - magnitude - magnitudeOffset);
  const subgridOpacity = Math.max(0, Math.min(1, zoomProgress));

  const gridX: number[] = [];
  const subgridX: number[] = [];
  const gridY: number[] = [];
  const subgridY: number[] = [];

  for (let value = xStart; value <= toX + majorStep; value += majorStep) {
    gridX.push(value);
  }
  for (let value = yStart; value <= toY + majorStep; value += majorStep) {
    gridY.push(value);
  }

  const xMinorStart = Math.floor(fromX / minorStep) * minorStep;
  for (let value = xMinorStart; value <= toX + minorStep; value += minorStep) {
    if (Math.abs(value % majorStep) < minorStep / 100) continue;
    subgridX.push(value);
  }

  const yMinorStart = Math.floor(fromY / minorStep) * minorStep;
  for (let value = yMinorStart; value <= toY + minorStep; value += minorStep) {
    if (Math.abs(value % majorStep) < minorStep / 100) continue;
    subgridY.push(value);
  }

  return {
    x: { grid: gridX, subgrid: subgridX },
    y: { grid: gridY, subgrid: subgridY },
    subgridOpacity,
  };
}