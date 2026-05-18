import { LTElement, ScreenContainer, resolveThemeColor, themeColor, type LunaTerraEngine } from '@lunaterra/core';
import { Crosshair, ViewportGestureLayer, makeWindowTicks, type CrosshairOptions } from '@lunaterra/charts';
import { RectElement, TextElement } from '@lunaterra/elements';
import { ScaleRuler, type ScaleRulerTick } from './ScaleRuler';

type CrosshairSeries = NonNullable<CrosshairOptions['series']>;
type CrosshairFns = NonNullable<CrosshairOptions['fns']>;

export interface TimelineCursorTooltipRow {
  text: string;
  colorPath?: string;
  opacity?: number;
  fontSize?: number;
}

export interface TimelineChartState {
  scaleValue: number;
  windowSize: number;
  visibleCenter: number;
  cursorValue: number;
  cursorDragging: boolean;
  windowMin: number;
  windowMax: number;
}

export interface TimelineChartChromeOptions {
  chartFrame: ScreenContainer;
  scaleTicks: ScaleRulerTick[];
  initialScaleValue: number;
  initialVisibleCenter?: number;
  initialCursorValue?: number;
  domainMin: number;
  domainMax: number;
  minWindowSize: number;
  maxWindowSize: number;
  scaleValueToWindowSize: (scaleValue: number) => number;
  windowSizeToScaleValue: (windowSize: number) => number;
  windowTickStepCandidates: readonly number[];
  formatScaleValue: (scaleValue: number, windowSize: number) => string;
  formatWindowTick: (value: number, step: number) => string;
  formatCursorValue: (value: number) => string;
  edgeOffset?: number;
  sidePadding?: number;
  wheelZoomRequiresCtrl?: boolean;
  wheelZoomSensitivity?: number;
  crosshair?: {
    yMin: number;
    yMax: number;
    showXLabel?: boolean;
    labelSize?: number;
    lineWidth?: number;
    formatXLabel?: (x: number) => string;
    colorPath?: string;
    opacity?: number;
    getSeries?: () => CrosshairSeries;
    getFns?: () => CrosshairFns;
  };
  tooltip?: {
    widthPx: number;
    anchorOffsetPx?: number;
    edgeInsetPx?: number;
    paddingXPx?: number;
    paddingTopPx?: number;
    lineGapPx?: number;
    heightPx?: number;
    cornerRadius?: number;
    backgroundColorPath?: string;
    backgroundOpacity?: number;
    title?: {
      format: (cursorValue: number, state: TimelineChartState) => string;
      fontSize?: number;
      colorPath?: string;
      opacity?: number;
    };
    getRows: (cursorValue: number, state: TimelineChartState) => TimelineCursorTooltipRow[];
    getPanelY: (state: TimelineChartState, panelHeightWorld: number) => number;
    visibleWhen?: (state: TimelineChartState) => boolean;
  };
  onStateChange?: (state: TimelineChartState) => void;
}

export class TimelineChartChrome extends LTElement<TimelineChartChromeOptions> {
  private topRuler!: ScaleRuler;
  private bottomRuler!: ScaleRuler;
  private gestureLayer!: ViewportGestureLayer;
  private crosshair?: Crosshair;
  private tooltipPanel?: RectElement;
  private tooltipTitle?: TextElement;
  private tooltipRows: TextElement[] = [];

  private scaleValue = 0;
  private windowSize = 1;
  private visibleCenter = 0;
  private cursorValue = 0;
  private cursorDragging = false;

  constructor(options?: Partial<TimelineChartChromeOptions>) {
    super(options);

    this.scaleValue = this.clampScaleValue(this.options.initialScaleValue);
    this.windowSize = this.clampWindowSize(this.options.scaleValueToWindowSize(this.scaleValue));
    this.visibleCenter = this.clampCenter(this.options.initialVisibleCenter ?? this.options.domainMax - this.windowSize / 2);
    this.cursorValue = this.clampCursorToWindow(this.options.initialCursorValue ?? this.visibleCenter);

    this.topRuler = new ScaleRuler({
      ticks: [...this.options.scaleTicks],
      value: this.scaleValue,
      sticky: false,
      position: 'top-center',
      edgeOffset: this.options.edgeOffset,
      badgePosition: 'inline',
      formatValue: (value) => this.options.formatScaleValue(value, this.windowSize),
      onChange: (value) => {
        this.applyScaleValue(value, false);
      },
    });

    this.bottomRuler = new ScaleRuler({
      ticks: [],
      value: this.cursorValue,
      sticky: false,
      interactionMode: 'drag-caret',
      sidePadding: this.options.sidePadding,
      badgePosition: 'below',
      formatValue: (value) => `||| ${this.options.formatCursorValue(value)}`,
      onDragStart: () => {
        this.cursorDragging = true;
        this.publishState(true);
      },
      onDragEnd: () => {
        this.cursorDragging = false;
        this.publishState(true);
      },
      onChange: (value) => {
        this.cursorValue = this.clampCursorToWindow(value);
        this.publishState(true, false);
      },
    });

    this.gestureLayer = new ViewportGestureLayer({
      chartFrame: this.options.chartFrame,
      getWindowSize: () => this.windowSize,
      getVisibleCenter: () => this.visibleCenter,
      panBy: (delta) => {
        this.visibleCenter = this.clampCenter(this.visibleCenter + delta);
        this.publishState(true);
      },
      zoomAround: (nextWindowSize, focusRatio, focusValue) => {
        this.windowSize = this.clampWindowSize(nextWindowSize);
        this.scaleValue = this.clampScaleValue(this.options.windowSizeToScaleValue(this.windowSize));
        this.visibleCenter = this.clampCenter(
          focusValue + (0.5 - focusRatio) * this.windowSize,
          this.windowSize,
        );
        this.publishState(true, true);
      },
      wheelZoomRequiresCtrl: this.options.wheelZoomRequiresCtrl,
      wheelZoomSensitivity: this.options.wheelZoomSensitivity,
    });

    this.appendChild(this.topRuler);
    this.appendChild(this.bottomRuler);
    this.appendChild(this.gestureLayer);

    if (this.options.crosshair) {
      this.crosshair = new Crosshair({
        xMin: this.options.domainMin,
        xMax: this.options.domainMax,
        followPointer: false,
        yMin: this.options.crosshair.yMin,
        yMax: this.options.crosshair.yMax,
        showXLabel: this.options.crosshair.showXLabel,
        labelSize: this.options.crosshair.labelSize,
        lineWidth: this.options.crosshair.lineWidth,
        formatXLabel: this.options.crosshair.formatXLabel,
        series: this.options.crosshair.getSeries?.(),
        fns: this.options.crosshair.getFns?.(),
      });
      this.crosshair.styles.color = themeColor(this.options.crosshair.colorPath ?? 'chart.widget.title');
      this.crosshair.styles.opacity = this.options.crosshair.opacity ?? 0.58;
      this.options.chartFrame.appendChild(this.crosshair);
    }

    if (this.options.tooltip) {
      this.tooltipPanel = new RectElement({
        width: 1,
        height: 1,
        cornerRadius: this.options.tooltip.cornerRadius ?? 0,
        fillColor: 'rgba(36, 36, 36, 0.94)',
        stroke: false,
      });
      this.tooltipPanel.visibility = false;
      this.options.chartFrame.appendChild(this.tooltipPanel);

      if (this.options.tooltip.title) {
        this.tooltipTitle = new TextElement({ text: '', fontSize: this.options.tooltip.title.fontSize ?? 8, align: 'left', baseline: 'top' });
        this.tooltipTitle.styles.color = themeColor(this.options.tooltip.title.colorPath ?? 'chart.widget.title');
        this.tooltipTitle.styles.opacity = this.options.tooltip.title.opacity ?? 1;
        this.tooltipTitle.visibility = false;
        this.options.chartFrame.appendChild(this.tooltipTitle);
      }
    }
  }

  protected defaultOptions(): TimelineChartChromeOptions {
    return {
      chartFrame: new ScreenContainer({ anchor: 'top-left', offsetX: 0, offsetY: 0, width: 1, height: 1 }),
      scaleTicks: [
        { value: 0, label: 'Near' },
        { value: 1, label: 'Mid' },
        { value: 2, label: 'Far' },
      ],
      initialScaleValue: 1,
      domainMin: 0,
      domainMax: 1,
      minWindowSize: 0.1,
      maxWindowSize: 1,
      scaleValueToWindowSize: () => 1,
      windowSizeToScaleValue: () => 1,
      windowTickStepCandidates: [0.1, 0.2, 0.5, 1],
      formatScaleValue: (_scaleValue, windowSize) => String(windowSize),
      formatWindowTick: (value) => String(value),
      formatCursorValue: (value) => String(value),
      edgeOffset: 8,
      sidePadding: 24,
      wheelZoomRequiresCtrl: true,
      wheelZoomSensitivity: 0.0025,
    };
  }

  override setup(engine: import('@lunaterra/core').LunaTerraEngine): void {
    super.setup(engine);
    this.publishState(true, true);
  }

  override destroy(): void {
    this.tooltipPanel?.destroy?.();
    this.tooltipTitle?.destroy?.();
    for (const row of this.tooltipRows) row.destroy?.();
    this.crosshair?.destroy?.();
    this.topRuler.destroy?.();
    this.bottomRuler.destroy?.();
    this.gestureLayer.destroy?.();
  }

  public getState(): TimelineChartState {
    return {
      scaleValue: this.scaleValue,
      windowSize: this.windowSize,
      visibleCenter: this.visibleCenter,
      cursorValue: this.cursorValue,
      cursorDragging: this.cursorDragging,
      windowMin: this.visibleCenter - this.windowSize / 2,
      windowMax: this.visibleCenter + this.windowSize / 2,
    };
  }

  private applyScaleValue(scaleValue: number, syncTopRuler: boolean): void {
    this.scaleValue = this.clampScaleValue(scaleValue);
    this.windowSize = this.clampWindowSize(this.options.scaleValueToWindowSize(this.scaleValue));
    this.visibleCenter = this.clampCenter(this.visibleCenter, this.windowSize);
    this.publishState(true, syncTopRuler);
  }

  private publishState(syncBottomRuler: boolean, syncTopRuler = false): void {
    const windowMin = this.visibleCenter - this.windowSize / 2;
    const windowMax = this.visibleCenter + this.windowSize / 2;
    const { yMin = 0, yMax = 1 } = this.options.chartFrame.options.worldBounds ?? {};

    this.cursorValue = this.clampCursorToWindow(this.cursorValue);
    this.options.chartFrame.options.worldBounds = {
      xMin: windowMin,
      xMax: windowMax,
      yMin,
      yMax,
    };

    if (this.crosshair && this.options.crosshair) {
      this.crosshair.options = {
        ...this.crosshair.options,
        xMin: this.options.domainMin,
        xMax: this.options.domainMax,
        yMin: this.options.crosshair.yMin,
        yMax: this.options.crosshair.yMax,
        showXLabel: this.options.crosshair.showXLabel,
        labelSize: this.options.crosshair.labelSize,
        lineWidth: this.options.crosshair.lineWidth,
        formatXLabel: this.options.crosshair.formatXLabel,
        series: this.options.crosshair.getSeries?.(),
        fns: this.options.crosshair.getFns?.(),
      };
      this.crosshair.setValue(this.cursorValue);
    }

    this.updateTooltip(this.getState());

    this.bottomRuler.options.ticks = makeWindowTicks({
      center: this.visibleCenter,
      windowSize: this.windowSize,
      stepCandidates: this.options.windowTickStepCandidates,
      formatLabel: (value, step) => this.options.formatWindowTick(value, step),
    });

    if (syncBottomRuler) {
      this.bottomRuler.setValue(this.cursorValue);
    }
    if (syncTopRuler) {
      this.topRuler.setValue(this.scaleValue);
    }

    this.options.onStateChange?.(this.getState());
    this.engine?.requestUpdate();
  }

  private updateTooltip(state: TimelineChartState): void {
    if (!this.options.tooltip || !this.tooltipPanel) return;

    const visible = this.options.tooltip.visibleWhen?.(state) ?? state.cursorDragging;
    if (!visible) {
      this.tooltipPanel.visibility = false;
      if (this.tooltipTitle) this.tooltipTitle.visibility = false;
      for (const row of this.tooltipRows) row.visibility = false;
      return;
    }

    const chartBounds = this.options.chartFrame.options.worldBounds;
    if (!chartBounds) return;

    const worldPerPxX = (chartBounds.xMax - chartBounds.xMin) / Math.max(1, this.options.chartFrame.options.width);
    const worldPerPxY = (chartBounds.yMax - chartBounds.yMin) / Math.max(1, this.options.chartFrame.options.height);
    const rows = this.options.tooltip.getRows(state.cursorValue, state);
    const titleLineCount = this.tooltipTitle ? 1 : 0;
    const width = this.options.tooltip.widthPx * worldPerPxX;
    const anchorOffset = (this.options.tooltip.anchorOffsetPx ?? 8) * worldPerPxX;
    const edgeInset = (this.options.tooltip.edgeInsetPx ?? 2) * worldPerPxX;
    const paddingX = (this.options.tooltip.paddingXPx ?? 6) * worldPerPxX;
    const paddingTop = (this.options.tooltip.paddingTopPx ?? 8) * worldPerPxY;
    const lineGap = (this.options.tooltip.lineGapPx ?? 12) * worldPerPxY;
    const contentLines = titleLineCount + rows.length;
    const height = (this.options.tooltip.heightPx ?? defaultTooltipHeightPx(contentLines, this.options.tooltip.lineGapPx ?? 12, this.options.tooltip.paddingTopPx ?? 8)) * worldPerPxY;

    const placeRight = state.cursorValue + anchorOffset <= state.windowMax - (state.windowSize * 0.02);
    const rawX = placeRight ? state.cursorValue + anchorOffset : state.cursorValue - anchorOffset - width;
    const panelX = clamp(rawX, state.windowMin + edgeInset, state.windowMax - width - edgeInset);
    const panelY = this.options.tooltip.getPanelY(state, height);

    this.tooltipPanel.options = {
      ...this.tooltipPanel.options,
      width,
      height,
      cornerRadius: this.options.tooltip.cornerRadius ?? 0,
      fillColor: this.resolveTooltipFill(),
    };
    this.tooltipPanel.position = { x: panelX, y: panelY } as never;
    this.tooltipPanel.visibility = true;

    if (this.tooltipTitle && this.options.tooltip.title) {
      this.tooltipTitle.options.text = this.options.tooltip.title.format(state.cursorValue, state);
      this.tooltipTitle.position = { x: panelX + paddingX, y: panelY + paddingTop } as never;
      this.tooltipTitle.visibility = true;
    }

    this.ensureTooltipRowCount(rows.length);
    for (let index = 0; index < this.tooltipRows.length; index++) {
      const rowElement = this.tooltipRows[index];
      const row = rows[index];
      if (!row) {
        rowElement.visibility = false;
        continue;
      }
      rowElement.options.text = row.text;
      rowElement.options.fontSize = row.fontSize ?? 8;
      rowElement.styles.color = themeColor(row.colorPath ?? 'chart.widget.title');
      rowElement.styles.opacity = row.opacity ?? 0.84;
      rowElement.position = {
        x: panelX + paddingX,
        y: panelY + paddingTop + lineGap * (index + titleLineCount),
      } as never;
      rowElement.visibility = true;
    }
  }

  private ensureTooltipRowCount(count: number): void {
    while (this.tooltipRows.length < count) {
      const row = new TextElement({ text: '', fontSize: 8, align: 'left', baseline: 'top' });
      row.styles.color = themeColor('chart.widget.title');
      row.styles.opacity = 0.84;
      row.visibility = false;
      this.tooltipRows.push(row);
      this.options.chartFrame.appendChild(row);
      if (this.engine) row.setup(this.engine as LunaTerraEngine);
    }
  }

  private resolveTooltipFill(): string {
    const colorPath = this.options.tooltip?.backgroundColorPath ?? 'ui.zoomControls.panelBg';
    const opacity = this.options.tooltip?.backgroundOpacity ?? 0.94;
    const theme = this.engine?.renderer.theme;
    const base = theme ? resolveThemeColor(themeColor(colorPath), theme) : null;
    return base?.opaque(opacity).toString() ?? 'rgba(36, 36, 36, 0.94)';
  }

  private clampScaleValue(value: number): number {
    const ticks = this.options.scaleTicks;
    if (ticks.length === 0) return value;
    return clamp(value, ticks[0].value, ticks[ticks.length - 1].value);
  }

  private clampWindowSize(value: number): number {
    const domainSpan = Math.max(1e-6, this.options.domainMax - this.options.domainMin);
    const maxWindowSize = Math.min(this.options.maxWindowSize, domainSpan);
    return clamp(value, this.options.minWindowSize, Math.max(this.options.minWindowSize, maxWindowSize));
  }

  private clampCenter(value: number, nextWindowSize = this.windowSize): number {
    const domainSpan = this.options.domainMax - this.options.domainMin;
    if (domainSpan <= nextWindowSize) {
      return this.options.domainMin + domainSpan / 2;
    }
    return clamp(
      value,
      this.options.domainMin + nextWindowSize / 2,
      this.options.domainMax - nextWindowSize / 2,
    );
  }

  private clampCursorToWindow(value: number): number {
    return clamp(
      value,
      this.visibleCenter - this.windowSize / 2,
      this.visibleCenter + this.windowSize / 2,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function defaultTooltipHeightPx(lineCount: number, lineGapPx: number, paddingTopPx: number): number {
  return Math.max(24, paddingTopPx * 2 + lineGapPx * Math.max(0, lineCount));
}